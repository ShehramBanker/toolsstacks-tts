// ToolsStacks Text-to-Speech: Cloudflare Worker (free plan). Edge TTS over WebSocket.
const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WIN_EPOCH = 11644473600n;
const INITIAL=[0x6A09E667,0xBB67AE85,0x3C6EF372,0xA54FF53A,0x510E527F,0x9B05688C,0x1F83D9AB,0x5BE0CD19];
const STATE=[0xFD9FBEA2,0x91243CE7,0xBE499094,0xCD2E1E0A,0x6C006F49,0x04BD35AB,0xFEB0A7E4,0x03EFFBD2];
const SCHEDULE=[0xEB24BF9E,0x1558691F,0xA0C09EE2,0x0CFA32BA,0xA622EE8C,0xD1DD9491,0xC0DD25A0,0xF9E70AB6,0xF0C31573,0x7058CE4E,0x7188E606,0x00E5AB33,0xD258B060,0x72766564];
const K=[0x428A2F98,0x71374491,0xB5C0FBCF,0xE9B5DBA5,0x3956C25B,0x59F111F1,0x923F82A4,0xAB1C5ED5,0xD807AA98,0x12835B01,0x243185BE,0x550C7DC3,0x72BE5D74,0x80DEB1FE,0x9BDC06A7,0xC19BF174,0xE49B69C1,0xEFBE4786,0x0FC19DC6,0x240CA1CC,0x2DE92C6F,0x4A7484AA,0x5CB0A9DC,0x76F988DA,0x983E5152,0xA831C66D,0xB00327C8,0xBF597FC7,0xC6E00BF3,0xD5A79147,0x06CA6351,0x14292967,0x27B70A85,0x2E1B2138,0x4D2C6DFC,0x53380D13,0x650A7354,0x766A0ABB,0x81C2C92E,0x92722C85,0xA2BFE8A1,0xA81A664B,0xC24B8B70,0xC76C51A3,0xD192E819,0xD6990624,0xF40E3585,0x106AA070,0x19A4C116,0x1E376C08,0x2748774C,0x34B0BCB5,0x391C0CB3,0x4ED8AA4A,0x5B9CCA4F,0x682E6FF3,0x748F82EE,0x78A5636F,0x84C87814,0x8CC70208,0x90BEFFFA,0xA4506CEB,0xBEF9A3F7,0xC67178F2];
const ADJ=0xC9DC06A7, SIG0ADJ=0x059C0B80, SIG1ADJ=0x000B92C0;
const CS_COEF=[0xE82E91B1,0x44DE24C6,0x3BEB65BC,0xC89C5933,0x8D1EC211,0x314EF5D5,0xE92491B1,0xF0A5B9D5,0x06064CF3,0xDA79FA60,0xBED20560,0x89F9C9F8,0x35FA38C6,0xCB49E3C6];
const CS_OFF=[0xB32700D0,0x88DFF51D,0x29514038,0xB328CBDF,0xD405B4D5,0x26E55F3C,0x607801C6,0x82B2C1FB,0xFA51A3DA,0x207CC464,0x3C3C74F3,0xD2D14B61,0xBB04A2C1,0xC5626167];
const CS_FACTOR=0x82893933, CS_ADJ0=0xF2F90B1A, CS_ADJ1=0x0B1A0000;

const u32 = (x) => ((x % 4294967296) + 4294967296) % 4294967296;
const mul = (a, b) => Math.imul(a, b) >>> 0;
const ror = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;
const rol16 = (x) => ((x << 16) | (x >>> 16)) >>> 0;
const sigma0 = (x) => ((x >>> 7) ^ (x << 25) ^ (x >>> 18) ^ (x << 14) ^ (x >>> 3)) >>> 0;
const sigma1 = (x) => ((x >>> 17) ^ (x << 15) ^ (x >>> 19) ^ (x << 13) ^ (x >>> 10)) >>> 0;

