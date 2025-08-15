# 🤖 AI Voice Agent - 30 Days Challenge

An intelligent conversational AI voice agent built with FastAPI, featuring real-time speech-to-text, AI-powered responses, and natural text-to-speech capabilities.

## 🚀 Project Overview

This project is a complete voice-enabled conversational AI agent developed as part of the 30 Days of Voice Agents challenge. Users can speak naturally to the agent, which processes their speech, generates intelligent responses using Google's Gemini AI, and responds back with human-like voice synthesis.

## ✨ Features

- 🎤 **Real-time Voice Recording** - Browser-based audio capture
- 🎯 **Speech-to-Text** - Accurate transcription using AssemblyAI
- 🧠 **AI Conversations** - Intelligent responses powered by Google Gemini
- 🔊 **Text-to-Speech** - Natural voice synthesis with Murf AI
- 💬 **Chat History** - Session-based conversation memory
- 🛡️ **Error Handling** - Robust fallback mechanisms for all APIs
- 📱 **Modern UI** - Clean, responsive interface with animations
- ⚡ **Real-time Processing** - Seamless conversation flow

## 🛠️ Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **AssemblyAI** - Speech-to-text processing
- **Google Gemini AI** - Large language model for responses
- **Murf AI** - High-quality text-to-speech synthesis

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with animations
- **Vanilla JavaScript** - Client-side logic and API integration

## 🏗️ Architecture

```
User Voice Input → AssemblyAI (STT) → Gemini AI (LLM) → Murf AI (TTS) → Audio Response
                                    ↓
                              Chat History Storage
```

## 📋 Setup Instructions

### Prerequisites
- Python 3.8+
- Modern web browser with microphone access
- API keys for AssemblyAI, Gemini AI, and Murf AI

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd murf-ai-voice-agent
```

2. **Create virtual environment**
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate
```

3. **Install dependencies**
```bash
pip install fastapi uvicorn python-dotenv murf assemblyai google-generativeai python-multipart
```

4. **Create `.env` file**
```env
MURF_API_KEY=your_murf_api_key_here
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

5. **Run the application**
```bash
python app.py
```

6. **Access the application**
- Main Interface: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## 🎯 Usage

1. **Open the application** in your web browser
2. **Click "Start Recording"** to begin speaking
3. **Speak your message** naturally
4. **Click "Stop Recording"** when finished
5. **Wait for the AI response** - it will be played automatically
6. **Continue the conversation** by recording another message

## 📱 API Endpoints

- `GET /` - Serve the main interface
- `POST /agent/chat/{session_id}` - Process voice input and generate response
- `POST /generate-audio` - Convert text to speech
- `POST /transcribe/file` - Transcribe audio to text

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MURF_API_KEY` | Murf AI API key for text-to-speech | ✅ |
| `ASSEMBLYAI_API_KEY` | AssemblyAI API key for speech-to-text | ✅ |
| `GEMINI_API_KEY` | Google Gemini API key for AI responses | ✅ |

### Browser Requirements
- Microphone access permission
- Modern browser (Chrome, Firefox, Safari, Edge)
- HTTPS connection (for production deployment)

## 🛡️ Error Handling

The application includes comprehensive error handling for:
- **STT Errors**: "Sorry, I couldn't understand your speech. Please try again."
- **LLM Errors**: "I'm having trouble generating a response right now."
- **TTS Errors**: "Sorry, I can't speak right now due to a technical issue."
- **General Errors**: Graceful fallbacks with user-friendly messages

## 🎨 UI Features

- **Single-button Interface** - Combined start/stop recording
- **Animated Recording State** - Visual feedback during recording
- **Chat History Display** - Real-time conversation updates
- **Responsive Design** - Works on desktop and mobile
- **Modern Styling** - Clean gradients and smooth transitions

## 📈 Challenge Progress

- ✅ **Day 1-2:** FastAPI setup and Murf TTS integration
- ✅ **Day 3-4:** AssemblyAI STT integration
- ✅ **Day 5-6:** File upload and audio processing
- ✅ **Day 7-8:** Echo bot functionality
- ✅ **Day 9:** LLM integration with Gemini AI
- ✅ **Day 10:** Chat history and conversation context
- ✅ **Day 11:** Comprehensive error handling
- ✅ **Day 12:** UI/UX improvements and animations
- ✅ **Day 13:** Documentation and project completion

## 🤝 Contributing

This project was built as part of a learning challenge. Feel free to fork and experiment!

## 📝 License

MIT License - Feel free to use this code for your own projects.

---

**Built with ❤️ as part of the 30 Days of Voice Agents Challenge**