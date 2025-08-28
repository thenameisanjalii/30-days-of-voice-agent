/**
 * AI Voice Agent - Professional Frontend JavaScript
 * Handles API key management, audio streaming, and modern UI interactions
 */

// Global state management
class VoiceAgentApp {
  constructor() {
    this.sessionId =
      this.getSessionIdFromUrl() ||
      window.SESSION_ID ||
      this.generateSessionId();
    this.currentAssistantText = "";
    this.selectedPersona = "developer";
    this.apiKeys = this.loadStoredApiKeys();

    // Audio streaming variables
    this.audioStreamSocket = null;
    this.audioStreamRecorder = null;
    this.audioStreamStream = null;
    this.isStreaming = false;

    // Audio playback variables
    this.audioContext = null;
    this.audioChunks = [];
    this.playheadTime = 0;
    this.isPlaying = false;
    this.wavHeaderSet = true;
    this.SAMPLE_RATE = 44100;

    this.init();
  }

  init() {
    this.initializeDOM();
    this.setupEventListeners();
    this.initializeSession();
    this.loadSystemStatus();
    this.hideLoadingOverlay();
  }

  initializeDOM() {
    // Cache frequently used DOM elements
    this.elements = {
      // Settings modal
      settingsModal: document.getElementById("settingsModal"),
      geminiKey: document.getElementById("geminiKey"),
      assemblyaiKey: document.getElementById("assemblyaiKey"),
      murfKey: document.getElementById("murfKey"),
      murfVoiceId: document.getElementById("murfVoiceId"),
      openweatherKey: document.getElementById("openweatherKey"),

      // Status indicators
      systemStatus: document.getElementById("systemStatus"),
      connectionStatus: document.getElementById("connectionStatus"),
      sessionId: document.getElementById("sessionId"),
      streamingSessionId: document.getElementById("streamingSessionId"),

      // Chat and controls
      chatHistory: document.getElementById("chatHistory"),
      chatHistoryContainer: document.getElementById("chatHistoryContainer"),
      personaSelect: document.getElementById("personaSelect"),
      audioStreamBtn: document.getElementById("audioStreamBtn"),
      audioStreamStatus: document.getElementById("audioStreamStatus"),
      streamingStatusLog: document.getElementById("streamingStatusLog"),

      // Quick action buttons
      getWeatherBtn: document.getElementById("getWeatherBtn"),
      getMotivationBtn: document.getElementById("getMotivationBtn"),
      toggleChatHistory: document.getElementById("toggleChatHistory"),

      // Modals
      conversationModal: document.getElementById("conversationModal"),
      modalQuestionContent: document.getElementById("modalQuestionContent"),
      modalResponseContent: document.getElementById("modalResponseContent"),

      // Loading
      loadingOverlay: document.getElementById("loadingOverlay"),
      notificationContainer: document.getElementById("notificationContainer"),
    };

    // Set session ID in UI
    if (this.elements.sessionId) {
      this.elements.sessionId.textContent = this.sessionId;
    }
  }

