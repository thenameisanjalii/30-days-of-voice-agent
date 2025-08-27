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
            # Clean and format the location
            location = location.strip()
            
            # Try different location formats for better API success
            location_variants = []
            
            # Add original location
            location_variants.append(location)
            
            # Remove commas and extra spaces
            clean_location = " ".join(location.replace(",", " ").split())
            if clean_location != location:
                location_variants.append(clean_location)
            
            # Try with proper capitalization (Title Case)
            title_case_location = location.title()
            if title_case_location != location:
                location_variants.append(title_case_location)
            
            # If location contains "india", try with country code
            if "india" in location.lower():
                city_part = location.lower().replace("india", "").replace(",", "").strip()
                if city_part:
                    location_variants.append(f"{city_part},IN")
                    location_variants.append(city_part)
            
            # For single word locations, try with common country codes
            if " " not in location.strip() and len(location.strip()) > 2:
                single_word = location.strip()
                # Try with major country codes
                location_variants.extend([
                    f"{single_word},US",  # United States
                    f"{single_word},IN",  # India
                    f"{single_word},GB",  # United Kingdom
                    f"{single_word},CA",  # Canada
                    f"{single_word},AU",  # Australia
                    f"{single_word},DE",  # Germany
                    f"{single_word},FR",  # France
                    f"{single_word},JP",  # Japan
                    f"{single_word},CN",  # China
                    f"{single_word},BR",  # Brazil
                ])
            
            # Try just the first word/city name
            first_word = location.split()[0] if location.split() else location
            if first_word != location and len(first_word) > 2:
                location_variants.append(first_word)
                location_variants.append(first_word.title())
            
            # Remove duplicates while preserving order
            seen = set()
            unique_variants = []
            for variant in location_variants:
                if variant.lower() not in seen:
                    seen.add(variant.lower())
                    unique_variants.append(variant)
            
            logger.info(f"Trying weather API for location variants: {unique_variants}")
            
            for loc_variant in unique_variants:
                if not loc_variant or len(loc_variant) < 2:
                    continue
                    
                params = {
                    "q": loc_variant,
                    "appid": self.api_key,
                    "units": "metric"
                }
                
                logger.info(f"Trying weather API call for location: '{loc_variant}'")
                
                # Use asyncio to run requests in a thread pool to avoid blocking
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None, 
                    lambda p=params: requests.get(self.base_url, params=p, timeout=10)
                )
                
                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"Weather API success for location: '{loc_variant}'")
                    return self._parse_weather_data(data)
                elif response.status_code == 404:
                    logger.warning(f"Location not found: '{loc_variant}', trying next variant...")
                    continue
                else:
                    logger.error(f"Weather API error for '{loc_variant}': {response.status_code}")
                    continue
            
            # If all variants failed
            logger.warning(f"All location variants failed for: {location}")
            return {
                "success": False,
                "error": "location_not_found",
                "message": f"Sorry, I couldn't find the weather for '{location}'. Please check the spelling or try a different location format."
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
        original_text = text.strip()
        
        # Remove common weather question words and patterns
        remove_patterns = [
            "tell me", "what's", "what is", "whats", "how's", "how is", "hows",
            "can you tell me", "please tell me", "i want to know", "i would like to know",
            "the", "about", "of", "for", "in", "at", "?"
        ]
        
        # Common patterns for weather queries
        weather_patterns = [
            r"weather\s+(?:in|for|at|of)\s+(.+)",
            r"temperature\s+(?:in|for|at|of)\s+(.+)", 
            r"temp\s+(?:in|for|at|of)\s+(.+)",
            r"forecast\s+(?:in|for|at|of)\s+(.+)",
            r"(?:what's|what\s+is|whats)\s+the\s+weather\s+(?:in|for|at|of)\s+(.+)",
            r"(?:tell\s+me\s+)?(?:what's|what\s+is|whats)\s+the\s+weather\s+(?:in|for|at|of)\s+(.+)",
            r"(?:how's|how\s+is|hows)\s+the\s+weather\s+(?:in|for|at|of)\s+(.+)"
        ]
        
        import re
        
        # Try to match against weather patterns
        for pattern in weather_patterns:
            match = re.search(pattern, text_lower)
            if match:
                location = match.group(1).strip()
                # Clean up the location
                location = re.sub(r'[?.,!]+$', '', location)  # Remove trailing punctuation
                location = location.strip()
                if location:
                    return location
        
        # Fallback: look for location after common weather keywords
        simple_patterns = [
            "weather in ",
            "weather for ",
            "weather at ",
            "weather of ",
            "temperature in ",
            "temperature for ",
            "temperature at ",
            "temperature of ",
            "forecast for ",
            "forecast in ",
            "forecast at ",
            "forecast of ",
            "temp in ",
            "temp for ",
            "temp at ",
            "temp of "
        ]
        
        for pattern in simple_patterns:
            if pattern in text_lower:
                # Extract text after the pattern
                start_idx = text_lower.find(pattern) + len(pattern)
                location = original_text[start_idx:].strip()
                
                # Clean up the location (remove common endings but keep full location)
                location = re.sub(r'[?.,!]+$', '', location)  # Remove trailing punctuation
                location = location.strip()
                
                if location:
                    return location
        
        # Final fallback: look for "in [location]" anywhere in the text
        words = original_text.split()
        for i, word in enumerate(words):
            if word.lower() in ["in", "for", "at", "of"] and i < len(words) - 1:
                # Take everything after the preposition
                location = " ".join(words[i+1:])
                location = re.sub(r'[?.,!]+$', '', location)  # Remove trailing punctuation
                location = location.strip()
                if location:
                    return location
        
        return None
