from fastapi import FastAPI, Request, Path, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import os
import uuid
import uvicorn
import json
import asyncio
from datetime import datetime
from dotenv import load_dotenv
import aiohttp

from models.schemas import (
    VoiceChatResponse, 
    ChatHistoryResponse, 
    BackendStatusResponse,
    APIKeyConfig,
    ErrorType
)
from services.stt_service import STTService
from services.llm_service import LLMService
from services.tts_service import TTSService
from services.database_service import DatabaseService
from services.assemblyai_streaming_service import AssemblyAIStreamingService
from services.murf_websocket_service import MurfWebSocketService
from services.weather_service import WeatherService
from utils.logging_config import setup_logging, get_logger
from utils.constants import get_fallback_message

# Load environment variables
load_dotenv()
setup_logging()
logger = get_logger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="30 Days of Voice Agents - FastAPI",
    description="A modern conversational AI voice agent with FastAPI backend",
    version="1.0.0"
)

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")
stt_service: STTService = None
llm_service: LLMService = None
tts_service: TTSService = None
database_service: DatabaseService = None
assemblyai_streaming_service: AssemblyAIStreamingService = None
murf_websocket_service: MurfWebSocketService = None
weather_service: WeatherService = None

# Global variable to store current API config
current_api_config: APIKeyConfig = None


def initialize_services() -> APIKeyConfig:
    """Initialize all services with API keys - user-provided keys only"""
    global current_api_config
    
    # Use current config if available, otherwise start with empty config
    if current_api_config:
        config = current_api_config
    else:
        # No fallback to environment variables for critical services
        config = APIKeyConfig(
            gemini_api_key=None,
            assemblyai_api_key=None,
            murf_api_key=None,
            murf_voice_id="en-IN-aarav",
            mongodb_url=os.getenv("MONGODB_URL"),  # MongoDB can still use env
            openweather_api_key=None
        )
    
    global stt_service, llm_service, tts_service, database_service, assemblyai_streaming_service, murf_websocket_service, weather_service
    
    # Only initialize services if user has provided valid keys
    if config.are_keys_valid:
        stt_service = STTService(config.assemblyai_api_key)
        llm_service = LLMService(config.gemini_api_key)
        tts_service = TTSService(config.murf_api_key, config.murf_voice_id)
        assemblyai_streaming_service = AssemblyAIStreamingService(config.assemblyai_api_key)
        murf_websocket_service = MurfWebSocketService(config.murf_api_key, config.murf_voice_id)
        logger.info("✅ All AI services initialized successfully with user-provided keys")
    else:
        # Set all services to None if keys are missing
        stt_service = None
        llm_service = None
        tts_service = None
        assemblyai_streaming_service = None
        murf_websocket_service = None
        missing_keys = config.validate_keys()
        logger.warning(f"⚠️ AI services NOT initialized - Missing user-provided API keys: {missing_keys}")
    
    # Initialize weather service if API key is available
    if config.openweather_api_key:
        weather_service = WeatherService(config.openweather_api_key)
        logger.info("✅ Weather service initialized successfully")
    else:
        weather_service = None
        logger.warning("⚠️ Weather service not initialized - missing user-provided OpenWeather API key")
    
    database_service = DatabaseService(config.mongodb_url)
    
    return config


@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Starting Voice Agent application...")
    
    config = initialize_services()
    if database_service:
        try:
            db_connected = await database_service.connect()
            if db_connected:
                logger.info("✅ Database service connected successfully")
            else:
                logger.warning("⚠️ Database service running in fallback mode")
        except Exception as e:
            logger.error(f"❌ Database service initialization error: {e}")
    else:
        logger.error("❌ Database service not initialized")
    
    logger.info("✅ Application startup completed")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown"""
    logger.info("🛑 Shutting down Voice Agent application...")
    
    if database_service:
        await database_service.close()
    
    logger.info("✅ Application shutdown completed")


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Serve the main application page"""
    session_id = request.query_params.get('session_id')
    if not session_id:
        session_id = str(uuid.uuid4())
    
    return templates.TemplateResponse("index.html", {
        "request": request, 
        "session_id": session_id
    })


