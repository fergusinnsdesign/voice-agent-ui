// === CONFIG: your backend URL that returns { ephemeral_key } ===
const BACKEND_URL =
  "https://voice-agent-ui-iota.vercel.app/api/session";

const talkButton = document.getElementById("talkButton");
const statusEl = document.getElementById("status");
const logEl = document.getElementById("logOutput");

function log(message, data) {
  const time = new Date().toISOString().split("T")[1].slice(0, 8);
  const line =
    "[" +
    time +
    "] " +
    message +
    (data ? " " + JSON.stringify(data, null, 2) : "");
  logEl.textContent = line + "\n\n" + logEl.textContent;
}

async function handleTalkClick() {
  try {
    statusEl.textContent = "Requesting session from backend...";
    talkButton.disabled = true;

    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      log("Backend error", { status: res.status, body: text });
      statusEl.textContent = "Backend error – see log below";
      talkButton.disabled = false;
      return;
    }

    const json = await res.json();
    const ephemeralKey = json.ephemeral_key;

    if (!ephemeralKey) {
      log("No ephemeral_key in response", json);
      statusEl.textContent = "No ephemeral key in response";
      talkButton.disabled = false;
      return;
    }

    log("Got ephemeral key", { ephemeralKey });
    statusEl.textContent = "Got ephemeral key! (see log below)";

    // 👉 This is where we'll plug in realtime voice next:
    // await startRealtimeVoice(ephemeralKey);

  } catch (err) {
    console.error(err);
    log("Error calling backend", { error: String(err) });
    statusEl.textContent = "Error – see log below";
  } finally {
    talkButton.disabled = false;
  }
}

talkButton.addEventListener("click", handleTalkClick);
