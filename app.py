# app.py
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import logging
from typing import Dict, List
import json
from datetime import datetime

# Import schemas and services
from schemas import ChatResponse, TextToSpeechRequest, TextToSpeechResponse, ChatMessage
from services.stt_service import STTService
from services.llm_service import LLMService
from services.tts_service import TTSService

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="AI Voice Agent", description="Conversational AI Voice Agent API")

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Initialize services
stt_service = STTService()
llm_service = LLMService()
tts_service = TTSService()

# Chat history storage
chat_history: Dict[str, List[Dict[str, str]]] = {}

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    """Serve the main interface"""
    try:
        with open("templates/index.html", "r") as f:
            return HTMLResponse(content=f.read(), status_code=200)
    except Exception as e:
        logger.error(f"Error serving index.html: {str(e)}")
        return HTMLResponse(content="<h1>Error loading page</h1>", status_code=500)

@app.post("/agent/chat/{session_id}", response_model=ChatResponse)
async def agent_chat(session_id: str, file: UploadFile = File(...)):
    """Process voice input and generate conversational response"""
    logger.info(f"Processing chat request for session: {session_id}")
    
    try:
        # Speech-to-Text
        audio_data = await file.read()
        transcript = await stt_service.transcribe_audio(audio_data)
        
        # Update chat history
        history = chat_history.get(session_id, [])
        history.append({"role": "user", "content": transcript})
        
        # Generate LLM response
        llm_response = await llm_service.generate_response(history)
        history.append({"role": "bot", "content": llm_response})
        
        # Generate TTS audio
        audio_url = await tts_service.generate_speech(llm_response)
        
        # Save updated history
        chat_history[session_id] = history
        
        logger.info(f"Chat request processed successfully for session: {session_id}")
        return ChatResponse(
            success=True,
            transcription=transcript,
            llm_response=llm_response,
            audio_url=audio_url,
            history=[ChatMessage(**msg) for msg in history]
        )
        
    except Exception as e:
        logger.error(f"Error in agent_chat: {str(e)}")
        fallback_text = "Something went wrong on the server. Please try again later."
        
        # Try to generate fallback audio
        audio_url = ""
        try:
            audio_url = await tts_service.generate_speech(fallback_text)
        except Exception:
            pass
        
        return ChatResponse(
            success=False,
            error=str(e),
            llm_response=fallback_text,
            audio_url=audio_url,
            history=[ChatMessage(**msg) for msg in chat_history.get(session_id, [])]
        )

@app.post("/generate-audio", response_model=TextToSpeechResponse)
async def generate_audio(request: TextToSpeechRequest):
    """Generate audio from text"""
    try:
        audio_url = await tts_service.generate_speech(request.text)
        return TextToSpeechResponse(success=True, audio_url=audio_url)
    except Exception as e:
        logger.error(f"Error generating audio: {str(e)}")
        return TextToSpeechResponse(success=False, error=str(e))
    
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time communication"""
    await websocket.accept()
    logger.info("WebSocket connection established")
    
    try:
        while True:
            data = await websocket.receive_text()
            logger.info(f"Received: {data}")
            
            response_data = {
            "type": "echo_response",
            "original_message": data,
            "echo_message": f"Echo: {data}",
            "timestamp": datetime.now().isoformat(),
            "connection_id": id(websocket),
            "status": "success",
            "message_length": len(data),
            "server_info": "AI Voice Agent WebSocket"
            }
            await websocket.send_text(json.dumps(response_data))
            logger.info(f"Sent JSON response: {response_data}")
            
    except WebSocketDisconnect:
        logger.info("WebSocket connection closed")
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        await websocket.close()

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting AI Voice Agent server...")
    uvicorn.run(app, host="127.0.0.1", port=8000)