@app.get("/api/backend", response_model=BackendStatusResponse)
async def get_backend_status():
    """Get backend status"""
    try:
        db_connected = database_service.is_connected() if database_service else False
        db_test_result = await database_service.test_connection() if database_service else False
        
        return BackendStatusResponse(
            status="healthy",
            services={
                "stt": stt_service is not None,
                "llm": llm_service is not None,
                "tts": tts_service is not None,
                "database": database_service is not None,
                "database_connected": db_connected,
                "database_test": db_test_result,
                "assemblyai_streaming": assemblyai_streaming_service is not None,
                "murf_websocket": murf_websocket_service is not None,
                "weather": weather_service is not None
            },
            timestamp=datetime.now().isoformat()
        )
    except Exception as e:
        logger.error(f"Error getting backend status: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")



@app.get("/agent/chat/{session_id}/history", response_model=ChatHistoryResponse)
async def get_chat_history_endpoint(session_id: str = Path(..., description="Session ID")):
    """Get chat history for a session"""
    try:
        chat_history = await database_service.get_chat_history(session_id)
        return ChatHistoryResponse(
            success=True,
            session_id=session_id,
            messages=chat_history,
            message_count=len(chat_history)
        )
    except Exception as e:
        logger.error(f"Error getting chat history for session {session_id}: {str(e)}")
        return ChatHistoryResponse(
            success=False,
            session_id=session_id,
            messages=[],
            message_count=0
        )



@app.delete("/agent/chat/{session_id}/history")
async def clear_session_history(session_id: str = Path(..., description="Session ID")):
    """Clear chat history for a specific session"""
    try:
        success = await database_service.clear_session_history(session_id)
        if success:
            logger.info(f"Chat history cleared for session: {session_id}")
            return {"success": True, "message": f"Chat history cleared for session {session_id}"}
        else:
            return {"success": False, "message": f"Failed to clear chat history for session {session_id}"}
    except Exception as e:
        logger.error(f"Error clearing session history for {session_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/config", response_model=APIKeyConfig)
async def get_api_config():
    """Get current API configuration (without exposing actual keys for security)"""
    try:
        config = current_api_config or initialize_services()
        # Return config with masked keys for security
        return APIKeyConfig(
            gemini_api_key="***" if config.gemini_api_key else None,
            assemblyai_api_key="***" if config.assemblyai_api_key else None,
            murf_api_key="***" if config.murf_api_key else None,
            murf_voice_id=config.murf_voice_id,
            mongodb_url="***" if config.mongodb_url else None,
            openweather_api_key="***" if config.openweather_api_key else None
        )
    except Exception as e:
        logger.error(f"Error getting API config: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/config")
async def update_api_config(config: APIKeyConfig):
    """Update API configuration with new keys - user-provided keys only"""
    try:
        global current_api_config, stt_service, llm_service, tts_service, assemblyai_streaming_service, murf_websocket_service, weather_service
        
        # Store the new config
        current_api_config = config
        
        # Re-initialize services with new config - only if all critical keys are provided
        if config.are_keys_valid:
            stt_service = STTService(config.assemblyai_api_key)
            llm_service = LLMService(config.gemini_api_key)
            tts_service = TTSService(config.murf_api_key, config.murf_voice_id)
            assemblyai_streaming_service = AssemblyAIStreamingService(config.assemblyai_api_key)
            murf_websocket_service = MurfWebSocketService(config.murf_api_key, config.murf_voice_id)
            logger.info("✅ AI services updated with new user-provided API keys")
        else:
            # If keys are not valid, disable services
            stt_service = None
            llm_service = None
            tts_service = None
            assemblyai_streaming_service = None
            murf_websocket_service = None
            missing_keys = config.validate_keys()
            logger.warning(f"⚠️ AI services DISABLED - Missing user-provided API keys: {missing_keys}")
        
        # Update weather service if API key is provided
        if config.openweather_api_key:
            weather_service = WeatherService(config.openweather_api_key)
            logger.info("✅ Weather service updated with new user-provided API key")
        else:
            weather_service = None
            logger.warning("⚠️ Weather service disabled - no user-provided API key")
        
        return {
            "success": True,
            "message": "API configuration updated successfully",
            "services_initialized": config.are_keys_valid,
            "missing_keys": config.validate_keys() if not config.are_keys_valid else []
        }
    except Exception as e:
        logger.error(f"Error updating API config: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/config/status")
