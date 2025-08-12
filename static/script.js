// console.log("🎤 Voice Agent Day 1 - System Ready!");

function getSessionId() {
  const params = new URLSearchParams(window.location.search);
  let sessionId = params.get("session_id");
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2, 12);
    params.set("session_id", sessionId);
    window.location.search = params.toString();
  }
  return sessionId;
}
const sessionId = getSessionId();

async function submitText() {
  const text = document.getElementById("ttsInput").value.trim();
  const audioPlayer = document.getElementById("audioPlayer");
  const button = document.querySelector(".action-btn");

  if (!text) {
    alert("Please enter text!");
    return;
  }

  // Show loading
  button.disabled = true;
  button.textContent = "Loading...";

  try {
    const response = await fetch("/generate-audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text }),
    });

    const data = await response.json();

    if (data.success && data.audio_url) {
      audioPlayer.src = data.audio_url;
      audioPlayer.style.display = "block";
      audioPlayer.load();
    } else {
      alert("Error generating audio: " + data.error);
    }
  } catch (error) {
    alert("Error: " + error.message);
  } finally {
    // Reset button
    button.disabled = false;
    button.textContent = "Generate Audio";
  }
}

let mediaRecorder;
let audioChunks = [];

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const echoAudio = document.getElementById("echoAudio");

startBtn.onclick = async () => {
  audioChunks = [];
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);

    // Add listening status
    const statusDiv = document.createElement("div");
    statusDiv.id = "recordingStatus";
    statusDiv.textContent = "🎤 Listening...";
    statusDiv.style.color = "lightblue";
    statusDiv.style.fontWeight = "bold";
    statusDiv.style.marginTop = "10px";
    document.querySelector(".echo-section").appendChild(statusDiv);

    mediaRecorder.onstop = async () => {
      const recordingStatus = document.getElementById("recordingStatus");
      if (recordingStatus) recordingStatus.remove();

      const audioBlob = new Blob(audioChunks, { type: "audio/wav" });

      await agentChatQuery(audioBlob, sessionId);
    };

    mediaRecorder.start();
    startBtn.disabled = true;
    stopBtn.disabled = false;
  } catch (error) {
    alert("Could not access microphone. Please check your browser settings.");
    console.error("Microphone access error:", error);
  }
};

stopBtn.onclick = () => {
  mediaRecorder.stop();
  startBtn.disabled = false;
  stopBtn.disabled = true;
};

async function agentChatQuery(audioBlob, sessionId) {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.wav");

  // Show processing status
  const statusDiv = document.createElement("div");
  statusDiv.id = "processingStatus";
  statusDiv.textContent = "🔄 Processing conversation...";
  statusDiv.style.color = "orange";
  statusDiv.style.fontWeight = "bold";
  statusDiv.style.marginTop = "10px";
  document.querySelector(".echo-section").appendChild(statusDiv);

  try {
    const response = await fetch(`/agent/chat/${sessionId}`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    // Remove processing status
    const processingStatus = document.getElementById("processingStatus");
    if (processingStatus) processingStatus.remove();

    // Clear old conversation history on each new interaction to prevent duplicates
    const conversationContainer = document.querySelector(".echo-section");
    const oldResults = conversationContainer.querySelectorAll(".conversation-card");
    oldResults.forEach((card) => card.remove());
    
    if (data.success) {
      // Show full chat history
      data.history.forEach((msg) => {
        const card = document.createElement("div");
        card.className =
          "conversation-card " +
          (msg.role === "user" ? "user-card" : "bot-card");
        card.innerHTML = `<strong>${
          msg.role === "user" ? "You" : "Bot"
        }:</strong> ${msg.content}`;
        conversationContainer.appendChild(card);
      });

      // Play Murf audio
      if (data.audio_url) {
        echoAudio.src = data.audio_url;
        echoAudio.style.display = "block";
        echoAudio.load();
        echoAudio.play();

        // Auto-start recording after audio ends
        echoAudio.onended = () => {
          startBtn.click();
        };
      } else {
        // If there's no audio URL, just display the text and enable recording
        startBtn.disabled = false;
        stopBtn.disabled = true;
      }
    } else {
      // Handle error case by displaying the fallback message and playing the audio
      const botCard = document.createElement("div");
      botCard.className = "conversation-card bot-card";
      botCard.innerHTML = `<strong>Bot:</strong> ${data.llm_response}`;
      conversationContainer.appendChild(botCard);
      
      console.error(`Backend Error: ${data.error}`);

      if (data.audio_url) {
        echoAudio.src = data.audio_url;
        echoAudio.style.display = "block";
        echoAudio.load();
        echoAudio.play();

        // After error message plays, stop and re-enable the start button
        echoAudio.onended = () => {
          startBtn.disabled = false;
          stopBtn.disabled = true;
        };
      } else {
        // If no audio URL, just enable the start button
        startBtn.disabled = false;
        stopBtn.disabled = true;
      }
    }
  } catch (error) {
    const processingStatus = document.getElementById("processingStatus");
    if (processingStatus) processingStatus.remove();
    alert("Conversation failed: " + error.message);
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}