import os
import requests
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

def call_gemini_api(prompt_text: str) -> str:
    """
    Sends prompt to Google's Gemini API serverless backend and returns clean Markdown output.
    """
    if not GEMINI_API_KEY:
        raise ValueError("La API Key de Gemini no está configurada en las variables de entorno (.env) del servidor backend.")
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt_text}
                ]
            }
        ]
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        res = requests.post(url, json=payload, headers=headers, timeout=30)
        res.raise_for_status()
        data = res.json()
        
        # Parse output text from response schema
        candidates = data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            if parts:
                return parts[0].get("text", "")
                
        return "❌ Error: La respuesta de Gemini no contiene datos legibles."
        
    except Exception as e:
        raise RuntimeError(f"Error al llamar a Gemini AI: {str(e)}")