async def get_config_status():
    """Get the status of API configuration and services"""
    try:
        config = current_api_config or initialize_services()
        return {
            "config_loaded": config is not None,
            "keys_valid": config.are_keys_valid if config else False,
            "missing_keys": config.validate_keys() if config else [],
            "services": {
                "stt": stt_service is not None,
                "llm": llm_service is not None,
                "tts": tts_service is not None,
                "assemblyai_streaming": assemblyai_streaming_service is not None,
                "murf_websocket": murf_websocket_service is not None,
                "weather": weather_service is not None
            }
        }
    except Exception as e:
        logger.error(f"Error getting config status: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")
    
    def is_connected(self, websocket: WebSocket) -> bool:
        """Check if a WebSocket is still in active connections"""
        return websocket in self.active_connections

    async def send_personal_message(self, message: str, websocket: WebSocket):
        if self.is_connected(websocket):
            try:
                await websocket.send_text(message)
            except Exception as e:
                logger.error(f"Error sending personal message: {e}")
                self.disconnect(websocket)
        else:
            logger.debug("Attempted to send message to disconnected WebSocket")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting to WebSocket: {e}")
                self.disconnect(connection)


manager = ConnectionManager()

# Global locks to prevent concurrent LLM streaming for the same session
session_locks = {}

# Global function to handle weather requests
async def handle_weather_request(location: str, session_id: str, websocket: WebSocket):
    """Handle weather information request"""
    try:
        if not weather_service:
            error_message = {
                "type": "weather_error",
                "message": "Weather service is not available. Please check the OpenWeather API key configuration.",
                "timestamp": datetime.now().isoformat()
            }
            await manager.send_personal_message(json.dumps(error_message), websocket)
            return
        
        # Send weather request start notification
        start_message = {
            "type": "weather_request_start",
            "message": f"Getting weather information for {location}...",
            "location": location,
            "timestamp": datetime.now().isoformat()
        }
        await manager.send_personal_message(json.dumps(start_message), websocket)
        
        # Get weather data
        weather_data = await weather_service.get_weather(location)
        
        if weather_data["success"]:
            # Send weather response
            weather_response = {
                "type": "weather_response",
                "success": True,
                "location": weather_data["location"],
                "temperature": weather_data["temperature"],
                "description": weather_data["description"],
                "weather_report": weather_data["weather_report"],
                "data": weather_data,
                "timestamp": datetime.now().isoformat()
            }
            await manager.send_personal_message(json.dumps(weather_response), websocket)
            
            # Save weather query to chat history
            if database_service:
                await database_service.add_message_to_history(session_id, "user", f"Get weather for {location}")
                await database_service.add_message_to_history(session_id, "assistant", weather_data["weather_report"])
                
        else:
            # Send weather error response
            error_response = {
                "type": "weather_error",
                "success": False,
                "message": weather_data["message"],
                "error": weather_data.get("error", "unknown"),
                "timestamp": datetime.now().isoformat()
            }
            await manager.send_personal_message(json.dumps(error_response), websocket)
            
    except Exception as e:
        logger.error(f"Error handling weather request: {str(e)}")
        error_message = {
            "type": "weather_error",
            "message": "Sorry, I had trouble getting the weather information. Please try again.",
            "timestamp": datetime.now().isoformat()
        }
        await manager.send_personal_message(json.dumps(error_message), websocket)


