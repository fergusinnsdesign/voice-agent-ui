// ===============================
// CONFIG
// ===============================
const BACKEND_URL =
  "https://voice-agent-backend-hliyk-1dt12k5cn-fergusinnsdesigns-projects.vercel.app/api/session";

// ===============================
// UI ELEMENTS (MATCHING YOUR HTML)
// ===============================
const talkButton = document.getElementById("talkButton");
const statusText = document.getElementById("status");
const debugOutput = document.getElementById("logOutput");

// Logging helper
function log(message, obj = null) {
  const ts = new Date().toLocaleTimeString();
  if (obj) {
    debugOutput.textContent += `[${ts}] ${message} ${JSON.stringify(
      obj,
      null,
      2
    )}\n\n`;
  } else {
    debugOutput.textContent += `[${ts}] ${message}\n`;
  }
  debugOutput.scrollTop = debugOutput.scrollHeight;
}

// ===============================
// AUDIO SETUP
// ===============================
let audioContext;
let micStream;
let processor;
let sourceNode;
let websocket;

function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

// ===============================
// MAIN LOGIC
// ===============================
async function startAgent() {
  log("Requesting ephemeral key from backend...");
  statusText.textContent = "Requesting session from backend...";

  const res = await fetch(BACKEND_URL, { method: "POST" });
  const data = await res.json();

  if (!data.ephemeral_key) {
    log("Backend error:", data);
    statusText.textContent = "Backend error";
    return;
  }

  log("Got ephemeral key", data);
  statusText.textContent = "Connecting to OpenAI Realtime...";

  websocket = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
    {
      headers: { Authorization: `Bearer ${data.ephemeral_key}` },
    }
  );

  websocket.binaryType = "arraybuffer";

  websocket.onopen = () => {
    log("Connected to OpenAI realtime!");
    statusText.textContent = "Connected — start talking!";
    beginMicrophoneStreaming();
  };

  websocket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    log("AI event received", msg);

    if (msg.type === "response.audio.delta") {
      playAudioChunk(msg.delta);
    }
  };

  websocket.onerror = (err) => {
    log("WebSocket error", err);
    statusText.textContent = "WebSocket error";
  };

  websocket.onclose = () => {
    log("WebSocket closed");
    statusText.textContent = "Disconnected";
    stopMicrophone();
  };
}

// (rest of your code unchanged)
