console.log("🎤 Voice Agent Day 1 - System Ready!");

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

    // Send audio to /llm/query
    await llmAudioQuery(audioBlob);
};

  mediaRecorder.start();
  startBtn.disabled = true;
  stopBtn.disabled = false;
};

stopBtn.onclick = () => {
  mediaRecorder.stop();
  startBtn.disabled = false;
  stopBtn.disabled = true;
};

// Your uploadAudio function stays the same
async function uploadAudio(audioBlob) {
  // Create unique filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `recording_${timestamp}.wav`;

  const formData = new FormData();
  formData.append("file", audioBlob, filename);

  // Show upload status
  const statusDiv = document.createElement("div");
  statusDiv.id = "uploadStatus";
  statusDiv.textContent = "Uploading audio...";
  statusDiv.style.color = "yellow";
  document.querySelector(".echo-section").appendChild(statusDiv);

  try {
    const response = await fetch("/upload-audio", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (data.success) {
      statusDiv.textContent = `✅ Uploaded: ${data.filename} (${data.size} bytes)`;
      statusDiv.style.color = "lightgreen";
    }
  } catch (error) {
    statusDiv.textContent = "❌ Upload failed: " + error.message;
    statusDiv.style.color = "red";
  }
}

async function transcribeAudio(audioBlob) {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.wav");

  try {
    console.log("Sending request to /transcribe/file"); // Add this

    const response = await fetch("/transcribe/file", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    console.log("Response data:", data); // Add this

    // Remove previous transcription
    const oldTranscript = document.querySelector(".transcription-result");
    if (oldTranscript) oldTranscript.remove();

    // Show transcription
    const transcriptDiv = document.createElement("div");
    transcriptDiv.className = "transcription-result";
    transcriptDiv.textContent = `Transcription: ${data.transcription}`;
    document.querySelector(".echo-section").appendChild(transcriptDiv);
  } catch (error) {
    console.error("Transcription error:", error); // Add this
    alert("Transcription failed: " + error.message);
  }
}

async function echoWithMurf(audioBlob) {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.wav");

  // Show processing status
  const statusDiv = document.createElement("div");
  statusDiv.id = "processingStatus";
  statusDiv.textContent = "🔄 Processing with Murf AI...";
  statusDiv.style.color = "orange";
  statusDiv.style.fontWeight = "bold";
  statusDiv.style.marginTop = "10px";
  document.querySelector(".echo-section").appendChild(statusDiv);

  try {
    const response = await fetch("/tts/echo", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    // Remove processing status
    const processingStatus = document.getElementById("processingStatus");
    if (processingStatus) processingStatus.remove();

    if (data.success) {
      // Remove previous results
      const oldTranscript = document.querySelector(".transcription-result");
      if (oldTranscript) oldTranscript.remove();

      // Show transcription
      const transcriptDiv = document.createElement("div");
      transcriptDiv.textContent = `You said: "${data.transcription}"`;
      transcriptDiv.className = "transcription-result";
      document.querySelector(".echo-section").appendChild(transcriptDiv);

      // Play Murf audio
      echoAudio.src = data.audio_url;
      echoAudio.style.display = "block";
      echoAudio.load();
      echoAudio.play();
    }
  } catch (error) {
    // Remove processing status on error
    const processingStatus = document.getElementById("processingStatus");
    if (processingStatus) processingStatus.remove();
    
    alert("Echo failed: " + error.message);
  }
}

async function llmAudioQuery(audioBlob) {
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.wav");

    // Show processing status
    const statusDiv = document.createElement("div");
    statusDiv.id = "processingStatus";
    statusDiv.textContent = "🔄 Processing with LLM and Murf AI...";
    statusDiv.style.color = "orange";
    statusDiv.style.fontWeight = "bold";
    statusDiv.style.marginTop = "10px";
    document.querySelector(".echo-section").appendChild(statusDiv);

    try {
        const response = await fetch("/llm/query", {
            method: "POST",
            body: formData,
        });

        const data = await response.json();

        // Remove processing status
        const processingStatus = document.getElementById("processingStatus");
        if (processingStatus) processingStatus.remove();

        if (data.success) {
            // Remove previous results
            const oldResults = document.querySelectorAll(".conversation-card");
            oldResults.forEach(card => card.remove());

            // Create user card
            const userCard = document.createElement("div");
            userCard.className = "conversation-card user-card";
            userCard.innerHTML = `<strong>You:</strong> ${data.transcription}`;
            document.querySelector(".echo-section").appendChild(userCard);

            // Create bot card
            const botCard = document.createElement("div");
            botCard.className = "conversation-card bot-card";
            botCard.innerHTML = `<strong>Bot:</strong> ${data.llm_response}`;
            document.querySelector(".echo-section").appendChild(botCard);

            // Play Murf audio
            echoAudio.src = data.audio_url;
            echoAudio.style.display = "block";
            echoAudio.load();
            echoAudio.play();
        }
    } catch (error) {
        const processingStatus = document.getElementById("processingStatus");
        if (processingStatus) processingStatus.remove();
        alert("LLM/Murf failed: " + error.message);
    }
}