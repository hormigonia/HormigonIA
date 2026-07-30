import os
import requests
from dotenv import load_dotenv
from typing import List, Dict, Any

# Load environment variables
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

def call_groq_api(messages: List[Dict[str, str]]) -> str:
    """
    Calls the Groq API with a list of messages.
    """
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": 0.3
    }
    
    res = requests.post(url, json=payload, headers=headers, timeout=30)
    res.raise_for_status()
    data = res.json()
    
    choices = data.get("choices", [])
    if choices:
        return choices[0].get("message", {}).get("content", "")
        
    return "❌ Error: La respuesta de Groq no contiene elecciones de chat válidas."

def call_gemini_api(messages: List[Dict[str, str]]) -> str:
    """
    Translates standard chat messages to Gemini's API format and calls Gemini.
    """
    system_instruction = None
    contents = []
    
    for msg in messages:
        role = msg.get("role")
        content = msg.get("content", "")
        
        if role == "system":
            system_instruction = {
                "parts": [{"text": content}]
            }
        elif role == "user":
            contents.append({
                "role": "user",
                "parts": [{"text": content}]
            })
        elif role in ["assistant", "model"]:
            contents.append({
                "role": "model",
                "parts": [{"text": content}]
            })
            
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": contents
    }
    if system_instruction:
        payload["systemInstruction"] = system_instruction
        
    headers = {
        "Content-Type": "application/json"
    }
    
    res = requests.post(url, json=payload, headers=headers, timeout=30)
    res.raise_for_status()
    data = res.json()
    
    candidates = data.get("candidates", [])
    if candidates:
        parts = candidates[0].get("content", {}).get("parts", [])
        if parts:
            return parts[0].get("text", "")
            
    return "❌ Error: La respuesta de Gemini no contiene datos legibles."

def call_ai_api(messages: List[Dict[str, str]]) -> str:
    """
    Routes chat completion request to Groq (primary) or Gemini (fallback).
    """
    # 1. Try Groq first if key exists and is not a placeholder
    if GROQ_API_KEY and "placeholder" not in GROQ_API_KEY.lower() and GROQ_API_KEY.strip() != "":
        try:
            return call_groq_api(messages)
        except Exception as e:
            raise RuntimeError(f"Error al llamar a la API de Groq: {str(e)}")
            
    # 2. Fallback to Gemini if key exists and is not a placeholder
    if GEMINI_API_KEY and "placeholder" not in GEMINI_API_KEY.lower() and GEMINI_API_KEY.strip() != "":
        try:
            return call_gemini_api(messages)
        except Exception as e:
            raise RuntimeError(f"Error al llamar a la API de Gemini: {str(e)}")
            
    # 3. No keys configured
    raise ValueError(
        "No se detectó una API Key válida para Groq (GROQ_API_KEY) ni para Gemini (GEMINI_API_KEY) en las variables de entorno.\n"
        "Por favor, configure sus credenciales en el archivo '.env' del backend o '.env.local' en la raíz del proyecto."
    )
