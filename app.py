from fastapi import FastAPI
from pydantic import BaseModel
import os
from murf import Murf
from dotenv import load_dotenv

load_dotenv()

client = Murf(api_key=os.getenv("MURF_API_KEY"))

app = FastAPI()

class TextInput(BaseModel):
    text: str

@app.get("/")
async def root():
    return {"message": "Voice Agent API is running!", "status": "Day 1 Complete"}

@app.get("/test-config")
async def test_config():
    api_key = os.getenv("MURF_API_KEY")
    return {
        "api_key_loaded": bool(api_key),
        "api_key_length": len(api_key) if api_key else 0,
        "api_key_prefix": api_key[:10] + "..." if api_key else "Not found"
    }
@app.post("/generate-audio")
async def generate_audio(input: TextInput):
    res = client.text_to_speech.generate(
        text=input.text,
        voice_id="en-US-terrell"
    )
    return {
        "success": True,
        "text": input.text,
        "audio_url": res.audio_file
    }


