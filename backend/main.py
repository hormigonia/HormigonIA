import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

# Load environment variables
load_dotenv()
load_dotenv(".env.local")
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from backend.dosificador import dosificar_mezcla, calcular_reologia_y_perdida, calcular_correcciones_reologia, recalcular_formula_validada, predecir_resistencia_ia, optimizar_mezcla_ia
from backend.clima import fetch_weather_and_curing
from backend.gemini import call_gemini_api

app = FastAPI(title="HormigónMix AI Backend", version="1.0.0")

# Enable CORS for frontend compatibility (including file:// protocol)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic schemas
class DosificacionRequest(BaseModel):
    sieveSizes: List[float]
    sandPassing: List[float]
    gravillaPassing: List[float]
    gravaPassing: List[float]
    numAggregates: int
    designMethod: str
    splitSieveSize: float
    maxSieveSizeD: float
    bolomeyA: float
    gravillaRatio: float
    gravaRatio: float
    concreteClass: str
    batchVolume: float
    targetWC: float
    airPct: float
    densCement: float
    coefCement: float
    densSand: float
    coefSand: float
    densGravilla: float
    coefGravilla: float
    densGrava: float
    coefGrava: float
    moistSand: float
    absSand: float
    moistGravilla: float
    absGravilla: float
    moistGrava: float
    absGrava: float
    customCement: float
    additives: List[Dict[str, Any]]

class WeatherRequest(BaseModel):
    lat: float
    lon: float
    date: str
    time: str

class ChatRequest(BaseModel):
    prompt: str

@app.get("/api/config")
def api_get_config():
    return {
        "supabaseUrl": os.environ.get("VITE_SUPABASE_URL", ""),
        "supabaseAnonKey": os.environ.get("VITE_SUPABASE_ANON_KEY", "")
    }

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Servidor de HormigónMix AI activo."}

@app.post("/api/dosificar")
def api_dosificar(payload: DosificacionRequest):
    try:
        # Convert Pydantic model to standard dict
        params = payload.model_dump()
        result = dosificar_mezcla(params)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en el servidor de dosificación: {str(e)}")

@app.post("/api/weather")
def api_weather(payload: WeatherRequest):
    try:
        result = fetch_weather_and_curing(payload.lat, payload.lon, payload.date, payload.time)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
def api_chat(payload: ChatRequest):
    try:
        result = call_gemini_api(payload.prompt)
        return {"response": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/reologia/simular")
def api_simular_reologia(payload: Dict[str, Any]):
    try:
        return calcular_reologia_y_perdida(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/reologia/corregir")
def api_corregir_reologia(payload: Dict[str, Any]):
    try:
        return calcular_correcciones_reologia(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/reologia/recalcular")
def api_recalcular_reologia(payload: Dict[str, Any]):
    try:
        return recalcular_formula_validada(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ia/predecir")
def api_predecir_resistencia_ia(payload: Dict[str, Any]):
    try:
        return predecir_resistencia_ia(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ia/optimizar")
def api_optimizar_mezcla_ia(payload: Dict[str, Any]):
    try:
        return optimizar_mezcla_ia(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Serve static frontend files
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app.mount("/", StaticFiles(directory=root_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
