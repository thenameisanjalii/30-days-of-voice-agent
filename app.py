from fastapi import FastAPI , UploadFile, File
import shutil
from pydantic import BaseModel
import os
from murf import Murf
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import assemblyai as aai
import google.generativeai as genai

chat_history = {}

load_dotenv()
aai.settings.api_key = os.getenv("ASSEMBLYAI_API_KEY")
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
client = Murf(api_key=os.getenv("MURF_API_KEY"))

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

class TextInput(BaseModel):
    text: str


@app.get("/")
async def serve_ui():
    return FileResponse("templates/index.html")  

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

class LLMInput(BaseModel):
    text: str

@app.post("/agent/chat/{session_id}")
async def agent_chat(session_id: str, file: UploadFile = File(...)):
    try:
        # STT Error Handling
        try:
            transcriber = aai.Transcriber()
            audio_data = await file.read()
            transcript = transcriber.transcribe(audio_data)
            if not transcript.text or not transcript.text.strip():
                raise Exception("No speech detected.")
        except Exception:
            fallback_text = "I'm sorry, I couldn't understand your speech. Please try again."
            res = client.text_to_speech.generate(text=fallback_text, voice_id="en-US-terrell")
            return {
                "success": False,
                "error": "STT Error",
                "llm_response": fallback_text,
                "audio_url": res.audio_file,
                "history": chat_history.get(session_id, [])
            }

        history = chat_history.get(session_id, [])
        history.append({"role": "user", "content": transcript.text})
        conversation = ""
        for msg in history:
            if msg["role"] == "user":
                conversation += f"You: {msg['content']}\n"
            else:
                conversation += f"Bot: {msg['content']}\n"
        prompt = conversation + "Bot:"

        # LLM Error Handling
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            llm_response = model.generate_content(prompt)
            llm_text = llm_response.text[:3000]
        except Exception:
            fallback_text = "I'm having trouble generating a response right now. Please try again in a moment."
            res = client.text_to_speech.generate(text=fallback_text, voice_id="en-US-terrell")
            return {
                "success": False,
                "error": "LLM Error",
                "llm_response": fallback_text,
                "audio_url": res.audio_file,
                "history": history
            }

        history.append({"role": "bot", "content": llm_text})
        chat_history[session_id] = history

        # TTS Error Handling
        try:
            res = client.text_to_speech.generate(text=llm_text, voice_id="en-US-terrell")
        except Exception:
            fallback_text = "Sorry, I can't speak right now due to a technical issue. Please try again later."
            # Only try to generate fallback audio if Murf API key exists
            if os.getenv("MURF_API_KEY"):
                try:
                    res = client.text_to_speech.generate(text=fallback_text, voice_id="en-US-terrell")
                    audio_url = res.audio_file
                except Exception:
                    audio_url = ""
            else:
                audio_url = ""
            return {
                "success": False,
                "error": "TTS Error",
                "llm_response": fallback_text,
                "audio_url": audio_url,
                "history": history
            }

        # return statement for successful case:
        return {
            "success": True,
            "transcription": transcript.text,
            "llm_response": llm_text,
            "audio_url": res.audio_file,
            "history": history
        }
    except Exception as e:
        fallback_text = "Something went wrong. Please try again later."
        try:
            res = client.text_to_speech.generate(text=fallback_text, voice_id="en-US-terrell")
            audio_url = res.audio_file
        except Exception:
            audio_url = ""
        return {
            "success": False,
            "error": str(e),
            "llm_response": fallback_text,
            "audio_url": audio_url,
            "history": chat_history.get(session_id, [])
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)  


