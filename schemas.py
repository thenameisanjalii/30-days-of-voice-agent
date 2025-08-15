# schemas.py
from pydantic import BaseModel
from typing import List, Optional

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatResponse(BaseModel):
    success: bool
    transcription: Optional[str] = None
    llm_response: str
    audio_url: Optional[str] = None
    history: List[ChatMessage]
    error: Optional[str] = None

class TextToSpeechRequest(BaseModel):
    text: str

class TextToSpeechResponse(BaseModel):
    success: bool
    audio_url: Optional[str] = None
    error: Optional[str] = None