import os
import json
import time
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

# Load environment variables using absolute path resolution
current_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(current_dir)
load_dotenv(os.path.join(current_dir, ".env"))
load_dotenv(os.path.join(root_dir, ".env.local"))
load_dotenv(os.path.join(root_dir, ".env"))
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from backend.dosificador import dosificar_mezcla, calcular_reologia_y_perdida, calcular_correcciones_reologia, recalcular_formula_validada, predecir_resistencia_ia, optimizar_mezcla_ia
from backend.clima import fetch_weather_and_curing
from backend.ai_client import call_ai_api

app = FastAPI(title="HormigónIA Backend", version="1.0.0")

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
    grava2Passing: Optional[List[float]] = None
    grava2Ratio: Optional[float] = 0.20
    densGrava2: Optional[float] = 2.70
    coefGrava2: Optional[float] = 1.0
    moistGrava2: Optional[float] = 1.0
    absGrava2: Optional[float] = 0.5

class WeatherRequest(BaseModel):
    lat: float
    lon: float
    date: str
    time: str

class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]

class SupportRequest(BaseModel):
    email: str
    subject: str
    message: str
    ticket_id: str

@app.get("/api/config")
def api_get_config():
    return {
        "supabaseUrl": os.environ.get("VITE_SUPABASE_URL", ""),
        "supabaseAnonKey": os.environ.get("VITE_SUPABASE_ANON_KEY", "")
    }

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Servidor de HormigónIA activo."}

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
        result = call_ai_api(payload.messages)
        return {"response": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Helper functions for tickets JSON persistence
TICKETS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tickets.json")

def load_tickets() -> list:
    if not os.path.exists(TICKETS_FILE):
        return []
    try:
        with open(TICKETS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading tickets: {e}")
        return []

def save_tickets(tickets: list):
    try:
        with open(TICKETS_FILE, "w", encoding="utf-8") as f:
            json.dump(tickets, f, ensure_ascii=False, indent=4)
    except Exception as e:
        print(f"Error saving tickets: {e}")

class UpdateStatusRequest(BaseModel):
    ticket_id: str
    status: str

@app.post("/api/support")
def api_support(payload: SupportRequest):
    try:
        # Log the ticket details
        print(f"SUPPORT TICKET RECEIVED: {payload.ticket_id} | From: {payload.email} | Subject: {payload.subject}")
        
        # 1. Persist the ticket in the JSON file
        tickets = load_tickets()
        # Avoid duplicate entries
        if not any(t.get("ticket_id") == payload.ticket_id for t in tickets):
            tickets.append({
                "ticket_id": payload.ticket_id,
                "email": payload.email,
                "subject": payload.subject,
                "message": payload.message,
                "date": int(time.time() * 1000), # Unix timestamp in milliseconds
                "status": "Abierto"
            })
            save_tickets(tickets)
            print(f"Ticket {payload.ticket_id} persisted in tickets.json")
        
        # 2. Try SMTP sending as background/secondary action
        smtp_user = os.environ.get("SMTP_USER", "hormixia@gmail.com")
        smtp_pass = os.environ.get("SMTP_PASS")
        smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.environ.get("SMTP_PORT", "587"))
        
        if not smtp_pass:
            print("WARNING: SMTP_PASS env variable not set. Support email notification skipped.")
            return {"status": "logged", "message": "Ticket registrado y guardado en el servidor.", "ticket_id": payload.ticket_id}
            
        import smtplib
        from email.mime.text import MIMEText
        
        msg = MIMEText(f"Ticket ID: {payload.ticket_id}\nDe: {payload.email}\nAsunto: {payload.subject}\n\nMensaje:\n{payload.message}")
        msg['Subject'] = f"[Soporte HormigónMix] {payload.subject} ({payload.ticket_id})"
        msg['From'] = smtp_user
        msg['To'] = "hormixia@gmail.com"
        
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, ["hormixia@gmail.com"], msg.as_string())
            
        return {"status": "sent", "message": "Email de soporte enviado y guardado en servidor.", "ticket_id": payload.ticket_id}
    except Exception as e:
        print(f"Error handling support ticket: {str(e)}")
        # Even if SMTP fails, return logged because we saved it in the JSON file
        return {"status": "logged_fallback", "message": f"Registrado en el servidor. Error de envío SMTP: {str(e)}", "ticket_id": payload.ticket_id}

@app.get("/api/support/list")
def api_support_list():
    try:
        return load_tickets()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/support/update_status")
def api_support_update_status(payload: UpdateStatusRequest):
    try:
        tickets = load_tickets()
        updated = False
        for t in tickets:
            if t.get("ticket_id") == payload.ticket_id:
                t["status"] = payload.status
                updated = True
                break
        if not updated:
            raise HTTPException(status_code=404, detail="Ticket no encontrado")
        save_tickets(tickets)
        return {"status": "success", "message": f"Estado del ticket {payload.ticket_id} actualizado a {payload.status}"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
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

# Serve static frontend files (only when running locally as main script)
if __name__ == "__main__":
    import uvicorn
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    app.mount("/", StaticFiles(directory=root_dir, html=True), name="static")
    uvicorn.run(app, host="127.0.0.1", port=8000)


