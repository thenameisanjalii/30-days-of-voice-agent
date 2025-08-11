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

# os.makedirs("uploads", exist_ok=True)

@app.get("/")
async def serve_ui():
    return FileResponse("templates/index.html")  

# @app.post("/upload-audio")
# async def upload_audio(file: UploadFile = File(...)):
#     # Save file to uploads folder
#     file_path = f"uploads/{file.filename}"
#     with open(file_path, "wb") as buffer:
#         shutil.copyfileobj(file.file, buffer)
    
#     # Get file size
#     file_size = os.path.getsize(file_path)
    
#     return {
#         "success": True,
#         "filename": file.filename,
#         "content_type": file.content_type,
#         "size": file_size,
#         "message": "Audio uploaded successfully!"
#     }

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

# @app.post("/transcribe/file")
# async def transcribe_file(file: UploadFile = File(...)):
#     transcriber = aai.Transcriber()
#     audio_data = await file.read()
#     transcript = transcriber.transcribe(audio_data)
    
#     return {
#         "success": True,
#         "transcription": transcript.text
#     }

# @app.post("/tts/echo")
# async def tts_echo(file: UploadFile = File(...)):
#     # Transcribe audio
#     transcriber = aai.Transcriber()
#     audio_data = await file.read()
#     transcript = transcriber.transcribe(audio_data)
    
#     # Generate Murf audio
#     res = client.text_to_speech.generate(
#         text=transcript.text,
#         voice_id="en-US-terrell"
#     )
    
#     return {
#         "success": True,
#         "transcription": transcript.text,
#         "audio_url": res.audio_file
#     }

class LLMInput(BaseModel):
    text: str

# @app.post("/llm/query")
# async def llm_query(file: UploadFile = File(...)):
#     # Transcribe audio
#     transcriber = aai.Transcriber()
#     audio_data = await file.read()
#     transcript = transcriber.transcribe(audio_data)
    
#     # Get LLM response
#     model = genai.GenerativeModel("gemini-1.5-flash")
#     llm_response = model.generate_content(transcript.text)
#     llm_text = llm_response.text[:3000]  # Murf API limit
    
#     # Generate Murf audio
#     res = client.text_to_speech.generate(
#         text=llm_text,
#         voice_id="en-US-terrell"
#     )
    
#     return {
#         "success": True,
#         "transcription": transcript.text,
#         "llm_response": llm_text,
#         "audio_url": res.audio_file
#     }

@app.post("/agent/chat/{session_id}")
async def agent_chat(session_id: str, file: UploadFile = File(...)):
    # Transcribe audio
    transcriber = aai.Transcriber()
    audio_data = await file.read()
    transcript = transcriber.transcribe(audio_data)
    
    # Get previous history
    history = chat_history.get(session_id, [])
    history.append({"role": "user", "content": transcript.text})
    
    # Prepare messages for LLM
    # Build prompt as a conversation, but only ask for the next bot reply
    conversation = ""
    for msg in history:
        if msg["role"] == "user":
            conversation += f"You: {msg['content']}\n"
        else:
            conversation += f"Bot: {msg['content']}\n"
    prompt = conversation + "Bot:"

    model = genai.GenerativeModel("gemini-1.5-flash")
    llm_response = model.generate_content(prompt)
    llm_text = llm_response.text[:3000]
    history.append({"role": "bot", "content": llm_text})
    
    # Save history
    chat_history[session_id] = history
    
    # Generate Murf audio
    res = client.text_to_speech.generate(
        text=llm_text,
        voice_id="en-US-terrell"
    )
    
    return {
        "success": True,
        "transcription": transcript.text,
        "llm_response": llm_text,
        "audio_url": res.audio_file,
        "history": history
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)  