function expand(words, first = 16) {
  for (let i = first; i < 64; i++) {
    words[i] = u32(sigma1(words[i - 2]) + words[i - 7] + sigma0(words[i - 15]) + words[i - 16]);
  }
}
function rounds(state, words, first) {
  let [a, b, c, d, e, f, g, h] = state;
  const consts = first === 14 ? K.map((k, i) => (i === 14 ? ADJ : k)) : K;
  for (let i = first; i < 64; i++) {
    const S1 = (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) >>> 0;
    const ch = (g ^ (e & (f ^ g))) >>> 0;
    const t1 = u32(h + S1 + ch + consts[i] + words[i]);
    const S0 = (ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) >>> 0;
    const maj = ((a & b) | (c & (a | b))) >>> 0;
    const t2 = u32(S0 + maj);
    h = g; g = f; f = e; e = u32(d + t1); d = c; c = b; b = a; a = u32(t1 + t2);
  }
  return [a, b, c, d, e, f, g, h];
}
function shaInit(data7) {
  const be = (arr) => arr.reduce((acc, v) => acc * 256 + v, 0);
  const words = new Array(14).fill(0);
  words.push(be(data7.slice(0, 3)));
  words.push(be(data7.slice(3, 7)));
  for (let i = 16; i < 30; i++) {
    let v = SCHEDULE[i - 16];
    if (i - 2 >= 14) v += i === 16 ? (sigma1(words[i - 2]) ^ SIG1ADJ) >>> 0 : sigma1(words[i - 2]);
    if (i - 7 >= 14) v += words[i - 7];
    if (i - 15 >= 14) v += i === 29 ? (sigma0(words[i - 15]) ^ SIG0ADJ) >>> 0 : sigma0(words[i - 15]);
    words.push(u32(v));
  }
  words.push(u32(sigma1(words[28]) + words[23] + sigma0(words[15]) + words[14] + ADJ - K[14]));
  expand(words, 31);
  const w = rounds(STATE, words, 14);
  return INITIAL.map((x, i) => u32(x + w[i]));
}
function shaDigest(data) {
  const length = 57 + data.length;
  const rest = Array.from(data.slice(7));
  rest.push(0x80);
  const zeros = (((55 - length) % 64) + 64) % 64;
  for (let i = 0; i < zeros; i++) rest.push(0);
  const bits = BigInt(length) * 8n;
  for (let i = 7; i >= 0; i--) rest.push(Number((bits >> BigInt(i * 8)) & 0xffn));
  let state = shaInit(Array.from(data.slice(0, 7)));
  for (let off = 0; off < rest.length; off += 64) {
    const words = [];
    for (let j = 0; j < 16; j++) {
      const p = off + j * 4;
      words.push(((rest[p] << 24) | (rest[p + 1] << 16) | (rest[p + 2] << 8) | rest[p + 3]) >>> 0);
    }
    expand(words);
    const w = rounds(state, words, 0);
    state = state.map((x, i) => u32(x + w[i]));
  }
  const out = [];
  for (const s of state) out.push((s >>> 24) & 255, (s >>> 16) & 255, (s >>> 8) & 255, s & 255);
  return out;
}
function cs64(data, digest) {
  const le = (o) => (digest[o] | (digest[o + 1] << 8) | (digest[o + 2] << 16) | (digest[o + 3] << 24)) >>> 0;
  const keyA = (le(0) | 1) >>> 0, keyB = (le(4) | 1) >>> 0;
  const factors = [mul(keyA, CS_FACTOR), mul(keyB, CS_FACTOR)];
  const terms = CS_COEF.map((c, i) => mul(c, factors[i % 2]));
  const offsets = CS_OFF.slice();
  const bytes = [0, ...data];
  while (bytes.length % 4) bytes.push(0);
  let words = [];
  for (let i = 0; i < bytes.length; i += 4) words.push((bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24)) >>> 0);
  if (words.length % 2) words.push(0);
  words.forEach((word, i) => {
    let term = mul(word, i % 2 === 0 ? keyA : keyB);
    let offset = mul(rol16(word), i % 2 === 0 ? 0xEF0569FB : 0xC31713DB);
    if (i === 0) { term = u32(term + mul(CS_ADJ0, factors[0])); offset = u32(offset + CS_ADJ1); }
    terms.push(term); offsets.push(offset);
  });
  let swapAcc = 0, swapLast = 0, state = 0, acc = 0;
  for (let i = 0; i < terms.length; i += 2) {
    const x = terms[i], y = terms[i + 1];
    let t = rol16(u32(offsets[i] + x));
    let q = mul(t, 0x76F50F34);
    swapAcc = u32(swapAcc + u32(mul(rol16(q), 0xC3EFEA97) + q));
    t = rol16(u32(offsets[i + 1] + y));
    q = mul(t, 0x1881CE3C);
    swapLast = u32(mul(rol16(q), 0x35BD1EC9) + q);
    swapAcc = u32(swapAcc + swapLast);
    state = u32(mul(state, keyA) + x);
    state = mul(rol16(state), 0xCF98B111);
    state = mul(rol16(state), 0x87085B9F);
    state = mul(rol16(state), 0x12CEB96D);
    state = mul(rol16(state), 0x257E1D83);
    acc = u32(acc + state);
    t = u32(mul(state, keyB) + y);
    t = mul(rol16(t), 0xA27416F5);
    t = mul(rol16(t), 0xD38396FF);
    state = mul(rol16(mul(rol16(t), 0x7C932B89)), 0xBFA49F69);
    acc = u32(acc + state);
  }
  return [(swapLast ^ state) >>> 0, (swapAcc ^ acc) >>> 0];
}
const hex = (arr) => arr.map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
function secMsGec(unixSeconds = Date.now() / 1000) {
  let ticks = BigInt(Math.floor(unixSeconds)) + WIN_EPOCH;
  ticks -= ticks % 300n;
  ticks *= 10000000n;
  const data = Array.from(new TextEncoder().encode(`${ticks}${TRUSTED_CLIENT_TOKEN}`));
  const digest = shaDigest(data);
  const [a, b] = cs64(data, digest);
  const le = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  return `${hex([...le(a), ...le(b)])}-${hex(digest)}`;
}

