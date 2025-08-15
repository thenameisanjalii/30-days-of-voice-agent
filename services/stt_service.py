# services/stt_service.py
import assemblyai as aai
import os
import logging

logger = logging.getLogger(__name__)

class STTService:
    def __init__(self):
        api_key = os.getenv("ASSEMBLYAI_API_KEY")
        if not api_key:
            raise ValueError("ASSEMBLYAI_API_KEY not found in environment variables")
        aai.settings.api_key = api_key
        self.transcriber = aai.Transcriber()
    
    async def transcribe_audio(self, audio_data: bytes) -> str:
        try:
            transcript = self.transcriber.transcribe(audio_data)
            if not transcript.text or not transcript.text.strip():
                raise Exception("No speech detected")
            logger.info(f"Transcription successful: {transcript.text[:50]}...")
            return transcript.text
        except Exception as e:
            logger.error(f"STT Error: {str(e)}")
            raise Exception("Sorry, I couldn't understand your speech. Please try again.")