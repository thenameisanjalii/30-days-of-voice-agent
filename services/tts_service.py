# services/tts_service.py
from murf import Murf
import os
import logging

logger = logging.getLogger(__name__)

class TTSService:
    def __init__(self):
        api_key = os.getenv("MURF_API_KEY")
        if not api_key:
            raise ValueError("MURF_API_KEY not found in environment variables")
        self.client = Murf(api_key=api_key)
    
    async def generate_speech(self, text: str) -> str:
        try:
            response = self.client.text_to_speech.generate(
                text=text,
                voice_id="en-US-terrell"
            )
            logger.info("TTS audio generated successfully")
            return response.audio_file
        except Exception as e:
            logger.error(f"TTS Error: {str(e)}")
            if os.getenv("MURF_API_KEY"):
                try:
                    fallback_text = "Sorry, I can't speak right now due to a technical issue. Please try again later."
                    response = self.client.text_to_speech.generate(
                        text=fallback_text,
                        voice_id="en-US-terrell"
                    )
                    return response.audio_file
                except Exception:
                    raise Exception("Sorry, I can't speak right now due to a technical issue. Please try again later.")
            else:
                raise Exception("Sorry, I can't speak right now due to a technical issue. Please try again later.")