const ALLOWED_ORIGINS = ["https://toolsstacks.com", "https://www.toolsstacks.com"];
const MAX_CHARS = 3000, CHUNK_CHARS = 1500;
const PER_MIN = 6, PER_HOUR = 40, DAILY_CAP = 3000;
const CHROMIUM = "143.0.3650.75";
const WSS = "https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=" + TRUSTED_CLIENT_TOKEN;
const VOICES = {
  "en-US-ChristopherNeural": ["Christopher", "male", "Documentary narrator, deep and authoritative"],
  "en-US-GuyNeural": ["Guy", "male", "Documentary narrator, warm and steady"],
  "en-US-AndrewNeural": ["Andrew", "male", "Warm, conversational narrator"],
  "en-US-BrianNeural": ["Brian", "male", "Clear, casual narrator"],
  "en-US-DavisNeural": ["Davis", "male", "Calm, smooth narrator"],
  "en-US-AriaNeural": ["Aria", "female", "Confident, clear narrator"],
  "en-US-JennyNeural": ["Jenny", "female", "Friendly, natural narrator"],
  "en-US-MichelleNeural": ["Michelle", "female", "Professional, polished narrator"],
  "en-US-AvaNeural": ["Ava", "female", "Expressive, bright narrator"],
  "en-US-EmmaNeural": ["Emma", "female", "Calm, articulate narrator"],
};

const hits = new Map(); const day = { d: "", n: 0 }; let skew = 0;

