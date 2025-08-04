from fastapi import FastAPI
from pydantic import BaseModel
import os
from murf import Murf
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

load_dotenv()

client = Murf(api_key=os.getenv("MURF_API_KEY"))

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

class TextInput(BaseModel):
    text: str

@app.get("/")
async def serve_ui():
    return FileResponse("templates/index.html")  # Changed from "static/index.html"

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)  # Remove reload=True
