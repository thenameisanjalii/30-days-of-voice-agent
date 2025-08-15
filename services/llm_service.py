# services/llm_service.py
import google.generativeai as genai
import os
import logging
from typing import List, Dict

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel("gemini-1.5-flash")
    
    async def generate_response(self, history: List[Dict[str, str]]) -> str:
        try:
            conversation = ""
            for msg in history:
                if msg["role"] == "user":
                    conversation += f"You: {msg['content']}\n"
                else:
                    conversation += f"Bot: {msg['content']}\n"
            
            prompt = conversation + "Bot:"
            response = self.model.generate_content(prompt)
            logger.info("LLM response generated successfully")
            return response.text[:3000]
        except Exception as e:
            logger.error(f"LLM Error: {str(e)}")
            raise Exception("I'm having trouble generating a response right now. Please try again in a moment.")