# Voice Agent - Real-Time Conversation System

A voice-based conversation application built with FastAPI that supports both traditional file upload and real-time streaming conversations. The system integrates speech recognition, AI language models, and text-to-speech services to create a complete voice interaction experience.

## 📖 Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [API Endpoints](#api-endpoints)
- [How It Works](#how-it-works)
- [Technical Details](#technical-details)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Dependencies](#dependencies)
- [Development](#development)
- [Live Demo](#-live-demo)
- [Screenshots & Demo](#-screenshots--demo)
- [Technologies Used](#️-technologies-used)
- [Usage Examples](#-usage-examples)
- [Credits & Acknowledgments](#-credits--acknowledgments)
- [License](#-license)

## Features

### Core Functionality

- **Speech Recognition**: Convert audio to text using AssemblyAI
- **AI Conversations**: Generate responses using Google Gemini
- **Text-to-Speech**: Convert AI responses to audio using Murf AI with multi-voice support
- **Weather Integration**: Real-time weather information via OpenWeatherMap API
- **Session Management**: Persistent conversation history across sessions
- **Real-time Chat History**: Live updates to conversation display without page refresh
- **Modal View**: Click on any conversation to view it in a detailed popup modal

### Interaction Modes

- **File Upload Mode**: Upload audio files for processing
- **Real-time Streaming Mode**: Live audio streaming with instant processing
- **WebSocket Communication**: Real-time bidirectional communication
- **Database Storage**: Conversation persistence with MongoDB or in-memory fallback

### User Interface

- **Dual Interface**: Traditional upload and streaming controls
- **Live Status Updates**: Real-time connection and processing status
- **Chat History Panel**: Collapsible conversation history view
- **Audio Playback**: Built-in audio player for generated responses
- **Session Tracking**: Unique session IDs for conversation continuity

## Project Structure

```
├── main.py                           # FastAPI application with all endpoints
├── services/                         # Service integrations
│   ├── assemblyai_streaming_service.py    # Real-time speech recognition
│   ├── llm_service.py                     # Google Gemini integration
│   ├── murf_websocket_service.py          # Real-time text-to-speech
│   ├── stt_service.py                     # File-based speech recognition
│   ├── tts_service.py                     # Traditional TTS processing
│   └── database_service.py               # MongoDB operations
├── models/
│   └── schemas.py                    # Data models and validation
├── static/
│   ├── app.js                        # Frontend JavaScript logic
│   └── style.css                     # Application styling
├── templates/
│   └── index.html                    # Main application interface
├── utils/                            # Utilities
│   ├── constants.py                  # Application constants
│   ├── json_utils.py                 # JSON processing utilities
│   └── logging_config.py             # Logging configuration
└── streamed_audio/                   # Saved audio files from streaming sessions
```

## Setup Instructions

### Prerequisites

- Python 3.7+
- Web browser with microphone support
- MongoDB (optional - uses in-memory storage as fallback)

### Required API Keys

Create a `.env` file with the following:

```
GEMINI_API_KEY=your_google_gemini_api_key
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
MURF_API_KEY=your_murf_api_key
MURF_VOICE_ID=en-IN-aarav
MONGODB_URL=your_mongodb_connection_string
OPENWEATHER_API_KEY=your_openweather_api_key
```

### Installation

1. Clone the repository
2. Install dependencies: `pip install -r requirements.txt`
3. Create the `.env` file with your API keys
4. Run the application: `python main.py`
5. Open your browser to `http://127.0.0.1:8000`

## API Endpoints

### Web Interface

- `GET /` - Main application interface

### Chat API

- `POST /agent/chat/{session_id}` - Process uploaded audio file
- `GET /agent/chat/{session_id}/history` - Get conversation history
- `DELETE /agent/chat/{session_id}/history` - Clear session history

### WebSocket

- `ws://localhost:8000/ws/audio-stream` - Real-time audio streaming

### System

- `GET /api/backend` - Backend status check

## How It Works

### Traditional Mode

1. User uploads an audio file
2. System transcribes audio using AssemblyAI
3. AI generates response using Google Gemini
4. Response is converted to speech using Murf AI
5. Conversation is saved to database
6. Audio response is returned to user

### Streaming Mode

1. User connects via WebSocket
2. Browser captures live audio from microphone
3. Audio is streamed in real-time to AssemblyAI
4. Transcribed text triggers AI response generation
5. AI response streams back to user in real-time
6. Response is converted to audio using Murf WebSocket
7. Audio chunks are played as they arrive
8. Complete conversation is saved to database immediately

### Real-time Updates

- User messages appear in chat history when spoken
- AI responses update character by character as generated
- Database saves responses immediately when complete
- No page refresh needed for chat history updates
- Modal popup shows full conversation details on click

## Technical Details

### Audio Configuration

- Sample Rate: 16kHz
- Format: PCM (Pulse Code Modulation)
- Channels: Mono
- Chunk Size: 4096 samples

### Database Schema

- Sessions tracked by unique session IDs
- Messages stored with role (user/assistant), content, and timestamp
- Fallback to in-memory storage if MongoDB unavailable
- Session metadata includes message count and activity tracking

### Error Handling

- Graceful degradation when services are unavailable
- Fallback audio messages for errors
- Connection retry logic for WebSocket streams
- Comprehensive logging for debugging

## Configuration

### Environment Variables

- `GEMINI_API_KEY` - Google Gemini API access
- `ASSEMBLYAI_API_KEY` - AssemblyAI speech recognition
- `MURF_API_KEY` - Murf text-to-speech
- `MURF_VOICE_ID` - Voice selection (default: en-IN-aarav)
- `MONGODB_URL` - Database connection string
- `OPENWEATHER_API_KEY` - Weather data integration (optional)

### Audio Settings

The application automatically configures optimal audio settings for real-time processing. Manual configuration is available in the frontend JavaScript for specific use cases.

## Troubleshooting

### Common Issues

- **Microphone not working**: Check browser permissions and system settings
- **API errors**: Verify API keys are correctly set in `.env` file
- **Connection issues**: Ensure all required services are accessible
- **Audio playback problems**: Check browser Web Audio API support

### Logging

Application logs are written to `voice_agent.log` with detailed information about:

- Service initialization status
- WebSocket connection events
- API call success/failure
- Audio processing metrics
- Database operations

## Dependencies

### Backend

- FastAPI - Web framework
- Uvicorn - ASGI server
- Motor - Async MongoDB driver
- Google Generative AI - Language model
- WebSockets - Real-time communication

### Frontend

- Vanilla JavaScript - No frameworks
- Web Audio API - Audio processing
- WebSocket API - Real-time communication
- Marked.js - Markdown rendering (optional)
- Highlight.js - Code syntax highlighting (optional)

## Development

### Running in Development

```bash
python main.py
```

This starts the server with auto-reload enabled for development.

### Project Structure Notes

- All service integrations are modular and can be swapped
- Frontend uses vanilla JavaScript for maximum compatibility
- Error handling includes fallback options for all external services
- Session management works with or without database connectivity

## 🚀 Live Demo

🎯 **Try the live voice agent now:** [https://three0-days-of-voice-agent-53lt.onrender.com/](https://three0-days-of-voice-agent-53lt.onrender.com/)

> **Note**: The demo is hosted on Render's free tier, so it may take a moment to wake up if it's been idle. Please allow microphone access for the best experience!

## 📸 Screenshots & Demo

<img width="1916" height="961" alt="Screenshot 2025-08-30 072730" src="https://github.com/user-attachments/assets/f3f513c7-8f95-4e70-bfc6-9d97272130e5" />

<img width="1863" height="860" alt="Screenshot 2025-08-28 205427" src="https://github.com/user-attachments/assets/fd8c7a8b-336e-4664-9fc7-3e6b9300ac7e" />



## 🛠️ Technologies Used

### Backend Technologies

- **FastAPI** - Modern, fast web framework for building APIs
- **Python 3.7+** - Core programming language
- **Uvicorn** - Lightning-fast ASGI server
- **WebSockets** - Real-time bidirectional communication
- **Motor** - Async MongoDB driver for database operations

### AI & Voice Services

- **Google Gemini** - Advanced language model for AI conversations
- **AssemblyAI** - Real-time speech recognition and transcription
- **Murf AI** - High-quality text-to-speech with multiple voice options
- **OpenWeatherMap** - Real-time weather data integration

### Frontend Technologies

- **Vanilla JavaScript** - No framework dependencies for maximum compatibility
- **Web Audio API** - Real-time audio processing and recording
- **WebSocket API** - Client-side real-time communication
- **HTML5 & CSS3** - Modern web interface

### Database & Storage

- **MongoDB** - Primary database for conversation persistence
- **In-memory Storage** - Fallback option when MongoDB is unavailable

### Development Tools

- **Python-dotenv** - Environment variable management
- **Pydantic** - Data validation and settings management
- **Logging** - Comprehensive application logging

## 📚 Usage Examples

### Basic Voice Interaction

1. Open the application in your browser
2. Click "Start Recording" to begin voice input
3. Speak your message or question
4. The AI will respond with both text and voice
5. View conversation history in the chat panel

### Weather Queries

Ask natural language questions like:

- "What's the weather in New York?"
- "How's the weather today in London?"
- "Is it raining in Tokyo?"

### Multi-Voice Support

Configure different voices by updating the `MURF_VOICE_ID` in your `.env` file:

- `en-IN-aarav` (Default - Indian English Male)
- `en-US-amara` (US English Female)
- And many more available through Murf AI

## 🏆 Credits & Acknowledgments

This project is part of the **#30DaysOfVoiceAgents** challenge, exploring cutting-edge voice AI technologies and real-time conversation systems.

### Special Thanks

- **AssemblyAI** for excellent speech recognition capabilities
- **Google Gemini** for powerful language model integration
- **Murf AI** for high-quality text-to-speech services
- **The Voice AI Community** for inspiration and support

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### MIT License Summary

- ✅ Commercial use
- ✅ Modification
- ✅ Distribution
- ✅ Private use
- ❌ Liability
- ❌ Warranty

---

**Built with ❤️ for the #30DaysOfVoiceAgents Challenge**