# Global function to handle motivational quote requests
async def handle_quote_request(session_id: str, websocket: WebSocket):
    """Handle motivational quote request using ZenQuotes API"""
    try:
        # Send quote request start notification
        start_message = {
            "type": "quote_request_start",
            "message": "Fetching an inspiring motivational quote for you...",
            "timestamp": datetime.now().isoformat()
        }
        await manager.send_personal_message(json.dumps(start_message), websocket)
        
        # Fetch quote from ZenQuotes API
        try:
            import time
            import random
            
            # Add cache busting parameters to ensure fresh random quotes
            timestamp = int(time.time())
            cache_buster = random.randint(1000, 9999)
            
            async with aiohttp.ClientSession() as session:
                # ZenQuotes API endpoint - add cache busting to ensure randomness
                url = f"https://zenquotes.io/api/random?_t={timestamp}&_r={cache_buster}"
                async with session.get(url, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        # ZenQuotes returns an array with one quote object
                        if isinstance(data, list) and len(data) > 0:
                            quote_data = data[0]
                            quote_text = quote_data.get("q", "").strip()
                            author = quote_data.get("a", "Unknown").strip()
                            
                            if quote_text and len(quote_text) > 5:  # Ensure we got a real quote
                                logger.info(f"✅ Successfully fetched quote from ZenQuotes: '{quote_text[:50]}...' by {author}")
                            else:
                                raise Exception("Empty or invalid quote from ZenQuotes")
                        else:
                            raise Exception("Unexpected response format from ZenQuotes")
                    else:
                        raise Exception(f"ZenQuotes API returned status {response.status}")
        
        except asyncio.TimeoutError:
            # Fallback quote if timeout
            quote_text = "Every moment is a fresh beginning."
            author = "T.S. Eliot"
            logger.warning("⏰ ZenQuotes API request timed out, using fallback quote")
        
        except Exception as e:
            # Enhanced fallback quotes with more variety for better randomness
            fallback_quotes = [
                ("Believe in yourself and all that you are. Know that there is something inside you that is greater than any obstacle.", "Christian D. Larson"),
                ("The future belongs to those who believe in the beauty of their dreams.", "Eleanor Roosevelt"),
                ("Success is not final, failure is not fatal: it is the courage to continue that counts.", "Winston Churchill"),
                ("The only impossible journey is the one you never begin.", "Tony Robbins"),
                ("Your limitation—it's only your imagination.", "Unknown"),
                ("Push yourself, because no one else is going to do it for you.", "Unknown"),
                ("Great things never come from comfort zones.", "Unknown"),
                ("Dream it. Wish it. Do it.", "Unknown"),
                ("Success doesn't just find you. You have to go out and get it.", "Unknown"),
                ("The harder you work for something, the greater you'll feel when you achieve it.", "Unknown"),
                ("Dream bigger. Do bigger.", "Unknown"),
                ("Don't stop when you're tired. Stop when you're done.", "Unknown"),
                ("Wake up with determination. Go to bed with satisfaction.", "Unknown"),
                ("Do something today that your future self will thank you for.", "Sean Patrick Flanery"),
                ("Little things make big days.", "Unknown"),
                ("It's going to be hard, but hard does not mean impossible.", "Unknown"),
                ("Don't wait for opportunity. Create it.", "Unknown"),
                ("The key to success is to focus on goals, not obstacles.", "Unknown"),
                ("Be yourself; everyone else is already taken.", "Oscar Wilde"),
                ("You are never too old to set another goal or to dream a new dream.", "C.S. Lewis"),
                ("The way to get started is to quit talking and begin doing.", "Walt Disney"),
                ("If life were predictable it would cease to be life, and be without flavor.", "Eleanor Roosevelt"),
                ("It is during our darkest moments that we must focus to see the light.", "Aristotle"),
                ("Do not go where the path may lead, go instead where there is no path and leave a trail.", "Ralph Waldo Emerson")
            ]
            import random
            quote_text, author = random.choice(fallback_quotes)
            logger.error(f"❌ Error fetching quote from ZenQuotes API: {str(e)}, using random fallback quote")
        
        # Send quote response
        quote_response = {
            "type": "quote_response",
            "success": True,
            "quote": quote_text,
            "author": author,
            "timestamp": datetime.now().isoformat()
        }
        await manager.send_personal_message(json.dumps(quote_response), websocket)
        
        # Save quote request to chat history
        if database_service:
            await database_service.add_message_to_history(session_id, "user", "Get motivational quote")
            await database_service.add_message_to_history(session_id, "assistant", f'"{quote_text}" - {author}')
            
    except Exception as e:
        logger.error(f"❌ Critical error handling quote request: {str(e)}")
        # Send emergency fallback quote response
        emergency_quotes = [
            ("Stay strong, keep moving forward!", "Unknown"),
            ("Every day is a new beginning!", "Unknown"),
            ("You are capable of amazing things!", "Unknown"),
            ("Believe in the power of your dreams!", "Unknown")
        ]
        import random
        quote_text, author = random.choice(emergency_quotes)
        
        fallback_response = {
            "type": "quote_response",
            "success": True,
            "quote": quote_text,
            "author": author,
            "timestamp": datetime.now().isoformat()
        }
        await manager.send_personal_message(json.dumps(fallback_response), websocket)


# Global function to handle LLM streaming (moved outside WebSocket handler to prevent duplicates)
async def handle_llm_streaming(user_message: str, session_id: str, websocket: WebSocket, persona: str = "developer"):
    """Handle LLM streaming response and send to Murf WebSocket for TTS"""
    
    # Check if this is a weather query first
    if weather_service and weather_service.is_weather_query(user_message):
        location = weather_service.extract_location_from_query(user_message)
        if location:
            await handle_weather_request(location, session_id, websocket)
            return
        else:
            # If it's a weather query but no location found, ask for location
            error_message = {
                "type": "weather_location_needed",
                "message": "I'd be happy to help you with the weather! Please specify a location, for example: 'What's the weather in New York?'",
                "timestamp": datetime.now().isoformat()
            }
            await manager.send_personal_message(json.dumps(error_message), websocket)
            return
    
    # Prevent concurrent streaming for the same session
    if session_id not in session_locks:
        session_locks[session_id] = asyncio.Lock()
    
    async with session_locks[session_id]:
        # Initialize variables at function scope
        accumulated_response = ""
        audio_chunk_count = 0
        total_audio_size = 0
        
        try:
            # Get chat history
            try:
                if not database_service:
                    chat_history = []
                else:
                    chat_history = await database_service.get_chat_history(session_id)
                    # Save user message to chat history
                    save_success = await database_service.add_message_to_history(session_id, "user", user_message)
            except Exception as e:
                logger.error(f"Chat history error: {str(e)}")
                chat_history = []
            
            # Send LLM streaming start notification
            start_message = {
                "type": "llm_streaming_start",
                "message": "LLM is generating response...",
                "user_message": user_message,
                "timestamp": datetime.now().isoformat()
            }
            await manager.send_personal_message(json.dumps(start_message), websocket)
            
            # Connect to Murf WebSocket
            try:
                await murf_websocket_service.connect()
                
                # Create async generator that yields chunks and saves to DB when complete
                async def llm_text_stream_with_save():
                    nonlocal accumulated_response
                    chunk_count = 0
                    
                    # Stream LLM response and collect chunks
                    async for chunk in llm_service.generate_streaming_response(user_message, chat_history, persona):
                        if chunk:
                            chunk_count += 1
                            accumulated_response += chunk
                            
                            # Send chunk to client immediately
                            chunk_message = {
                                "type": "llm_streaming_chunk",
                                "chunk": chunk,
                                "accumulated_length": len(accumulated_response),
                                "timestamp": datetime.now().isoformat()
                            }
                            await manager.send_personal_message(json.dumps(chunk_message), websocket)
                            
                            # Yield chunk for TTS processing
                            yield chunk
                    
                    # LLM streaming is complete - save to database immediately
                    if accumulated_response.strip():
                        try:
                            if database_service:
                                save_success = await database_service.add_message_to_history(session_id, "assistant", accumulated_response)
                                logger.info(f"✅ Assistant response saved to database immediately after LLM completion")
                                
                                # Send notification that response is saved
                                save_notification = {
                                    "type": "response_saved",
                                    "message": "Assistant response saved to database",
                                    "response_length": len(accumulated_response),
                                    "timestamp": datetime.now().isoformat()
                                }
                                await manager.send_personal_message(json.dumps(save_notification), websocket)
                        except Exception as e:
                            logger.error(f"Failed to save assistant response to database immediately: {str(e)}")
                    else:
                        logger.error(f"❌ Empty accumulated response for: '{user_message}'")
                        raise Exception("Empty response from LLM stream")
                
                # Send LLM stream to Murf and receive base64 audio
                tts_start_message = {
                    "type": "tts_streaming_start", 
                    "message": "Starting TTS streaming with Murf WebSocket...",
                    "timestamp": datetime.now().isoformat()
                }
                await manager.send_personal_message(json.dumps(tts_start_message), websocket)
                
                # Stream LLM text to Murf and get base64 audio back
                async for audio_response in murf_websocket_service.stream_text_to_audio(llm_text_stream_with_save()):
                    if audio_response["type"] == "audio_chunk":
                        audio_chunk_count += 1
                        total_audio_size += audio_response["chunk_size"]
                        
                        # Send audio data to client
                        audio_message = {
                            "type": "tts_audio_chunk",
                            "audio_base64": audio_response["audio_base64"],
                            "chunk_number": audio_response["chunk_number"],
                            "chunk_size": audio_response["chunk_size"],
                            "total_size": audio_response["total_size"],
                            "is_final": audio_response["is_final"],
                            "timestamp": audio_response["timestamp"]
                        }
                        await manager.send_personal_message(json.dumps(audio_message), websocket)
                        
                        # Check if this is the final chunk
                        if audio_response["is_final"]:
                            break
                    
                    elif audio_response["type"] == "status":
                        # Send status updates to client
                        status_message = {
                            "type": "tts_status",
                            "data": audio_response["data"],
                            "timestamp": audio_response["timestamp"]
                        }
                        await manager.send_personal_message(json.dumps(status_message), websocket)
                
            except Exception as e:
                logger.error(f"Error with Murf WebSocket streaming: {str(e)}")
                error_message = {
                    "type": "tts_streaming_error",
                    "message": f"Error with Murf WebSocket: {str(e)}",
                    "timestamp": datetime.now().isoformat()
                }
                await manager.send_personal_message(json.dumps(error_message), websocket)
            
            finally:
                # Disconnect from Murf WebSocket
                try:
                    await murf_websocket_service.disconnect()
                except Exception as e:
                    logger.error(f"Error disconnecting from Murf WebSocket: {str(e)}")
            
            # Send completion notification
            complete_message = {
                "type": "llm_streaming_complete",
                "message": "LLM response and TTS streaming completed",
                "complete_response": accumulated_response,
                "total_length": len(accumulated_response),
                "audio_chunks_received": audio_chunk_count,
                "total_audio_size": total_audio_size,
                "session_id": session_id,  # Include session_id in response
                "timestamp": datetime.now().isoformat()
            }
            await manager.send_personal_message(json.dumps(complete_message), websocket)
            
        except Exception as e:
            logger.error(f"Error in LLM streaming: {str(e)}")
            error_message = {
                "type": "llm_streaming_error",
                "message": f"Error generating LLM response: {str(e)}",
                "timestamp": datetime.now().isoformat()
            }
            await manager.send_personal_message(json.dumps(error_message), websocket)
        
        finally:
            pass  # Session lock is automatically released


@app.websocket("/ws/audio-stream")
async def audio_stream_websocket(websocket: WebSocket):
    await manager.connect(websocket)
    
    # Check if user has provided necessary API keys
    if not current_api_config or not current_api_config.are_keys_valid:
        missing_keys = current_api_config.validate_keys() if current_api_config else ["All API keys required"]
        error_message = {
            "type": "api_keys_required",
            "message": "Please provide your API keys in the configuration to use the voice agent.",
            "missing_keys": missing_keys,
            "timestamp": datetime.now().isoformat()
        }
        await manager.send_personal_message(json.dumps(error_message), websocket)
        await websocket.close(code=4000, reason="API keys required")
        return
    
    # Try to get session_id from query parameters first
    query_params = dict(websocket.query_params)
    session_id = query_params.get('session_id')
    
    if not session_id:
        session_id = str(uuid.uuid4())
    
    audio_filename = f"streamed_audio_{session_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav"
    audio_filepath = os.path.join("streamed_audio", audio_filename)
    os.makedirs("streamed_audio", exist_ok=True)
    is_websocket_active = True
    last_processed_transcript = ""  # Track last processed transcript to prevent duplicates
    last_processing_time = 0  # Track when we last processed a transcript
    current_persona = "developer"  # Default persona
    
    async def transcription_callback(transcript_data):
        nonlocal last_processed_transcript, last_processing_time
        try:
            if is_websocket_active and manager.is_connected(websocket):
                await manager.send_personal_message(json.dumps(transcript_data), websocket)
                # Only show final transcriptions and trigger LLM streaming
                if transcript_data.get("type") == "final_transcript":
                    final_text = transcript_data.get('text', '').strip()
                    
                    # Normalize text for comparison
                    normalized_current = final_text.lower().strip('.,!?;: ')
                    normalized_last = last_processed_transcript.lower().strip('.,!?;: ')
                    
                    # Add cooldown period (minimum 2 seconds between processing)
                    current_time = datetime.now().timestamp()
                    time_since_last = current_time - last_processing_time
                    
                    # Prevent duplicate processing
                    if (final_text and 
                        normalized_current != normalized_last and 
                        len(normalized_current) > 0 and 
                        time_since_last >= 2.0 and
                        llm_service):
                        
                        last_processed_transcript = final_text
                        last_processing_time = current_time
                        await handle_llm_streaming(final_text, session_id, websocket, current_persona)
                        
        except Exception as e:
            logger.error(f"Error sending transcription: {e}")

    try:
        if assemblyai_streaming_service:
            assemblyai_streaming_service.set_transcription_callback(transcription_callback)
            async def safe_websocket_callback(msg):
                if is_websocket_active and manager.is_connected(websocket):
                    return await manager.send_personal_message(json.dumps(msg), websocket)
                return None
            
            await assemblyai_streaming_service.start_streaming_transcription(
                websocket_callback=safe_websocket_callback
            )
        
        welcome_message = {
            "type": "audio_stream_ready",
            "message": "Audio streaming endpoint ready with AssemblyAI transcription. Send binary audio data.",
            "session_id": session_id,
            "audio_filename": audio_filename,
            "transcription_enabled": assemblyai_streaming_service is not None,
            "timestamp": datetime.now().isoformat()
        }
        await manager.send_personal_message(json.dumps(welcome_message), websocket)
        
        with open(audio_filepath, "wb") as audio_file:
            chunk_count = 0
            total_bytes = 0
            
            while True:
                try:
                    message = await websocket.receive()
                    
                    if "text" in message:
                        text_data = message["text"]
                        
                        # Try to parse as JSON first (for session_id and persona_update messages)
                        try:
                            command_data = json.loads(text_data)
                            if isinstance(command_data, dict):
                                command_type = command_data.get("type")
                                
                                if command_type == "session_id":
                                    # Update session_id if provided from frontend
                                    new_session_id = command_data.get("session_id")
                                    if new_session_id and new_session_id != session_id:
                                        logger.info(f"Updating session_id from {session_id} to {new_session_id}")
                                        session_id = new_session_id
                                        # Update audio filename with new session ID
                                        audio_filename = f"streamed_audio_{session_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.wav"
                                        audio_filepath = os.path.join("streamed_audio", audio_filename)
                                    
                                    # Update persona if provided from frontend
                                    new_persona = command_data.get("persona")
                                    if new_persona and new_persona != current_persona:
                                        logger.info(f"Updating persona from {current_persona} to {new_persona}")
                                        current_persona = new_persona
                                    continue
                                
                                elif command_type == "persona_update":
                                    # Handle real-time persona updates
                                    new_persona = command_data.get("persona")
                                    if new_persona and new_persona != current_persona:
                                        logger.info(f"Real-time persona update from {current_persona} to {new_persona}")
                                        current_persona = new_persona
                                        
                                        # Send confirmation back to client
                                        persona_response = {
                                            "type": "persona_updated",
                                            "persona": current_persona,
                                            "message": f"Persona updated to {current_persona}",
                                            "timestamp": datetime.now().isoformat()
                                        }
                                        await manager.send_personal_message(json.dumps(persona_response), websocket)
                                    continue
                                
                                elif command_type == "get_weather":
                                    # Handle weather request
                                    location = command_data.get("location")
                                    if location and location.strip():
                                        logger.info(f"Weather request for location: {location}")
                                        # Send immediate feedback about location detection
                                        location_detected_message = {
                                            "type": "weather_location_detected",
                                            "message": f"Location detected: {location.strip()}. Fetching weather data...",
                                            "location": location.strip(),
                                            "timestamp": datetime.now().isoformat()
                                        }
                                        await manager.send_personal_message(json.dumps(location_detected_message), websocket)
                                        await handle_weather_request(location.strip(), session_id, websocket)
                                    else:
                                        error_message = {
                                            "type": "weather_error",
                                            "message": "Please provide a location for the weather request.",
                                            "timestamp": datetime.now().isoformat()
                                        }
                                        await manager.send_personal_message(json.dumps(error_message), websocket)
                                    continue
                                
                                elif command_type == "get_quote":
                                    # Handle motivational quote request
                                    logger.info(f"Quote request for session: {session_id}")
                                    await handle_quote_request(session_id, websocket)
                                    continue
                        except json.JSONDecodeError:
                            # Not JSON, treat as regular command
                            pass
                        
                        command = text_data
                        
                        if command == "start_streaming":
                            response = {
                                "type": "command_response",
                                "message": "Ready to receive audio chunks with real-time transcription",
                                "status": "streaming_ready"
                            }
                            await manager.send_personal_message(json.dumps(response), websocket)
                            
                        elif command == "stop_streaming":
                            response = {
                                "type": "command_response",
                                "message": "Stopping audio stream",
                                "status": "streaming_stopped"
                            }
                            await manager.send_personal_message(json.dumps(response), websocket)
                            
                            if assemblyai_streaming_service:
                                async def safe_stop_callback(msg):
                                    if manager.is_connected(websocket):
                                        return await manager.send_personal_message(json.dumps(msg), websocket)
                                    return None
                            break
                    
                    elif "bytes" in message:
                        audio_chunk = message["bytes"]
                        chunk_count += 1
                        total_bytes += len(audio_chunk)
                        
                        # Write to file
                        audio_file.write(audio_chunk)
                        
                        # Send to AssemblyAI for transcription if available
                        if assemblyai_streaming_service and is_websocket_active:
                            await assemblyai_streaming_service.send_audio_chunk(audio_chunk)
                        
                        # Send chunk confirmation to client
                        if chunk_count % 10 == 0:  # Send every 10th chunk to avoid spam
                            chunk_response = {
                                "type": "audio_chunk_received",
                                "chunk_number": chunk_count,
                                "total_bytes": total_bytes,
                                "timestamp": datetime.now().isoformat()
                            }
                            await manager.send_personal_message(json.dumps(chunk_response), websocket)
                
                except WebSocketDisconnect:
                    break
                except Exception as e:
                    logger.error(f"Error processing audio chunk: {e}")
                    break
        
        final_response = {
            "type": "audio_stream_complete",
            "message": f"Audio stream completed. Total chunks: {chunk_count}, Total bytes: {total_bytes}",
            "session_id": session_id,
            "audio_filename": audio_filename,
            "total_chunks": chunk_count,
            "total_bytes": total_bytes,
            "timestamp": datetime.now().isoformat()
        }
        await manager.send_personal_message(json.dumps(final_response), websocket)
        
    except WebSocketDisconnect:
        is_websocket_active = False
        manager.disconnect(websocket)
    except Exception as e:
        is_websocket_active = False
        logger.error(f"Audio streaming WebSocket error: {e}")
        manager.disconnect(websocket)
    finally:
        is_websocket_active = False
        if assemblyai_streaming_service:
            await assemblyai_streaming_service.stop_streaming_transcription()


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
