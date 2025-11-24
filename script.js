// ===============================
// CONFIG
// ===============================
const BACKEND_URL =
  "https://voice-agent-ui-iota.vercel.app/api/session";

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
    { headers: { Authorization: `Bearer ${data.ephemeral_key}` } }
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

// ===============================
// MICROPHONE STREAM → AI
// ===============================
async function beginMicrophoneStreaming() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  sourceNode = audioContext.createMediaStreamSource(micStream);

  processor = audioContext.createScriptProcessor(2048, 1, 1);
  sourceNode.connect(processor);
  processor.connect(audioContext.destination);

  processor.onaudioprocess = (event) => {
    const float32 = event.inputBuffer.getChannelData(0);
    const pcm16 = floatTo16BitPCM(float32);

    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(
        JSON.stringify({
          type: "input_audio_buffer.append",
          audio: Array.from(new Int16Array(pcm16)),
        })
      );
    }
  };

  setInterval(() => {
    if (websocket) {
      websocket.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      websocket.send(JSON.stringify({ type: "response.create" }));
    }
  }, 1400);

  log("Microphone streaming started.");
}

// ===============================
// PLAY AI AUDIO OUT
// ===============================
let playbackQueue = [];
let playing = false;

function playAudioChunk(base64Audio) {
  const byteArray = Uint8Array.from(atob(base64Audio), (c) =>
    c.charCodeAt(0)
  ).buffer;
  playbackQueue.push(byteArray);

  if (!playing) playNext();
}

function playNext() {
  if (playbackQueue.length === 0) {
    playing = false;
    return;
  }

  playing = true;

  const chunk = playbackQueue.shift();
  audioContext.decodeAudioData(chunk.slice(0)).then((buffer) => {
    const playNode = audioContext.createBufferSource();
    playNode.buffer = buffer;
    playNode.connect(audioContext.destination);
    playNode.start();
    playNode.onended = playNext;
  });
}

// ===============================
// STOP MICROPHONE
// ===============================
function stopMicrophone() {
  if (processor) processor.disconnect();
  if (sourceNode) sourceNode.disconnect();
  if (micStream) micStream.getTracks().forEach((t) => t.stop());
  log("Microphone stopped.");
}

// ===============================
// UI BUTTON
// ===============================
talkButton.addEventListener("click", () => {
  if (!websocket || websocket.readyState !== WebSocket.OPEN) {
    startAgent();
    talkButton.textContent = "Stop";
  } else {
    websocket.close();
    talkButton.textContent = "Talk to agent";
  }
});
