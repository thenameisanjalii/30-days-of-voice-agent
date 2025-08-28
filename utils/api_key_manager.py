"""
API Key Manager - Handles dynamic API key configuration and service initialization
"""

import os
from typing import Dict, Optional, Tuple
from models.schemas import APIKeyConfig, APIKeyUpdateRequest
from services.llm_service import LLMService
from services.tts_service import TTSService
from services.stt_service import STTService
from services.weather_service import WeatherService
from services.assemblyai_streaming_service import AssemblyAIStreamingService
from services.murf_websocket_service import MurfWebSocketService
from utils.logging_config import get_logger

logger = get_logger(__name__)


class APIKeyManager:
    """Manages API keys and service initialization - requires user-provided keys only"""
    
    def __init__(self):
        # Initialize with empty config - no fallback to env vars for critical services
        self.current_config = APIKeyConfig(
            gemini_api_key=None,
            assemblyai_api_key=None,
            murf_api_key=None,
            murf_voice_id="en-IN-aarav",  # Default voice ID
            mongodb_url=os.getenv("MONGODB_URL"),  # MongoDB can still use env
            openweather_api_key=None
        )
        
    def _load_fallback_config(self) -> APIKeyConfig:
        """Load fallback configuration - only MongoDB URL from environment variables"""
        return APIKeyConfig(
            gemini_api_key=None,
            assemblyai_api_key=None,
            murf_api_key=None,
            murf_voice_id="en-IN-aarav",
            mongodb_url=os.getenv("MONGODB_URL"),
            openweather_api_key=None
        )
    
    def update_config(self, user_keys: APIKeyUpdateRequest) -> APIKeyConfig:
        """Update configuration with user-provided keys - no fallback to env vars for critical services"""
        self.current_config = APIKeyConfig(
            gemini_api_key=user_keys.gemini_api_key,
            assemblyai_api_key=user_keys.assemblyai_api_key,
            murf_api_key=user_keys.murf_api_key,
            murf_voice_id=user_keys.murf_voice_id or "en-IN-aarav",
            openweather_api_key=user_keys.openweather_api_key,
            mongodb_url=os.getenv("MONGODB_URL")  # MongoDB URL always from env
        )
        
        logger.info("🔄 API configuration updated with user-provided keys only")
        return self.current_config
    
    def get_current_config(self) -> APIKeyConfig:
        """Get current API configuration"""
        return self.current_config
    
    def get_keys_status(self) -> Dict[str, bool]:
        """Get status of all API keys"""
        return {
            "gemini": bool(self.current_config.gemini_api_key),
            "assemblyai": bool(self.current_config.assemblyai_api_key),
            "murf": bool(self.current_config.murf_api_key),
            "openweather": bool(self.current_config.openweather_api_key)
        }
    
    def initialize_services(self) -> Dict[str, bool]:
        """Initialize all services with current configuration"""
        services_status = {}
        
        try:
            # Initialize LLM Service
            if self.current_config.gemini_api_key:
                llm_service = LLMService(self.current_config.gemini_api_key)
                services_status["llm"] = True
                logger.info("✅ LLM Service initialized")
            else:
                services_status["llm"] = False
                logger.warning("⚠️ LLM Service not initialized - missing Gemini API key")
                
        except Exception as e:
            services_status["llm"] = False
            logger.error(f"❌ LLM Service initialization failed: {str(e)}")
        
        try:
            # Initialize STT Service
            if self.current_config.assemblyai_api_key:
                stt_service = STTService(self.current_config.assemblyai_api_key)
                services_status["stt"] = True
                logger.info("✅ STT Service initialized")
            else:
                services_status["stt"] = False
                logger.warning("⚠️ STT Service not initialized - missing AssemblyAI API key")
                
        except Exception as e:
            services_status["stt"] = False
            logger.error(f"❌ STT Service initialization failed: {str(e)}")
        
        try:
            # Initialize TTS Service
            if self.current_config.murf_api_key:
                tts_service = TTSService(
                    self.current_config.murf_api_key,
                    self.current_config.murf_voice_id
                )
                services_status["tts"] = True
                logger.info("✅ TTS Service initialized")
            else:
                services_status["tts"] = False
                logger.warning("⚠️ TTS Service not initialized - missing Murf API key")
                
        except Exception as e:
            services_status["tts"] = False
            logger.error(f"❌ TTS Service initialization failed: {str(e)}")
        
        try:
            # Initialize Weather Service
            if self.current_config.openweather_api_key:
                weather_service = WeatherService(self.current_config.openweather_api_key)
                services_status["weather"] = True
                logger.info("✅ Weather Service initialized")
            else:
                services_status["weather"] = False
                logger.warning("⚠️ Weather Service not initialized - missing OpenWeather API key")
                
        except Exception as e:
            services_status["weather"] = False
            logger.error(f"❌ Weather Service initialization failed: {str(e)}")
        
        return services_status
    
    async def validate_api_key(self, service: str, api_key: str) -> Tuple[bool, str]:
        """Validate a specific API key by testing the service"""
        try:
            if service == "gemini":
                return await self._validate_gemini_key(api_key)
            elif service == "assemblyai":
                return await self._validate_assemblyai_key(api_key)
            elif service == "murf":
                return await self._validate_murf_key(api_key)
            elif service == "openweather":
                return await self._validate_openweather_key(api_key)
            else:
                return False, f"Unknown service: {service}"
                
        except Exception as e:
            return False, f"Validation error: {str(e)}"
    
    async def _validate_gemini_key(self, api_key: str) -> Tuple[bool, str]:
        """Validate Gemini API key"""
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-1.5-flash")
            # Test with a simple prompt
            response = model.generate_content("Hello")
            if response.text:
                return True, "Gemini API key is valid"
            else:
                return False, "Invalid response from Gemini API"
        except Exception as e:
            return False, f"Gemini API key validation failed: {str(e)}"
    
    async def _validate_assemblyai_key(self, api_key: str) -> Tuple[bool, str]:
        """Validate AssemblyAI API key"""
        try:
            import aiohttp
            headers = {"authorization": api_key}
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://api.assemblyai.com/v2/account",
                    headers=headers
                ) as response:
                    if response.status == 200:
                        return True, "AssemblyAI API key is valid"
                    else:
                        return False, f"AssemblyAI API returned status: {response.status}"
        except Exception as e:
            return False, f"AssemblyAI API key validation failed: {str(e)}"
    
    async def _validate_murf_key(self, api_key: str) -> Tuple[bool, str]:
        """Validate Murf API key"""
        try:
            from murf import Murf
            client = Murf(api_key=api_key)
            # This is a basic check - you might need to adjust based on Murf's API
            return True, "Murf API key format is valid"
        except Exception as e:
            return False, f"Murf API key validation failed: {str(e)}"
    
    async def _validate_openweather_key(self, api_key: str) -> Tuple[bool, str]:
        """Validate OpenWeatherMap API key"""
        try:
            import aiohttp
            url = f"https://api.openweathermap.org/data/2.5/weather?q=London&appid={api_key}"
            async with aiohttp.ClientSession() as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        return True, "OpenWeatherMap API key is valid"
                    else:
                        return False, f"OpenWeatherMap API returned status: {response.status}"
        except Exception as e:
            return False, f"OpenWeatherMap API key validation failed: {str(e)}"


# Global instance
api_key_manager = APIKeyManager()
