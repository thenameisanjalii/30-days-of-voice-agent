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

let mediaRecorder;
let audioChunks = [];

const echoAudio = document.getElementById("echoAudio");
const recordBtn = document.getElementById("recordBtn");
let isRecording = false;

// Replace your recordBtn.onclick function with this:
recordBtn.onclick = async () => {
  if (!isRecording) {
    // Start recording
    audioChunks = [];
    try {
      // Request microphone permission explicitly
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      
      mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };
      
      // Add listening status
      const statusDiv = document.createElement("div");
      statusDiv.id = "recordingStatus";
      statusDiv.textContent = "🎤 Listening...";
      statusDiv.style.color = "lightblue";
      statusDiv.style.fontWeight = "bold";
      statusDiv.style.marginTop = "10px";
      document.querySelector(".chat-history").appendChild(statusDiv);
      
      mediaRecorder.onstop = async () => {
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        
        const recordingStatus = document.getElementById("recordingStatus");
        if (recordingStatus) recordingStatus.remove();
        
        if (audioChunks.length > 0) {
          const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
          await agentChatQuery(audioBlob, sessionId);
        }
        
        recordBtn.innerHTML = '<span class="btn-icon">🎤</span><span class="btn-text">Start Recording</span>';
        recordBtn.classList.remove("recording");
        isRecording = false;
      };
      
      mediaRecorder.start();
      recordBtn.innerHTML = '<span class="btn-icon">⏹️</span><span class="btn-text">Stop Recording</span>';
      recordBtn.classList.add("recording");
      isRecording = true;
      
    } catch (error) {
      console.error("Microphone error:", error);
      if (error.name === 'NotAllowedError') {
        alert("Microphone access denied. Please:\n1. Click the 🔒 icon in address bar\n2. Allow microphone access\n3. Refresh the page");
      } else if (error.name === 'NotFoundError') {
        alert("No microphone found. Please connect a microphone and try again.");
      } else {
        alert("Microphone error: " + error.message);
      }
    }
  } else {
    // Stop recording
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  }
};

async function agentChatQuery(audioBlob, sessionId) {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.wav");

  // Disable button while processing
  recordBtn.disabled = true;

  // Show processing status
  const statusDiv = document.createElement("div");
  statusDiv.id = "processingStatus";
  statusDiv.textContent = "🔄 Processing conversation...";
  statusDiv.style.color = "orange";
  statusDiv.style.fontWeight = "bold";
  statusDiv.style.marginTop = "10px";
  document.querySelector(".chat-history").appendChild(statusDiv);

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
    const conversationContainer = document.querySelector(".chat-history");
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

        // // Auto-start recording after audio ends
        // echoAudio.onended = () => {
        //   recordBtn.click();
        // };
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
      }
    }
        // Enable button after processing (success case)

    recordBtn.disabled = false;
  } catch (error) {
    const processingStatus = document.getElementById("processingStatus");
    if (processingStatus) processingStatus.remove();

    // Enable button after processing (error case)
    recordBtn.disabled = false;
    
    alert("Conversation failed: " + error.message);
  }
}