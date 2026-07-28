import requests
from datetime import datetime, timedelta

def fetch_weather_and_curing(lat: float, lon: float, date_str: str, time_str: str):
    """
    Calls Open-Meteo and computes curing plan, Menzel evaporation rate, and weather alerts.
    """
    # 1. Fetch Open-Meteo forecast
    # We query 16 days of forecast to cover future planning dates
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,precipitation_probability&forecast_days=16&timezone=auto"
    
    try:
        res = requests.get(url, timeout=10)
        res.raise_for_status()
        data = res.json()
    except Exception as e:
        raise RuntimeError(f"Error al conectar con la API de clima: {str(e)}")
        
    current = data.get("current", {})
    hourly = data.get("hourly", {})
    
    # 2. Match Target Date and Time
    target_dt_str = f"{date_str}T{time_str}"
    
    # Find index in hourly time series
    times = hourly.get("time", [])
    start_idx = -1
    for i, t in enumerate(times):
        if t >= target_dt_str:
            start_idx = i
            break
            
    is_far_future = False
    if start_idx == -1:
        # Snap to last 72 hours if date is beyond the 16 days forecast
        start_idx = max(0, len(times) - 72)
        is_far_future = True
        
    # Get weather parameters starting from matched index
    forecast_hours = min(72, len(times) - start_idx)
    
    sub_temps = hourly.get("temperature_2m", [])[start_idx : start_idx + forecast_hours]
    sub_hums = hourly.get("relative_humidity_2m", [])[start_idx : start_idx + forecast_hours]
    sub_winds = hourly.get("wind_speed_10m", [])[start_idx : start_idx + forecast_hours]
    sub_precs = hourly.get("precipitation", [])[start_idx : start_idx + forecast_hours]
    sub_prec_probs = hourly.get("precipitation_probability", [])[start_idx : start_idx + forecast_hours]
    sub_times = hourly.get("time", [])[start_idx : start_idx + forecast_hours]
    
    # 3. Calculate Curing Parameters & Evaporation Rate (Menzel Equation)
    avg_temp = sum(sub_temps) / len(sub_temps) if sub_temps else 20.0
    avg_hum = sum(sub_hums) / len(sub_hums) if sub_hums else 50.0
    
    # Estimate evaporation rate at concrete surface (first 24h average is safer for initial setup)
    # T_concrete assumed as T_air + 2 °C
    hourly_evaps = []
    for t_air, hum, wind in zip(sub_temps[:24], sub_hums[:24], sub_winds[:24]):
        t_concrete = t_air + 2.0
        tc_factor = (t_concrete + 18) ** 2.5
        ta_factor = (t_air + 18) ** 2.5
        hr = hum / 100.0
        evap = max(0.0, 5.0 * (tc_factor - hr * ta_factor) * (wind + 4.0) * 1e-6)
        hourly_evaps.append(evap)
        
    max_evap = max(hourly_evaps) if hourly_evaps else 0.15
    avg_evap = sum(hourly_evaps) / len(hourly_evaps) if hourly_evaps else 0.15
    
    # Determine Curing Days
    if avg_temp < 10.0:
        curing_days = 14
        curing_reason = "Bajas temperaturas promedio (< 10°C). Hidratación del cemento lenta; requiere curado prolongado."
    elif avg_temp > 25.0 or max_evap > 0.8:
        curing_days = 10
        curing_reason = "Altas temperaturas promedio (> 25°C) o alta tasa de evaporación. Riesgo de desecamiento prematuro."
    else:
        curing_days = 7
        curing_reason = "Temperatura y humedad moderadas (Curado estándar reglamentario)."
        
    # Determine Watering Frequency
    if max_evap > 1.0:
        water_freq_hours = 3
        water_freq_text = "Riego crítico continuo (cada 3 horas) o uso de nylon / membrana de curado"
    elif max_evap > 0.5:
        water_freq_hours = 6
        water_freq_text = "Riego frecuente cada 6 horas (mantener húmedo constante)"
    elif max_evap > 0.2:
        water_freq_hours = 8
        water_freq_text = "Riego estándar cada 8 horas (mañana, tarde y noche)"
    else:
        water_freq_hours = 12
        water_freq_text = "Riego moderado cada 12 horas (mañana y noche)"
        
    # 4. Check Weather Alerts
    rain_alerts = []
    freeze_alerts = []
    
    for i in range(forecast_hours):
        temp = sub_temps[i]
        prec = sub_precs[i]
        prob = sub_prec_probs[i]
        time_item = sub_times[i]
        
        # Parse time nicely
        dt = datetime.fromisoformat(time_item)
        date_nice = dt.strftime("%d/%m")
        hour_nice = dt.strftime("%H:%M")
        
        if prec > 0.2 and prob > 30:
            rain_alerts.append({
                "time": f"{date_nice} a las {hour_nice} hs",
                "prob": prob,
                "amount": prec
            })
            
        if temp < 0.0:
            freeze_alerts.append(f"{date_nice} a las {hour_nice} hs ({temp:.1f}°C)")
            
    # Prepare result structure matching JavaScript expectations
    result = {
        "current": {
            "temp": current.get("temperature_2m", avg_temp),
            "hum": current.get("relative_humidity_2m", avg_hum),
            "wind": current.get("wind_speed_10m", 10.0)
        },
        "curing": {
            "curingDays": curing_days,
            "curingReason": curing_reason,
            "waterFrequencyHours": water_freq_hours,
            "waterFrequencyText": water_freq_text,
            "evapRate": avg_evap,
            "isFarFuture": is_far_future,
            "rainAlerts": rain_alerts,
            "freezeAlerts": freeze_alerts
        },
        "hourly": {
            "time": sub_times,
            "temperature_2m": sub_temps,
            "relative_humidity_2m": sub_hums,
            "wind_speed_10m": sub_winds
        }
    }
    
    return result