  setupEventListeners() {
    // Settings modal events
    if (this.elements.settingsModal) {
      // Close modal when clicking outside
      this.elements.settingsModal.addEventListener("click", (e) => {
        if (e.target === this.elements.settingsModal) {
          this.closeSettingsModal();
        }
      });
    }

    // Persona selection
    if (this.elements.personaSelect) {
      this.elements.personaSelect.addEventListener("change", (e) => {
        this.selectedPersona = e.target.value;
        this.updateStreamingStatus(
          `🎭 Persona changed to: ${this.getPersonaDisplayName(
            this.selectedPersona
          )}`,
          "info"
        );
        this.sendPersonaUpdate();
      });
    }

    // Audio streaming button
    if (this.elements.audioStreamBtn) {
      this.elements.audioStreamBtn.addEventListener("click", () => {
        this.toggleAudioStreaming();
      });
    }

    // Quick action buttons
    if (this.elements.getWeatherBtn) {
      this.elements.getWeatherBtn.addEventListener("click", () => {
        this.handleWeatherRequest();
      });
    }

    if (this.elements.getMotivationBtn) {
      this.elements.getMotivationBtn.addEventListener("click", () => {
        this.handleMotivationRequest();
      });
    }

    if (this.elements.toggleChatHistory) {
      this.elements.toggleChatHistory.addEventListener("click", () => {
        this.toggleChatHistory();
      });
    }

    // Modal close events
    const closeModalElements = document.querySelectorAll(
      ".close, #closeModal, #modalCloseBtn"
    );
    closeModalElements.forEach((element) => {
      element.addEventListener("click", () => {
        this.closeConversationModal();
      });
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeAllModals();
      }
    });
  }

  // ========== API KEY MANAGEMENT ==========

  loadStoredApiKeys() {
    try {
      const stored = localStorage.getItem("voiceAgentApiKeys");
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error("Error loading stored API keys:", error);
      return {};
    }
  }

  saveApiKeys() {
    const keys = {
      gemini_api_key: this.elements.geminiKey?.value || "",
      assemblyai_api_key: this.elements.assemblyaiKey?.value || "",
      murf_api_key: this.elements.murfKey?.value || "",
      murf_voice_id: this.elements.murfVoiceId?.value || "en-US-terrell",
      openweather_api_key: this.elements.openweatherKey?.value || "",
    };

    // Filter out empty keys
    const filteredKeys = Object.fromEntries(
      Object.entries(keys).filter(([_, value]) => value.trim() !== "")
    );

    this.showNotification("Saving API keys...", "info");

    fetch("/api/keys/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(filteredKeys),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          this.showNotification("API keys saved successfully!", "success");
          localStorage.setItem(
            "voiceAgentApiKeys",
            JSON.stringify(filteredKeys)
          );
          this.apiKeys = filteredKeys;
          this.updateApiKeyStatus(data.keys_status);
          this.loadSystemStatus(); // Refresh system status
          this.closeSettingsModal();
        } else {
          this.showNotification(
            `Failed to save API keys: ${data.message}`,
            "error"
          );
        }
      })
      .catch((error) => {
        console.error("Error saving API keys:", error);
        this.showNotification(
          "Error saving API keys. Please try again.",
          "error"
        );
      });
  }

  async validateApiKey(service, inputElementId) {
    const inputElement = document.getElementById(inputElementId);
    const statusElement = document.getElementById(`${service}Status`);

    if (!inputElement || !inputElement.value.trim()) {
      this.showNotification("Please enter an API key first", "warning");
      return;
    }

    const apiKey = inputElement.value.trim();

    // Show loading state
    if (statusElement) {
      statusElement.textContent = "Validating...";
      statusElement.className = "status-indicator loading";
    }

    try {
      const response = await fetch(`/api/keys/validate/${service}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ api_key: apiKey }),
      });

      const data = await response.json();

      if (data.success && data.valid) {
        this.showNotification(`${service} API key is valid!`, "success");
        if (statusElement) {
          statusElement.textContent = "Valid";
          statusElement.className = "status-indicator valid";
        }
      } else {
        this.showNotification(
          `${service} API key validation failed: ${
            data.error || "Invalid key"
          }`,
          "error"
        );
        if (statusElement) {
          statusElement.textContent = "Invalid";
          statusElement.className = "status-indicator invalid";
        }
      }
    } catch (error) {
      console.error("Error validating API key:", error);
      this.showNotification(
        "Error validating API key. Please try again.",
        "error"
      );
      if (statusElement) {
        statusElement.textContent = "Error";
        statusElement.className = "status-indicator invalid";
      }
    }
  }

  loadDefaultKeys() {
    // Clear all input fields and load from stored keys
    const inputs = ["geminiKey", "assemblyaiKey", "murfKey", "openweatherKey"];

    inputs.forEach((inputId) => {
      const element = document.getElementById(inputId);
      if (element) {
        element.value = "";
      }
    });

    // Load from localStorage if available
    if (Object.keys(this.apiKeys).length > 0) {
      if (this.elements.geminiKey)
        this.elements.geminiKey.value = this.apiKeys.gemini_api_key || "";
      if (this.elements.assemblyaiKey)
        this.elements.assemblyaiKey.value =
          this.apiKeys.assemblyai_api_key || "";
      if (this.elements.murfKey)
        this.elements.murfKey.value = this.apiKeys.murf_api_key || "";
      if (this.elements.murfVoiceId)
        this.elements.murfVoiceId.value =
          this.apiKeys.murf_voice_id || "en-US-terrell";
      if (this.elements.openweatherKey)
        this.elements.openweatherKey.value =
          this.apiKeys.openweather_api_key || "";

      this.showNotification("Loaded saved API keys", "info");
    } else {
      this.showNotification("No saved API keys found", "warning");
    }
  }

  updateApiKeyStatus(keysStatus) {
    const statusMapping = {
      gemini: "geminiStatus",
      assemblyai: "assemblyaiStatus",
      murf: "murfStatus",
      openweather: "openweatherStatus",
    };

    Object.entries(statusMapping).forEach(([service, elementId]) => {
      const element = document.getElementById(elementId);
      if (element && keysStatus[service] !== undefined) {
        element.textContent = keysStatus[service] ? "Valid" : "Not Set";
        element.className = `status-indicator ${
          keysStatus[service] ? "valid" : "unknown"
        }`;
      }
    });
  }

  // ========== MODAL MANAGEMENT ==========

  openSettingsModal() {
    if (this.elements.settingsModal) {
      this.elements.settingsModal.style.display = "block";
      this.loadDefaultKeys(); // Load current keys
    }
  }

  closeSettingsModal() {
    if (this.elements.settingsModal) {
      this.elements.settingsModal.style.display = "none";
    }
  }

  closeConversationModal() {
    if (this.elements.conversationModal) {
      this.elements.conversationModal.style.display = "none";
    }
  }

  closeAllModals() {
    this.closeSettingsModal();
    this.closeConversationModal();
  }

  // ========== UI UTILITY FUNCTIONS ==========

  togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = input?.parentElement?.querySelector(".toggle-visibility i");

    if (input && button) {
      if (input.type === "password") {
        input.type = "text";
        button.className = "fas fa-eye-slash";
      } else {
        input.type = "password";
        button.className = "fas fa-eye";
      }
    }
  }

  showNotification(message, type = "info") {
    if (!this.elements.notificationContainer) return;

    const notification = document.createElement("div");
    notification.className = `notification ${type}`;

    const icon = this.getNotificationIcon(type);
    notification.innerHTML = `
      <i class="${icon}"></i>
      <span>${message}</span>
    `;

    this.elements.notificationContainer.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  getNotificationIcon(type) {
    const icons = {
      success: "fas fa-check-circle",
      error: "fas fa-exclamation-circle",
      warning: "fas fa-exclamation-triangle",
      info: "fas fa-info-circle",
    };
    return icons[type] || icons.info;
  }

  hideLoadingOverlay() {
    if (this.elements.loadingOverlay) {
      setTimeout(() => {
        this.elements.loadingOverlay.style.display = "none";
      }, 1000);
    }
  }

  // ========== SYSTEM STATUS ==========

  async loadSystemStatus() {
    try {
      const response = await fetch("/api/backend");
      const data = await response.json();

      if (this.elements.systemStatus) {
        this.elements.systemStatus.innerHTML = "";

        // Add backend status
        this.addStatusItem(
          "Backend",
          data.status === "healthy" ? "online" : "offline"
        );

        // Add service statuses
        if (data.services) {
          Object.entries(data.services).forEach(([service, status]) => {
            this.addStatusItem(
              this.capitalizeFirst(service),
              status ? "online" : "offline"
            );
          });
        }
      }

      // Update connection status
      this.updateConnectionStatus("connected");
    } catch (error) {
      console.error("Error loading system status:", error);
      this.updateConnectionStatus("disconnected");

      if (this.elements.systemStatus) {
        this.elements.systemStatus.innerHTML = `
          <div class="status-item">
            <span class="service">Backend</span>
            <span class="status offline">Offline</span>
          </div>
        `;
      }
    }
  }

  addStatusItem(service, status) {
    if (!this.elements.systemStatus) return;

    const statusItem = document.createElement("div");
    statusItem.className = "status-item";
    statusItem.innerHTML = `
      <span class="service">${service}</span>
      <span class="status ${status}">${this.capitalizeFirst(status)}</span>
    `;

    this.elements.systemStatus.appendChild(statusItem);
  }

  updateConnectionStatus(status) {
    if (!this.elements.connectionStatus) return;

    this.elements.connectionStatus.className = `connection-status ${status}`;

    const statusText = {
      connected: "Connected",
      disconnected: "Disconnected",
      connecting: "Connecting...",
    };

    const statusIcon = {
      connected: "fas fa-circle",
      disconnected: "fas fa-circle",
      connecting: "fas fa-spinner fa-spin",
    };

    this.elements.connectionStatus.innerHTML = `
      <i class="${statusIcon[status]}"></i>
      <span>${statusText[status]}</span>
    `;
  }

  // ========== CHAT FUNCTIONALITY ==========

  async initializeSession() {
    try {
      await this.loadChatHistory();
    } catch (error) {
      console.error("Error initializing session:", error);
    }
  }

  async loadChatHistory() {
    try {
      const response = await fetch(`/agent/chat/${this.sessionId}/history`);
      const data = await response.json();

      if (data.success && data.messages) {
        this.displayChatHistory(data.messages);
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  }

  displayChatHistory(messages) {
    if (!this.elements.chatHistory) return;

    this.elements.chatHistory.innerHTML = "";

    messages.forEach((message) => {
      this.addMessageToChat(message.role, message.content);
    });

    this.scrollChatToBottom();
  }

  addMessageToChat(role, content) {
    if (!this.elements.chatHistory) return;

    const messageDiv = document.createElement("div");
    messageDiv.className = `chat-message ${role}`;

    const messageContent = document.createElement("div");
    messageContent.className = "message-content";

    const messageHeader = document.createElement("div");
    messageHeader.className = "message-header";
    messageHeader.textContent = role === "user" ? "You" : "AI Assistant";

    const messageText = document.createElement("div");
    messageText.className = "message-text";
    messageText.innerHTML = this.formatMessageContent(content);

    messageContent.appendChild(messageHeader);
    messageContent.appendChild(messageText);
    messageDiv.appendChild(messageContent);

    this.elements.chatHistory.appendChild(messageDiv);
    this.scrollChatToBottom();
  }

  formatMessageContent(content) {
    // Basic markdown support
    if (typeof marked !== "undefined") {
      return marked.parse(content);
    }
    return content.replace(/\n/g, "<br>");
  }

  scrollChatToBottom() {
    if (this.elements.chatHistoryContainer) {
      this.elements.chatHistoryContainer.scrollTop =
        this.elements.chatHistoryContainer.scrollHeight;
    }
  }

  toggleChatHistory() {
    if (!this.elements.chatHistoryContainer) return;

    const isVisible =
      this.elements.chatHistoryContainer.style.display !== "none";
    this.elements.chatHistoryContainer.style.display = isVisible
      ? "none"
      : "block";

    if (!isVisible) {
      this.loadChatHistory();
    }
  }

  // ========== AUDIO STREAMING ==========

  async toggleAudioStreaming() {
    if (this.isStreaming) {
      await this.stopAudioStreaming();
    } else {
      await this.startAudioStreaming();
    }
  }

  async startAudioStreaming() {
    try {
      // Request microphone permission
      this.audioStreamStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Initialize WebSocket connection
      await this.initializeWebSocket();

      // Start recording
      this.audioStreamRecorder = new MediaRecorder(this.audioStreamStream, {
        mimeType: "audio/webm;codecs=opus",
      });

      this.audioStreamRecorder.ondataavailable = (event) => {
        if (
          event.data.size > 0 &&
          this.audioStreamSocket?.readyState === WebSocket.OPEN
        ) {
          this.sendAudioChunk(event.data);
        }
      };

      this.audioStreamRecorder.start(100); // Send chunks every 100ms
      this.isStreaming = true;

      this.updateStreamingUI(true);
      this.updateStreamingStatus("🎤 Recording started...", "success");
    } catch (error) {
      console.error("Error starting audio streaming:", error);
      this.showNotification(
        "Failed to start recording. Please check microphone permissions.",
        "error"
      );
      this.updateStreamingStatus("❌ Failed to start recording", "error");
    }
  }

  async stopAudioStreaming() {
    this.isStreaming = false;

    if (this.audioStreamRecorder) {
      this.audioStreamRecorder.stop();
    }

    if (this.audioStreamStream) {
      this.audioStreamStream.getTracks().forEach((track) => track.stop());
    }

    if (this.audioStreamSocket) {
      this.audioStreamSocket.close();
    }

    this.updateStreamingUI(false);
    this.updateStreamingStatus("🛑 Recording stopped", "info");
  }

  async initializeWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/audio-stream/${this.sessionId}`;

    this.audioStreamSocket = new WebSocket(wsUrl);

    return new Promise((resolve, reject) => {
      this.audioStreamSocket.onopen = () => {
        this.updateConnectionStatus("connected");
        this.sendPersonaUpdate();
        resolve();
      };

      this.audioStreamSocket.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.updateConnectionStatus("disconnected");
        reject(error);
      };

      this.audioStreamSocket.onmessage = (event) => {
        this.handleWebSocketMessage(JSON.parse(event.data));
      };

      this.audioStreamSocket.onclose = () => {
        this.updateConnectionStatus("disconnected");
      };
    });
  }

  sendAudioChunk(audioBlob) {
    if (this.audioStreamSocket?.readyState === WebSocket.OPEN) {
      audioBlob.arrayBuffer().then((buffer) => {
        this.audioStreamSocket.send(
          JSON.stringify({
            type: "audio_chunk",
            bytes: Array.from(new Uint8Array(buffer)),
          })
        );
      });
    }
  }

  handleWebSocketMessage(message) {
    switch (message.type) {
      case "transcription":
        this.handleTranscription(message);
        break;
      case "llm_response":
        this.handleLLMResponse(message);
        break;
      case "audio_response":
        this.handleAudioResponse(message);
        break;
      case "status_update":
        this.updateStreamingStatus(message.message, "info");
        break;
      case "error":
        this.updateStreamingStatus(`❌ ${message.message}`, "error");
        this.showNotification(message.message, "error");
        break;
    }
  }

  handleTranscription(message) {
    if (message.text) {
      this.addMessageToChat("user", message.text);
      this.updateStreamingStatus(`🗣️ You said: "${message.text}"`, "info");
    }
  }

  handleLLMResponse(message) {
    if (message.text) {
      this.addMessageToChat("assistant", message.text);
      this.updateStreamingStatus("🤖 AI response generated", "success");
    }
  }

  handleAudioResponse(message) {
    if (message.audio_url) {
      this.playAudioResponse(message.audio_url);
      this.updateStreamingStatus("🔊 Playing AI response...", "info");
    }
  }

  playAudioResponse(audioUrl) {
    const audio = new Audio(audioUrl);
    audio.play().catch((error) => {
      console.error("Error playing audio:", error);
      this.showNotification("Failed to play audio response", "error");
    });
  }

  sendPersonaUpdate() {
    if (this.audioStreamSocket?.readyState === WebSocket.OPEN) {
      this.audioStreamSocket.send(
        JSON.stringify({
          type: "persona_update",
          persona: this.selectedPersona,
        })
      );
    }
  }

  updateStreamingUI(isRecording) {
    if (!this.elements.audioStreamBtn) return;

    if (isRecording) {
      this.elements.audioStreamBtn.classList.add("recording");
      this.elements.audioStreamBtn.innerHTML = `
        <i class="fas fa-stop"></i>
        <span>Stop Recording</span>
      `;
    } else {
      this.elements.audioStreamBtn.classList.remove("recording", "processing");
      this.elements.audioStreamBtn.innerHTML = `
        <i class="fas fa-microphone"></i>
        <span>Start Recording</span>
      `;
    }
  }

  updateStreamingStatus(message, type = "info") {
    if (!this.elements.streamingStatusLog) return;

    const timestamp = new Date().toLocaleTimeString();
    const statusEntry = document.createElement("div");
    statusEntry.className = `status-entry ${type}`;
    statusEntry.textContent = `[${timestamp}] ${message}`;

    this.elements.streamingStatusLog.appendChild(statusEntry);
    this.elements.streamingStatusLog.scrollTop =
      this.elements.streamingStatusLog.scrollHeight;
  }

  // ========== QUICK ACTIONS ==========

  async handleWeatherRequest() {
    this.showNotification("Weather feature coming soon!", "info");
  }

  async handleMotivationRequest() {
    this.showNotification("Motivation feature coming soon!", "info");
  }

  // ========== UTILITY FUNCTIONS ==========

  generateSessionId() {
    return "session_" + Math.random().toString(36).substr(2, 9);
  }

  getSessionIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("session_id");
  }

  getPersonaDisplayName(persona) {
    const personas = {
      developer: "💻 Developer",
      jack: "🏴‍☠️ Captain Jack",
      vegeta: "👑 Vegeta",
      goku: "⚡ Goku",
      luffy: "🏴‍☠️ Luffy",
    };
    return personas[persona] || personas.developer;
  }

  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Global functions for HTML onclick handlers
function openSettingsModal() {
  window.voiceAgent.openSettingsModal();
}

function closeSettingsModal() {
  window.voiceAgent.closeSettingsModal();
}

function togglePasswordVisibility(inputId) {
  window.voiceAgent.togglePasswordVisibility(inputId);
}

function validateApiKey(service, inputId) {
  window.voiceAgent.validateApiKey(service, inputId);
}

function saveApiKeys() {
  window.voiceAgent.saveApiKeys();
}

function loadDefaultKeys() {
  window.voiceAgent.loadDefaultKeys();
}

// Initialize the application when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  window.voiceAgent = new VoiceAgentApp();

  // Global error handler
  window.addEventListener("error", function (e) {
    console.error("Global error:", e.error);
    if (window.voiceAgent) {
      window.voiceAgent.showNotification(
        "An unexpected error occurred",
        "error"
      );
    }
  });
});
