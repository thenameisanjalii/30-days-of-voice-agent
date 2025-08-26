import requests
import json
import asyncio
from typing import Dict, Any, Optional
from utils.logging_config import get_logger

logger = get_logger(__name__)

class WeatherService:
    def __init__(self, api_key: str):
        """Initialize Weather Service with OpenWeatherMap API key"""
        self.api_key = api_key
        self.base_url = "https://api.openweathermap.org/data/2.5/weather"
        
    async def get_weather(self, location: str) -> Dict[str, Any]:
        """
        Get weather information for a given location
        
        Args:
            location (str): City name or location query
            
        Returns:
            Dict containing weather data or error information
        """
        try:
            params = {
                "q": location,
                "appid": self.api_key,
                "units": "metric"
            }
            
            # Use asyncio to run requests in a thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, 
                lambda: requests.get(self.base_url, params=params, timeout=10)
            )
            
            if response.status_code == 200:
                data = response.json()
                return self._parse_weather_data(data)
            elif response.status_code == 404:
                logger.warning(f"Location not found: {location}")
                return {
                    "success": False,
                    "error": "location_not_found",
                    "message": f"Sorry, I couldn't find the weather for '{location}'. Please check the spelling or try a different location."
                }
            else:
                logger.error(f"Weather API error: {response.status_code}")
                return {
                    "success": False,
                    "error": "api_error",
                    "message": "Sorry, I'm having trouble getting the weather information right now. Please try again later."
                }
                        
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error getting weather: {str(e)}")
            return {
                "success": False,
                "error": "network_error",
                "message": "Sorry, I'm having trouble connecting to the weather service. Please check your internet connection."
            }
        except Exception as e:
            logger.error(f"Unexpected error getting weather: {str(e)}")
            return {
                "success": False,
                "error": "unexpected_error",
                "message": "Sorry, something went wrong while getting the weather information."
            }
    
    def _parse_weather_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse and format weather data from OpenWeatherMap API response"""
        try:
            location = f"{data['name']}, {data['sys']['country']}"
            temperature = round(data['main']['temp'])
            feels_like = round(data['main']['feels_like'])
            description = data['weather'][0]['description'].title()
            humidity = data['main']['humidity']
            pressure = data['main']['pressure']
            wind_speed = data.get('wind', {}).get('speed', 0)
            
            # Create a user-friendly weather report
            weather_report = f"Current weather in {location}:\n"
            weather_report += f"🌡️ Temperature: {temperature}°C (feels like {feels_like}°C)\n"
            weather_report += f"🌤️ Conditions: {description}\n"
            weather_report += f"💧 Humidity: {humidity}%\n"
            weather_report += f"🌬️ Wind Speed: {wind_speed} m/s\n"
            weather_report += f"📊 Pressure: {pressure} hPa"
            
            return {
                "success": True,
                "location": location,
                "temperature": temperature,
                "feels_like": feels_like,
                "description": description,
                "humidity": humidity,
                "pressure": pressure,
                "wind_speed": wind_speed,
                "weather_report": weather_report,
                "raw_data": data
            }
            
        except KeyError as e:
            logger.error(f"Error parsing weather data: missing key {str(e)}")
            return {
                "success": False,
                "error": "parsing_error",
                "message": "Sorry, I received incomplete weather data. Please try again."
            }
        except Exception as e:
            logger.error(f"Error parsing weather data: {str(e)}")
            return {
                "success": False,
                "error": "parsing_error",
                "message": "Sorry, I had trouble processing the weather data."
            }
    
    def is_weather_query(self, text: str) -> bool:
        """
        Check if a text query is asking for weather information
        
        Args:
            text (str): User input text
            
        Returns:
            bool: True if the text appears to be asking for weather
        """
        weather_keywords = [
            "weather", "temperature", "temp", "forecast", "rain", "sunny", "cloudy",
            "hot", "cold", "warm", "cool", "humidity", "wind", "storm", "snow",
            "what's the weather", "how's the weather", "weather like", "weather in",
            "weather for", "temperature in", "is it raining", "is it sunny"
        ]
        
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in weather_keywords)
    
    def extract_location_from_query(self, text: str) -> Optional[str]:
        """
        Extract location from weather query
        
        Args:
            text (str): User input text
            
        Returns:
            Optional[str]: Extracted location or None
        """
        text_lower = text.lower()
        
        # Common patterns for weather queries
        patterns = [
            "weather in ",
            "weather for ",
            "temperature in ",
            "temperature for ",
            "forecast for ",
            "forecast in ",
            "weather at ",
            "temp in ",
            "temp for "
        ]
        
        for pattern in patterns:
            if pattern in text_lower:
                # Extract text after the pattern
                start_idx = text_lower.find(pattern) + len(pattern)
                location = text[start_idx:].strip()
                
                # Clean up the location (remove common endings)
                location = location.split('?')[0].strip()  # Remove question marks
                location = location.split('.')[0].strip()  # Remove periods
                location = location.split(',')[0].strip()  # Take first part if comma-separated
                
                if location:
                    return location
        
        # If no pattern found, check for location keywords at the end
        words = text.split()
        if len(words) >= 2:
            # Look for "in [location]" or "for [location]" patterns
            for i, word in enumerate(words[:-1]):
                if word.lower() in ["in", "for", "at"] and i < len(words) - 1:
                    return " ".join(words[i+1:])
        
        return None