class HttpError extends Error { constructor(status, msg, headers) { super(msg); this.status = status; this.headers = headers || {}; } }
const cors = (origin) => ({
  "Access-Control-Allow-Origin": origin || ALLOWED_ORIGINS[0], "Vary": "Origin",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "X-Cache, Retry-After",
});
const json = (obj, status, extra) => new Response(JSON.stringify(obj), { status: status || 200, headers: { "Content-Type": "application/json", ...(extra || {}) } });

function checkRate(ip) {
  const now = Date.now(); let q = hits.get(ip) || [];
  q = q.filter((t) => now - t < 3600000);
  if (q.filter((t) => now - t < 60000).length >= PER_MIN) throw new HttpError(429, "Too many requests. Please wait a minute.", { "Retry-After": "60" });
  if (q.length >= PER_HOUR) throw new HttpError(429, "Hourly limit reached. Please try again later.", { "Retry-After": "600" });
  q.push(now); hits.set(ip, q);
  if (hits.size > 2000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 3600000) hits.delete(k);
}
function checkDaily() {
  const d = new Date().toISOString().slice(0, 10);
  if (day.d !== d) { day.d = d; day.n = 0; }
  if (day.n >= DAILY_CAP) throw new HttpError(503, "Daily free capacity reached. Please come back tomorrow.");
  day.n++;
}
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
function splitText(text) {
  const out = []; let rest = text;
  while (rest.length > CHUNK_CHARS) {
    const win = rest.slice(0, CHUNK_CHARS);
    let cut = Math.max(win.lastIndexOf(". "), win.lastIndexOf("! "), win.lastIndexOf("? "), win.lastIndexOf("\n"));
    if (cut < CHUNK_CHARS / 2) cut = win.lastIndexOf(" ");
    if (cut <= 0) cut = CHUNK_CHARS - 1;
    out.push(rest.slice(0, cut + 1).trim()); rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out.filter(Boolean);
}
const jsDate = () => new Date().toUTCString().replace(/^(\w+), (\d+) (\w+) (\d+) ([\d:]+) GMT/, "$1 $3 $2 $4 $5 GMT+0000 (Coordinated Universal Time)");
const hexId = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");

async function synthChunk(text, voice, rate, pitch, connect) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const url = `${WSS}&ConnectionId=${hexId()}&Sec-MS-GEC=${secMsGec(Date.now() / 1000 + skew)}&Sec-MS-GEC-Version=2-${CHROMIUM}`;
    const resp = await connect(url, {
      Upgrade: "websocket", Pragma: "no-cache", "Cache-Control": "no-cache",
      Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
      "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM.split(".")[0]}.0.0.0 Safari/537.36 Edg/${CHROMIUM.split(".")[0]}.0.0.0`,
      "Accept-Language": "en-US,en;q=0.9", Cookie: `muid=${hexId().toUpperCase()};`,
    });
    if (resp.status === 403 && attempt === 0) {
      const sd = Date.parse(resp.headers.get("Date") || ""); if (!isNaN(sd)) skew += sd / 1000 - Date.now() / 1000; continue;
    }
    const ws = resp.webSocket;
    if (!ws) throw new Error("upstream refused: " + resp.status);
    return await new Promise((resolve, reject) => {
      const parts = []; let chain = Promise.resolve(), done = false;
      const finish = (fn, v) => { if (!done) { done = true; try { ws.close(); } catch (e) {} fn(v); } };
      const timer = setTimeout(() => finish(reject, new Error("timeout")), 25000);
      ws.accept();
      ws.addEventListener("message", (ev) => {
        chain = chain.then(async () => {
          let d = ev.data;
          if (typeof d === "string") { if (d.includes("Path:turn.end")) { clearTimeout(timer); parts.length ? finish(resolve, parts) : finish(reject, new Error("no audio")); } return; }
          if (d.arrayBuffer) d = await d.arrayBuffer();
          const u8 = new Uint8Array(d); if (u8.length < 2) return;
          const hl = (u8[0] << 8) | u8[1]; if (hl + 2 > u8.length) return;
          const head = new TextDecoder().decode(u8.slice(2, 2 + hl));
          if (head.includes("Path:audio") && u8.length > hl + 2) parts.push(u8.slice(hl + 2));
        }).catch((e) => finish(reject, e));
      });
      ws.addEventListener("close", () => chain.then(() => finish(reject, new Error("closed early"))));
      ws.addEventListener("error", () => finish(reject, new Error("ws error")));
      const ts = jsDate();
      ws.send(`X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
        '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n');
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='${pitch}' rate='${rate}' volume='+0%'>${esc(text)}</prosody></voice></speak>`;
      ws.send(`X-RequestId:${hexId()}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}Z\r\nPath:ssml\r\n\r\n${ssml}`);
    });
  }
  throw new Error("upstream auth failed");
}

