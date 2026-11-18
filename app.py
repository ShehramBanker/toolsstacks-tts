"""ToolsStacks Text-to-Speech API (Edge TTS, $0). FastAPI."""
import asyncio, hashlib, os, time
from collections import OrderedDict, defaultdict, deque
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
import edge_tts

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://toolsstacks.com,https://www.toolsstacks.com").split(",")
MAX_CHARS = int(os.getenv("MAX_CHARS", "3000"))
PER_MIN = int(os.getenv("PER_MIN", "6"))
PER_HOUR = int(os.getenv("PER_HOUR", "40"))
DAILY_CAP = int(os.getenv("DAILY_CAP", "2000"))       # total uncached syntheses / day
CACHE_BYTES = int(os.getenv("CACHE_BYTES", str(60*1024*1024)))
MAX_CONCURRENT = int(os.getenv("MAX_CONCURRENT", "3"))

VOICES = {
 "en-US-ChristopherNeural": ("Christopher", "male", "Documentary narrator, deep and authoritative"),
 "en-US-GuyNeural":         ("Guy", "male", "Documentary narrator, warm and steady"),
 "en-US-AndrewNeural":      ("Andrew", "male", "Warm, conversational narrator"),
 "en-US-BrianNeural":       ("Brian", "male", "Clear, casual narrator"),
 "en-US-DavisNeural":       ("Davis", "male", "Calm, smooth narrator"),
 "en-US-AriaNeural":        ("Aria", "female", "Confident, clear narrator"),
 "en-US-JennyNeural":       ("Jenny", "female", "Friendly, natural narrator"),
 "en-US-MichelleNeural":    ("Michelle", "female", "Professional, polished narrator"),
 "en-US-AvaNeural":         ("Ava", "female", "Expressive, bright narrator"),
 "en-US-EmmaNeural":        ("Emma", "female", "Calm, articulate narrator"),
}

app = FastAPI(title="ToolsStacks TTS", docs_url=None, redoc_url=None)
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["GET", "POST", "OPTIONS"],
                   allow_headers=["Content-Type"], expose_headers=["X-Cache", "Retry-After"])

cache: "OrderedDict[str, bytes]" = OrderedDict()
cache_size = 0
hits = defaultdict(lambda: deque())
day = {"d": time.strftime("%Y-%m-%d", time.gmtime()), "n": 0}
sem = asyncio.Semaphore(MAX_CONCURRENT)

class Req(BaseModel):
    text: str
    voice: str = "en-US-ChristopherNeural"
    speed: float = 1.0   # 0.5 - 2.0
    pitch: int = 0       # -20 .. +20 Hz

def client_ip(r: Request) -> str:
    xff = r.headers.get("x-forwarded-for")
    return (xff.split(",")[0].strip() if xff else (r.client.host if r.client else "?"))

def check_rate(ip: str):
    now = time.time(); q = hits[ip]
    while q and now - q[0] > 3600: q.popleft()
    last_min = sum(1 for t in q if now - t <= 60)
    if last_min >= PER_MIN: raise HTTPException(429, "Too many requests. Please wait a minute.", headers={"Retry-After": "60"})
    if len(q) >= PER_HOUR: raise HTTPException(429, "Hourly limit reached. Please try again later.", headers={"Retry-After": "600"})
    q.append(now)
    if len(hits) > 5000:  # prune idle IPs
        for k in [k for k, v in hits.items() if not v or now - v[-1] > 3600]: hits.pop(k, None)

@app.get("/")
def root(): return {"ok": True, "service": "toolsstacks-tts"}

@app.get("/voices")
def voices():
    return [{"id": k, "name": v[0], "gender": v[1], "desc": v[2]} for k, v in VOICES.items()]

@app.post("/tts")
async def tts(body: Req, request: Request):
    origin = request.headers.get("origin")
    if origin and origin not in ALLOWED_ORIGINS: raise HTTPException(403, "Origin not allowed.")
    text = " ".join(body.text.split())
    if not text: raise HTTPException(400, "Please enter some text.")
    if len(text) > MAX_CHARS: raise HTTPException(413, f"Text too long. Limit is {MAX_CHARS} characters.")
    if body.voice not in VOICES: raise HTTPException(400, "Unknown voice.")
    speed = min(2.0, max(0.5, body.speed)); pitch = min(20, max(-20, int(body.pitch)))
    rate = f"{round((speed - 1) * 100):+d}%"; ptxt = f"{pitch:+d}Hz"
    key = hashlib.sha256(f"{body.voice}|{rate}|{ptxt}|{text}".encode()).hexdigest()

    global cache_size
    if key in cache:                       # cache hits don't count against limits
        cache.move_to_end(key)
        return Response(cache[key], media_type="audio/mpeg", headers={"X-Cache": "HIT", "Cache-Control": "no-store"})

    check_rate(client_ip(request))
    today = time.strftime("%Y-%m-%d", time.gmtime())
    if day["d"] != today: day.update(d=today, n=0)
    if day["n"] >= DAILY_CAP: raise HTTPException(503, "Daily free capacity reached. Please come back tomorrow.")
    day["n"] += 1

    async with sem:
        try:
            audio = bytearray()
            comm = edge_tts.Communicate(text, body.voice, rate=rate, pitch=ptxt)
            async def run():
                async for ch in comm.stream():
                    if ch["type"] == "audio": audio.extend(ch["data"])
            await asyncio.wait_for(run(), timeout=60)
        except Exception:
            raise HTTPException(502, "Voice engine is busy. Please try again in a moment.")
    if not audio: raise HTTPException(502, "No audio returned. Please try again.")
    data = bytes(audio)
    cache[key] = data; cache_size += len(data)
    while cache_size > CACHE_BYTES and cache:
        _, v = cache.popitem(last=False); cache_size -= len(v)
    return Response(data, media_type="audio/mpeg", headers={"X-Cache": "MISS", "Cache-Control": "no-store"})


if __name__ == "__main__":  # Hugging Face "Gradio" Spaces run: python app.py
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "7860")))