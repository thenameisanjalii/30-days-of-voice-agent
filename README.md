# 🎤 30 Days of Voice Agents Challenge

A FastAPI-based voice agent application using Murf AI's text-to-speech API.

## 🚀 Project Progress

- ✅ **Day 1:** Project Setup - FastAPI backend with frontend
- ✅ **Day 2:** REST TTS API Integration - Murf AI text-to-speech endpoint

## 🛠️ Tech Stack

- **Backend:** FastAPI (Python)
- **TTS Service:** Murf AI
- **Frontend:** HTML5, CSS3, JavaScript
- **Environment:** Python virtual environment

## 📋 Setup Instructions

1. Clone the repository
```bash
git clone https://github.com/yourusername/voice-agent-30-days.git
cd voice-agent-30-days
```

2. Create virtual environment
```bash
python -m venv venv
venv\Scripts\activate
```

3. Install dependencies
```bash
pip install fastapi uvicorn python-dotenv murf
```

4. Create `.env` file with your Murf API key
```
MURF_API_KEY=your_api_key_here
```

5. Run the application
```bash
uvicorn app:app --reload
```

6. Access the application
- API Documentation: http://127.0.0.1:8000/docs
- Test Endpoint: http://127.0.0.1:8000/test-config

## 🎯 Features

- REST API endpoint for text-to-speech conversion
- Murf AI integration for high-quality voice generation
- FastAPI automatic documentation
- Environment variable configuration
- Professional error handling

## 📱 API Endpoints

- `GET /` - API status check
- `GET /test-config` - Verify API key configuration
- `POST /generate-audio` - Convert text to speech

## 🔗 Challenge Details

This project is part of the 30 Days of Voice Agents challenge, building progressively complex voice AI applications.

## 📝 License

MIT License