async function handleTts(request, ctx, connect) {
  const origin = request.headers.get("Origin");
  if (origin && !ALLOWED_ORIGINS.includes(origin) && origin !== new URL(request.url).origin) throw new HttpError(403, "Origin not allowed.");
  let body; try { body = await request.json(); } catch (e) { throw new HttpError(400, "Invalid request."); }
  const text = String(body.text || "").split(/\s+/).filter(Boolean).join(" ");
  const voice = String(body.voice || "en-US-ChristopherNeural");
  if (!text) throw new HttpError(400, "Please enter some text.");
  if (text.length > MAX_CHARS) throw new HttpError(413, `Text too long. Limit is ${MAX_CHARS} characters.`);
  if (!VOICES[voice]) throw new HttpError(400, "Unknown voice.");
  const speed = Math.min(2, Math.max(0.5, Number(body.speed) || 1));
  const pitchN = Math.min(20, Math.max(-20, Math.trunc(Number(body.pitch) || 0)));
  const rateN = Math.round((speed - 1) * 100);
  const rate = (rateN >= 0 ? "+" : "") + rateN + "%", pitch = (pitchN >= 0 ? "+" : "") + pitchN + "Hz";
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${voice}|${rate}|${pitch}|${text}`)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const ckey = new Request("https://tts-cache.toolsstacks.invalid/" + hash);
  if (cache) { const hit = await cache.match(ckey); if (hit) return new Response(hit.body, { headers: { "Content-Type": "audio/mpeg", "X-Cache": "HIT", "Cache-Control": "no-store" } }); }
  checkRate(request.headers.get("CF-Connecting-IP") || "unknown"); checkDaily();
  let parts = [];
  try { for (const chunk of splitText(text)) parts = parts.concat(await synthChunk(chunk, voice, rate, pitch, connect)); }
  catch (e) { throw new HttpError(502, "Voice engine is busy. Please try again in a moment."); }
  const total = parts.reduce((n, p) => n + p.length, 0), audio = new Uint8Array(total); let o = 0;
  for (const p of parts) { audio.set(p, o); o += p.length; }
  if (cache && ctx) ctx.waitUntil(cache.put(ckey, new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" } })));
  return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "X-Cache": "MISS", "Cache-Control": "no-store" } });
}

const realConnect = (url, headers) => fetch(url, { headers });

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin"); const path = new URL(request.url).pathname.replace(/\/+$/, "");
    const h = cors(ALLOWED_ORIGINS.includes(origin) ? origin : null);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    try {
      let res;
      if (request.method === "POST" && path.endsWith("/tts")) res = await handleTts(request, ctx, env && env.__connect || realConnect);
      else if (path.endsWith("/voices")) res = json(Object.entries(VOICES).map(([id, v]) => ({ id, name: v[0], gender: v[1], desc: v[2] })));
      else res = json({ ok: true, service: "toolsstacks-tts" });
      const out = new Response(res.body, res); for (const [k, v] of Object.entries(h)) out.headers.set(k, v); return out;
    } catch (e) {
      const st = e.status || 500, msg = e.status ? e.message : "Something went wrong.";
      return json({ detail: msg }, st, { ...h, ...(e.headers || {}) });
    }
  },
};