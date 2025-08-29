document.addEventListener("DOMContentLoaded", function () {
  // Global variables
  let sessionId =
    getSessionIdFromUrl() || window.SESSION_ID || generateSessionId();
  let currentAssistantText = ""; // For real-time chat history updates
  let selectedPersona = "developer"; // Default persona

  // DOM elements
  const toggleChatHistoryBtn = document.getElementById("toggleChatHistory");
  const chatHistoryContainer = document.getElementById("chatHistoryContainer");
  const personaSelect = document.getElementById("personaSelect");
  const getWeatherBtn = document.getElementById("getWeatherBtn");
  const getMotivationBtn = document.getElementById("getMotivationBtn");

  // Modal elements
  const conversationModal = document.getElementById("conversationModal");
  const closeModalBtn = document.getElementById("closeModal");
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  const modalQuestionContent = document.getElementById("modalQuestionContent");
  const modalResponseContent = document.getElementById("modalResponseContent");

  // Config modal elements
  const configBtn = document.getElementById("configBtn");
  const configModal = document.getElementById("configModal");
  const closeConfigModalBtn = document.getElementById("closeConfigModal");
  const saveConfigBtn = document.getElementById("saveConfigBtn");
  const testConfigBtn = document.getElementById("testConfigBtn");
  const configCancelBtn = document.getElementById("configCancelBtn");
  const configStatus = document.getElementById("configStatus");

  // Audio streaming variables
  let audioStreamSocket;
  let audioStreamRecorder;
  let audioStreamStream;
  // let isStreaming = false;

  // Audio playback variables
  let audioContext = null;
  let audioChunks = [];
  let playheadTime = 0;
  let isPlaying = false;
  let wavHeaderSet = true;
  const SAMPLE_RATE = 44100;

  const audioStreamBtn = document.getElementById("audioStreamBtn");
  const audioStreamStatus = document.getElementById("audioStreamStatus");
  const streamingStatusLog = document.getElementById("streamingStatusLog");
  const connectionStatus = document.getElementById("connectionStatus");
  const streamingSessionId = document.getElementById("streamingSessionId");

  // API key notice elements
  const apiKeyNotice = document.getElementById("apiKeyNotice");
  const openConfigFromNotice = document.getElementById("openConfigFromNotice");

  // Initialize session
  initializeSession();

  // Load API keys from local storage and check status
  loadApiKeysFromLocalStorage();

  // Check API keys on page load
  checkApiKeysStatus();

  // Event listeners
  if (toggleChatHistoryBtn) {
    toggleChatHistoryBtn.addEventListener("click", toggleChatHistory);
  }

  // Persona selection event listener
  if (personaSelect) {
    personaSelect.addEventListener("change", function () {
      selectedPersona = personaSelect.value;
      updateStreamingStatus(
        `🎭 Persona changed to: ${getPersonaDisplayName(selectedPersona)}`,
        "info"
      );

      // Send persona update to WebSocket if connected
      if (
        audioStreamSocket &&
        audioStreamSocket.readyState === WebSocket.OPEN
      ) {
        audioStreamSocket.send(
          JSON.stringify({
            type: "persona_update",
            persona: selectedPersona,
          })
        );
      }

      // Add animation effect
      const personaSelection = document.querySelector(".persona-selection");
      if (personaSelection) {
        personaSelection.classList.add("changing");
        setTimeout(() => {
          personaSelection.classList.remove("changing");
        }, 500);
      }

      // Update page title to show current persona
      document.title = `Voice Agent - ${getPersonaDisplayName(
        selectedPersona
      )}`;

      // Update persona badge
      const personaBadge = document.getElementById("currentPersona");
      if (personaBadge) {
        personaBadge.textContent =
          getPersonaDisplayName(selectedPersona).split(" ")[0]; // Get first word
        personaBadge.setAttribute("data-persona", selectedPersona); // Set data attribute for styling
      }
    });
  }

  // Weather button event listener
  if (getWeatherBtn) {
    getWeatherBtn.addEventListener("click", function () {
      handleWeatherRequest();
    });
  }

  // Motivation button event listener
  if (getMotivationBtn) {
    getMotivationBtn.addEventListener("click", function () {
      handleMotivationRequest();
    });
  }

  // Modal event listeners
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", closeModal);
  }
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", closeModal);
  }

  // Config modal event listeners
  if (configBtn) {
    configBtn.addEventListener("click", openConfigModal);
  }
  if (closeConfigModalBtn) {
    closeConfigModalBtn.addEventListener("click", closeConfigModal);
  }
  if (saveConfigBtn) {
    saveConfigBtn.addEventListener("click", saveApiConfig);
  }
  if (testConfigBtn) {
    testConfigBtn.addEventListener("click", testApiConfig);
  }
  if (configCancelBtn) {
    configCancelBtn.addEventListener("click", closeConfigModal);
  }

  // API key notice event listener
  if (openConfigFromNotice) {
    openConfigFromNotice.addEventListener("click", openConfigModal);
  }

  // Close modal when clicking outside
  if (conversationModal) {
    conversationModal.addEventListener("click", function (e) {
      if (e.target === conversationModal) {
        closeModal();
      }
    });
  }

  // Close config modal when clicking outside
  if (configModal) {
    configModal.addEventListener("click", function (e) {
      if (e.target === configModal) {
        closeConfigModal();
      }
    });
  }

  // Close modal with Escape key
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (conversationModal && conversationModal.style.display !== "none") {
        closeModal();
      }
      if (configModal && configModal.style.display !== "none") {
        closeConfigModal();
      }
    }
  });

  // Initialize streaming mode
  initializeStreamingMode();

  function getSessionIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("session_id");
  }

  function generateSessionId() {
    return (
      "session_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now()
    );
  }

  function getPersonaDisplayName(persona) {
    const personaNames = {
      developer: "Developer (Default)",
      jack: "Captain Jack Sparrow",
      vegeta: "Vegeta",
      goku: "Goku",
      luffy: "Monkey D. Luffy (One Piece)",
    };
    return personaNames[persona] || personaNames["developer"];
  }

  function updateUrlWithSessionId(sessionId) {
    const url = new URL(window.location);
    url.searchParams.set("session_id", sessionId);
    window.history.replaceState({}, "", url);
    const sessionIdElement = document.getElementById("sessionId");
    if (sessionIdElement) {
      sessionIdElement.textContent = sessionId;
    }
  }

  async function initializeSession() {
    updateUrlWithSessionId(sessionId);
    await loadChatHistory();

    // Initialize persona badge
    const personaBadge = document.getElementById("currentPersona");
    if (personaBadge) {
      personaBadge.textContent =
        getPersonaDisplayName(selectedPersona).split(" ")[0];
      personaBadge.setAttribute("data-persona", selectedPersona);
    }

    // Set initial page title
    document.title = `Voice Agent - ${getPersonaDisplayName(selectedPersona)}`;
  }

  function initializeStreamingMode() {
    const audioStreamBtn = document.getElementById("audioStreamBtn");
    if (audioStreamBtn) {
      audioStreamBtn.addEventListener("click", function () {
        const state = this.getAttribute("data-state");
        if (state === "disabled") {
          // Open config modal if button is disabled due to missing API keys
          updateStreamingStatus(
            "⚠️ Please configure your API keys first",
            "warning"
          );
          openConfigModal();
          return;
        }

        if (state === "ready") {
          // Check API keys before starting streaming
          checkApiKeysBeforeOperation().then((isValid) => {
            if (isValid) {
              startAudioStreaming();
            }
          });
        } else if (state === "recording") {
          stopAudioStreaming();
        }
      });
    }

    resetStreamingState();
    // Check API keys and update button state
    updateStreamingButtonState();
  }

  // Weather functionality
  let isWeatherMode = false; // Track if we're in weather listening mode

  function handleWeatherRequest() {
    // Check API keys before weather functionality
    checkApiKeysBeforeOperation().then((isValid) => {
      if (!isValid) return;

      // Instead of prompt, activate weather listening mode
      if (!isWeatherMode) {
        activateWeatherListeningMode();
      } else {
        deactivateWeatherListeningMode();
      }
    });
  }

  // Enhanced location extraction function for JavaScript
  function extractLocationFromText(text) {
    const lowerText = text.toLowerCase().trim();

    // Remove common prefixes and suffixes that people might say
    let cleanedText = lowerText
      .replace(/^(the|a|an)\s+/i, "")
      .replace(/\s+(please|thanks|thank you)$/i, "")
      .replace(/[?.,!]+$/, "");

    // Common patterns for weather queries - extract location part
    const patterns = [
      /(?:weather|temperature|temp|forecast)\s+(?:in|for|at|of)\s+(.+)/i,
      /(?:what's|what\s+is|whats)\s+the\s+(?:weather|temperature|temp|forecast)\s+(?:in|for|at|of)\s+(.+)/i,
      /(?:tell\s+me\s+)?(?:what's|what\s+is|whats)\s+the\s+(?:weather|temperature|temp|forecast)\s+(?:in|for|at|of)\s+(.+)/i,
      /(?:how's|how\s+is|hows)\s+the\s+(?:weather|temperature|temp|forecast)\s+(?:in|for|at|of)\s+(.+)/i,
      /(?:get|give\s+me|show\s+me)\s+(?:weather|temperature|temp|forecast)\s+(?:in|for|at|of)\s+(.+)/i,
    ];

    // Try pattern matching first
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let location = match[1].trim();
        location = location.replace(/[?.,!]+$/, "");
        return location;
      }
    }

    // Check for simple "in [location]" patterns
    const inPatterns = [
      /\bin\s+(.+)/i,
      /\bfor\s+(.+)/i,
      /\bat\s+(.+)/i,
      /\bof\s+(.+)/i,
    ];

    for (const pattern of inPatterns) {
      const match = cleanedText.match(pattern);
      if (match && match[1]) {
        let location = match[1].trim();
        location = location.replace(/[?.,!]+$/, "");
        // Filter out common non-location words
        if (
          !location.match(
            /^(me|you|us|them|it|here|there|now|today|tomorrow)$/i
          )
        ) {
          return location;
        }
      }
    }

    // If no pattern found, assume the entire text is the location
    // This handles cases where user just says "Mumbai" or "New York"
    const finalLocation = cleanedText.replace(/[?.,!]+$/, "");

    // Filter out very short or common non-location phrases
    if (
      finalLocation.length >= 2 &&
      !finalLocation.match(
        /^(yes|no|ok|okay|sure|hi|hello|hey|thanks|thank you|please)$/i
      )
    ) {
      return finalLocation;
    }

    // Fallback to original text
    return text.trim().replace(/[?.,!]+$/, "");
  }

  function activateWeatherListeningMode() {
    isWeatherMode = true;
    const weatherBtn = document.getElementById("getWeatherBtn");
    const instructionPanel = document.getElementById("weatherInstructionPanel");

    // Show instruction panel
    if (instructionPanel) {
      instructionPanel.style.display = "block";
    }

    // Update button appearance
    if (weatherBtn) {
      weatherBtn.innerHTML = `
        <span class="btn-icon">🎤</span>
        <span class="btn-text">Listening for Location...</span>
      `;
      weatherBtn.classList.add("listening");
      weatherBtn.setAttribute("data-state", "listening");
    }

    // Show prominent instruction in status
    updateStreamingStatus(
      "🌤️ WEATHER MODE ACTIVATED: Only speak the location name (e.g., 'New York', 'London', 'Mumbai')",
      "info"
    );

    // Add a secondary instruction
    setTimeout(() => {
      if (isWeatherMode) {
        updateStreamingStatus(
          "📍 Just say the city/location name - no need for full sentences!",
          "info"
        );
      }
    }, 2000);

    // Start audio streaming if not already active
    if (!audioStreamSocket || audioStreamSocket.readyState !== WebSocket.OPEN) {
      startAudioStreaming()
        .then(() => {
          updateStreamingStatus(
            "🎤 Ready! Just speak the location name (e.g., 'Mumbai', 'New York', 'Tokyo')...",
            "info"
          );
        })
        .catch((error) => {
          console.error("Failed to start audio streaming for weather:", error);
          deactivateWeatherListeningMode();
          updateStreamingStatus("❌ Failed to activate weather mode", "error");
        });
    } else {
      updateStreamingStatus(
        "🎤 Ready! Just speak the location name (e.g., 'Mumbai', 'New York', 'Tokyo')...",
        "info"
      );
    }
  }

  function deactivateWeatherListeningMode() {
    isWeatherMode = false;
    const weatherBtn = document.getElementById("getWeatherBtn");
    const instructionPanel = document.getElementById("weatherInstructionPanel");

    // Hide instruction panel
    if (instructionPanel) {
      instructionPanel.style.display = "none";
    }

    // Reset button appearance
    if (weatherBtn) {
      weatherBtn.innerHTML = `
        <span class="btn-icon">🌤️</span>
        <span class="btn-text">Get Weather Info</span>
      `;
      weatherBtn.classList.remove("listening");
      weatherBtn.setAttribute("data-state", "ready");
    }

    updateStreamingStatus("🌤️ Weather mode deactivated", "info");
  }

  async function getWeatherInfo(location) {
    try {
      // Ensure WebSocket connection is established
      if (
        !audioStreamSocket ||
        audioStreamSocket.readyState !== WebSocket.OPEN
      ) {
        updateStreamingStatus(
          "🔗 Connecting to get weather information...",
          "info"
        );
        await startAudioStreaming();
        // Wait a moment for connection to establish
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (
        audioStreamSocket &&
        audioStreamSocket.readyState === WebSocket.OPEN
      ) {
        // Send weather request
        const weatherRequest = {
          type: "get_weather",
          location: location,
        };

        audioStreamSocket.send(JSON.stringify(weatherRequest));
        updateStreamingStatus(
          `🌤️ Requesting weather for ${location}...`,
          "info"
        );
      } else {
        updateStreamingStatus(
          "❌ Failed to connect for weather request",
          "error"
        );
      }
    } catch (error) {
      console.error("Error getting weather info:", error);
      updateStreamingStatus("❌ Error getting weather information", "error");
    }
  }

  // Motivation functionality
  async function handleMotivationRequest() {
    // Check API keys before motivation functionality
    if (!(await checkApiKeysBeforeOperation())) {
      return;
    }

    const motivationBtn = document.getElementById("getMotivationBtn");

    try {
      // Update button to show processing state
      if (motivationBtn) {
        motivationBtn.innerHTML = `
          <span class="btn-icon">⏳</span>
          <span class="btn-text">Generating Quote...</span>
        `;
        motivationBtn.classList.add("processing");
        motivationBtn.disabled = true;
      }

      updateStreamingStatus(
        "💪 Generating the best motivational quote for you...",
        "info"
      );

      // Ensure WebSocket connection is established
      if (
        !audioStreamSocket ||
        audioStreamSocket.readyState !== WebSocket.OPEN
      ) {
        updateStreamingStatus(
          "🔗 Connecting to get motivational quote...",
          "info"
        );
        await startAudioStreaming();
        // Wait a moment for connection to establish
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (
        audioStreamSocket &&
        audioStreamSocket.readyState === WebSocket.OPEN
      ) {
        // Send quote request
        const quoteRequest = {
          type: "get_quote",
        };

        audioStreamSocket.send(JSON.stringify(quoteRequest));
        updateStreamingStatus("💪 Fetching motivational quote...", "info");
      } else {
        updateStreamingStatus(
          "❌ Failed to connect for quote request",
          "error"
        );
        resetMotivationButton();
      }
    } catch (error) {
      console.error("Error getting motivational quote:", error);
      updateStreamingStatus("❌ Error getting motivational quote", "error");
      resetMotivationButton();
    }
  }

  function resetMotivationButton() {
    const motivationBtn = document.getElementById("getMotivationBtn");
    if (motivationBtn) {
      motivationBtn.innerHTML = `
        <span class="btn-icon">💪</span>
        <span class="btn-text">Get Motivation</span>
      `;
      motivationBtn.classList.remove("processing");
      motivationBtn.disabled = false;
    }
  }

  function displayWeatherResponse(data) {
    // Add weather response to chat history
    const chatHistoryList = document.getElementById("chatHistoryList");
    if (chatHistoryList) {
      const weatherItem = document.createElement("div");
      weatherItem.className = "chat-item";
      weatherItem.innerHTML = `
        <div class="chat-message user">
          <div class="message-header">
            <span class="role">👤 You</span>
            <span class="timestamp">${new Date().toLocaleTimeString()}</span>
          </div>
          <div class="message-content">Get weather for ${data.location}</div>
        </div>
        <div class="chat-message assistant">
          <div class="message-header">
            <span class="role">🌤️ Weather</span>
            <span class="timestamp">${new Date().toLocaleTimeString()}</span>
          </div>
          <div class="message-content weather-response">
            <div class="weather-info">
              <h4>${data.location}</h4>
              <div class="weather-details">
                <span class="temperature">${data.temperature}°C</span>
                <span class="description">${data.description}</span>
              </div>
              <div class="weather-extra">
                <small>${data.weather_report
                  .replace(data.location + ":\\n", "")
                  .replace(/\\n/g, " • ")}</small>
              </div>
            </div>
          </div>
        </div>
      `;
      chatHistoryList.appendChild(weatherItem);

      // Scroll to bottom
      chatHistoryList.scrollTop = chatHistoryList.scrollHeight;
    }

    updateStreamingStatus(
      `✅ Weather information retrieved for ${data.location}`,
      "success"
    );
  }

  function displayWeatherError(message) {
    updateStreamingStatus(`❌ ${message}`, "error");

    // Also add to chat history
    const chatHistoryList = document.getElementById("chatHistoryList");
    if (chatHistoryList) {
      const errorItem = document.createElement("div");
      errorItem.className = "chat-item";
      errorItem.innerHTML = `
        <div class="chat-message assistant error">
          <div class="message-header">
            <span class="role">🌤️ Weather</span>
            <span class="timestamp">${new Date().toLocaleTimeString()}</span>
          </div>
          <div class="message-content">${message}</div>
        </div>
      `;
      chatHistoryList.appendChild(errorItem);
      chatHistoryList.scrollTop = chatHistoryList.scrollHeight;
    }
  }

  function displayQuoteResponse(data) {
    console.log("Displaying quote response:", data); // Debug log

    // Add quote response to chat history
    const chatHistoryList = document.getElementById("chatHistoryList");
    if (chatHistoryList) {
      const quoteItem = document.createElement("div");
      quoteItem.className = "chat-item";
      quoteItem.innerHTML = `
        <div class="chat-message user">
          <div class="message-header">
            <span class="role">👤 You</span>
            <span class="timestamp">${new Date().toLocaleTimeString()}</span>
          </div>
          <div class="message-content">Get motivational quote</div>
        </div>
        <div class="chat-message assistant">
          <div class="message-header">
            <span class="role">💪 Motivation</span>
            <span class="timestamp">${new Date().toLocaleTimeString()}</span>
          </div>
          <div class="message-content quote-response">
            <div class="quote-info">
              <div class="quote-text">"${
                data.quote || "Quote not available"
              }"</div>
              <div class="quote-author">— ${data.author || "Unknown"}</div>
            </div>
          </div>
        </div>
      `;
      chatHistoryList.appendChild(quoteItem);

      // Scroll to bottom
      chatHistoryList.scrollTop = chatHistoryList.scrollHeight;
    }

    // Also display in AI response area (current agent output section)
    updateAIResponseDisplay(data.quote, data.author);

    updateStreamingStatus(
      `✅ Motivational quote received from ${data.author}`,
      "success"
    );

    // Send quote to TTS for audio playback
    if (data.quote) {
      const quoteForTTS = `${data.quote}. Quote by ${data.author}`;
      triggerTTSForQuote(quoteForTTS);
    }
  }

  function updateAIResponseDisplay(quote, author) {
    console.log("Updating AI response display with:", quote, author); // Debug log

    // Find or create AI response display area
    let responseArea = document.getElementById("aiResponseArea");
    if (!responseArea) {
      // Create the response area if it doesn't exist
      responseArea = document.createElement("div");
      responseArea.id = "aiResponseArea";
      responseArea.className = "ai-response-area";

      // Insert it after the audio playback container
      const audioPlaybackContainer = document.getElementById(
        "audioPlaybackStatus"
      );
      if (audioPlaybackContainer) {
        audioPlaybackContainer.parentNode.insertBefore(
          responseArea,
          audioPlaybackContainer.nextSibling
        );
      } else {
        // Fallback: append to main card
        const mainCard = document.querySelector(".card");
        if (mainCard) {
          mainCard.appendChild(responseArea);
        }
      }
    }

    // Update content with proper quote display - ensure consistent styling
    responseArea.innerHTML = `
      <h4>🤖 AI Response:</h4>
      <div class="current-response quote-display">
        <div class="current-quote">"${quote || "Quote not available"}"</div>
        <div class="current-author">— ${author || "Unknown"}</div>
      </div>
    `;

    // Force display and apply styles
    responseArea.style.display = "block";

    // Ensure the quote display gets the right styling by triggering a layout recalculation
    responseArea.offsetHeight;

    // Add animation class for smooth appearance
    responseArea.classList.add("quote-animated");
    setTimeout(() => {
      responseArea.classList.remove("quote-animated");
    }, 500);
  }

  function triggerTTSForQuote(quoteText) {
    // Use the browser's built-in speech synthesis for quotes since they're short
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(quoteText);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;

      // Show audio playback indicator
      showAudioPlaybackIndicator();
      updateStreamingStatus("🔊 Playing motivational quote...", "info");

      utterance.onend = function () {
        hideAudioPlaybackIndicator();
        updateStreamingStatus("✅ Quote playback completed", "success");
      };

      utterance.onerror = function () {
        hideAudioPlaybackIndicator();
        updateStreamingStatus("❌ TTS playback failed", "error");
      };

      speechSynthesis.speak(utterance);
    } else {
      updateStreamingStatus(
        "❌ Speech synthesis not supported in this browser",
        "error"
      );
    }
  }

  async function loadChatHistory() {
    try {
      const response = await fetch(`/agent/chat/${sessionId}/history`);
      const data = await response.json();
      if (data.success && data.messages.length > 0) {
        displayChatHistory(data.messages);
        showMessage(
          `Previous session loaded with ${data.message_count} messages. Click "Show Chat History" to view them.`,
          "success"
        );
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
    }
  }

  function displayChatHistory(messages) {
    const chatHistoryList = document.getElementById("chatHistoryList");
    if (!chatHistoryList) return;

    chatHistoryList.innerHTML = "";

    if (messages.length === 0) {
      chatHistoryList.innerHTML =
        '<p class="no-history">No previous messages in this session.</p>';
      return;
    }

    // Group messages by conversation pairs (user + assistant)
    const conversations = [];
    for (let i = 0; i < messages.length; i += 2) {
      const userMsg = messages[i];
      const assistantMsg = messages[i + 1];
      if (
        userMsg &&
        userMsg.role === "user" &&
        assistantMsg &&
        assistantMsg.role === "assistant"
      ) {
        conversations.push({ user: userMsg, assistant: assistantMsg });
      } else if (userMsg && userMsg.role === "user") {
        // Handle case where user message doesn't have corresponding assistant message
        conversations.push({ user: userMsg, assistant: null });
      }
    }

    conversations.forEach((conv, index) => {
      const conversationDiv = document.createElement("div");
      conversationDiv.className = "conversation-pair";

      // User message
      const userDiv = document.createElement("div");
      userDiv.className = "chat-message user";
      userDiv.innerHTML = `
        <div class="message-header">
          <span class="message-role">👤 You</span>
          <small class="message-time">${new Date(
            conv.user.timestamp
          ).toLocaleString()}</small>
        </div>
        <div class="message-content">${conv.user.content}</div>
      `;

      // Assistant message
      const assistantDiv = document.createElement("div");
      assistantDiv.className = "chat-message assistant";
      if (conv.assistant) {
        // Parse markdown content if available
        let assistantContent = conv.assistant.content;
        try {
          if (typeof marked !== "undefined") {
            assistantContent = marked.parse(conv.assistant.content);
          }
        } catch (error) {
          console.warn("Markdown parsing error:", error);
        }

        assistantDiv.innerHTML = `
          <div class="message-header">
            <span class="message-role">🤖 AI Assistant</span>
            <small class="message-time">${new Date(
              conv.assistant.timestamp
            ).toLocaleString()}</small>
          </div>
          <div class="message-content">${assistantContent}</div>
        `;
      } else {
        assistantDiv.innerHTML = `
          <div class="message-header">
            <span class="message-role">🤖 AI Assistant</span>
            <small class="message-time">Pending...</small>
          </div>
          <div class="message-content"><em>Response pending...</em></div>
        `;
      }

      conversationDiv.appendChild(userDiv);
      conversationDiv.appendChild(assistantDiv);

      // Add click event listener to open modal
      conversationDiv.addEventListener("click", function () {
        const userMessage = conv.user.content;
        const assistantMessage = conv.assistant
          ? conv.assistant.content
          : "No response available";
        openConversationModal(userMessage, assistantMessage);
      });

      chatHistoryList.appendChild(conversationDiv);
    });

    // Apply syntax highlighting to code blocks if available
    if (typeof hljs !== "undefined") {
      chatHistoryList.querySelectorAll("pre code").forEach((block) => {
        hljs.highlightElement(block);
      });
    }
  }

  function toggleChatHistory() {
    if (chatHistoryContainer) {
      const isVisible = chatHistoryContainer.style.display !== "none";
      chatHistoryContainer.style.display = isVisible ? "none" : "block";

      if (toggleChatHistoryBtn) {
        toggleChatHistoryBtn.textContent = isVisible
          ? "Show Chat History"
          : "Hide Chat History";
      }

      if (!isVisible) {
        // Reload chat history when showing
        loadChatHistory();
      }
    }
  }

  // Modal Functions
  function openConversationModal(userMessage, assistantMessage) {
    if (!conversationModal || !modalQuestionContent || !modalResponseContent)
      return;

    // Set the content
    modalQuestionContent.textContent = userMessage;

    // Parse assistant message as markdown
    try {
      if (typeof marked !== "undefined" && assistantMessage) {
        const markdownHtml = marked.parse(assistantMessage);
        modalResponseContent.innerHTML = markdownHtml;

        // Apply syntax highlighting if available
        if (typeof hljs !== "undefined") {
          modalResponseContent.querySelectorAll("pre code").forEach((block) => {
            hljs.highlightElement(block);
          });
        }
      } else {
        modalResponseContent.innerHTML = assistantMessage
          ? assistantMessage.replace(/\n/g, "<br>")
          : "No response available";
      }
    } catch (error) {
      console.warn("Markdown parsing error in modal:", error);
      modalResponseContent.innerHTML = assistantMessage
        ? assistantMessage.replace(/\n/g, "<br>")
        : "No response available";
    }

    // Show the modal
    conversationModal.style.display = "flex";
    document.body.style.overflow = "hidden"; // Prevent background scrolling
  }

  function closeModal() {
    if (conversationModal) {
      conversationModal.style.display = "none";
      document.body.style.overflow = ""; // Restore scrolling
    }
  }

  // ==================== CONFIG MODAL FUNCTIONALITY ====================

  function openConfigModal() {
    if (configModal) {
      configModal.style.display = "flex";
      document.body.style.overflow = "hidden"; // Prevent background scrolling

      // Add a slight delay to ensure proper rendering
      setTimeout(() => {
        configModal.style.opacity = "1";
        loadCurrentConfig();
      }, 10);
    }
  }

  function closeConfigModal() {
    if (configModal) {
      configModal.style.opacity = "0";
      setTimeout(() => {
        configModal.style.display = "none";
        document.body.style.overflow = ""; // Restore scrolling
        hideConfigStatus();
        // Recheck API keys when modal is closed
        checkApiKeysStatus();
      }, 200);
    }
  }

  async function loadCurrentConfig() {
    try {
      const response = await fetch("/api/config");
      if (response.ok) {
        const config = await response.json();

        // Don't populate actual keys for security, just indicate if they exist
        document.getElementById("geminiApiKey").placeholder =
          config.gemini_api_key
            ? "Current key set (***)"
            : "Enter your Gemini API key";
        document.getElementById("assemblyaiApiKey").placeholder =
          config.assemblyai_api_key
            ? "Current key set (***)"
            : "Enter your AssemblyAI API key";
        document.getElementById("murfApiKey").placeholder = config.murf_api_key
          ? "Current key set (***)"
          : "Enter your Murf API key";
        document.getElementById("openweatherApiKey").placeholder =
          config.openweather_api_key
            ? "Current key set (***)"
            : "Enter your OpenWeather API key";

        // Set voice ID if available
        if (config.murf_voice_id) {
          document.getElementById("murfVoiceId").value = config.murf_voice_id;
        }
      }
    } catch (error) {
      console.error("Error loading config:", error);
      showConfigStatus("Error loading current configuration", "error");
    }
  }

  async function saveApiConfig() {
    try {
      const config = {
        gemini_api_key:
          document.getElementById("geminiApiKey").value.trim() || null,
        assemblyai_api_key:
          document.getElementById("assemblyaiApiKey").value.trim() || null,
        murf_api_key:
          document.getElementById("murfApiKey").value.trim() || null,
        murf_voice_id:
          document.getElementById("murfVoiceId").value.trim() || "en-IN-aarav",
        openweather_api_key:
          document.getElementById("openweatherApiKey").value.trim() || null,
      };

      // Validate required fields
      const requiredFields = [
        { field: "gemini_api_key", name: "Gemini API Key" },
        { field: "assemblyai_api_key", name: "AssemblyAI API Key" },
        { field: "murf_api_key", name: "Murf API Key" },
      ];

      const missingFields = requiredFields.filter(
        (item) => !config[item.field]
      );
      if (missingFields.length > 0) {
        const missingNames = missingFields.map((item) => item.name).join(", ");
        showConfigStatus(
          `Please provide the following required API keys: ${missingNames}`,
          "error"
        );
        return;
      }

      // Show loading state
      saveConfigBtn.disabled = true;
      saveConfigBtn.textContent = "Saving...";

      const response = await fetch("/api/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Save API keys to local storage
          saveApiKeysToLocalStorage(config);

          if (result.services_initialized) {
            showConfigStatus(
              "✅ Configuration saved successfully! All services are now active and ready to use.",
              "success"
            );
            // Hide API key notice if it was showing
            if (apiKeyNotice) {
              apiKeyNotice.style.display = "none";
            }
            // Enable streaming button
            updateStreamingButtonState(true);

            // Close the modal after successful save
            setTimeout(() => {
              closeConfigModal();
            }, 1500); // Give user time to see success message
          } else {
            const missingKeys = result.missing_keys.join(", ");
            showConfigStatus(
              `⚠️ Configuration saved but missing keys: ${missingKeys}. Voice agent will not function until all required keys are provided.`,
              "warning"
            );
            // Keep showing API key notice
            if (apiKeyNotice) {
              apiKeyNotice.style.display = "block";
            }
            // Keep streaming button disabled
            updateStreamingButtonState(false);

            // Still close the modal even with warning, but after longer delay
            setTimeout(() => {
              closeConfigModal();
            }, 2500);
          }

          // Clear the form fields for security
          document.getElementById("geminiApiKey").value = "";
          document.getElementById("assemblyaiApiKey").value = "";
          document.getElementById("murfApiKey").value = "";
          document.getElementById("openweatherApiKey").value = "";

          // Update placeholders to show keys are set
          setTimeout(() => {
            loadCurrentConfig();
          }, 1000);
        } else {
          showConfigStatus(`Error: ${result.message}`, "error");
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("Error saving config:", error);
      showConfigStatus(
        "Error saving configuration. Please try again.",
        "error"
      );
    } finally {
      saveConfigBtn.disabled = false;
      saveConfigBtn.textContent = "Save Configuration";
    }
  }

  async function testApiConfig() {
    try {
      testConfigBtn.disabled = true;
      testConfigBtn.textContent = "Testing...";

      const response = await fetch("/api/config/status");
      if (response.ok) {
        const status = await response.json();

        if (status.keys_valid) {
          const servicesList = Object.entries(status.services)
            .filter(([key, value]) => value)
            .map(([key, value]) => key)
            .join(", ");

          showConfigStatus(
            `✅ Configuration is valid! Active services: ${servicesList}`,
            "success"
          );
        } else {
          const missingKeys = status.missing_keys.join(", ");
          showConfigStatus(
            `❌ Missing required API keys: ${missingKeys}. Voice agent cannot function without these keys.`,
            "error"
          );
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("Error testing config:", error);
      showConfigStatus(
        "Error testing configuration. Please try again.",
        "error"
      );
    } finally {
      testConfigBtn.disabled = false;
      testConfigBtn.textContent = "Test Services";
    }
  }

  function showConfigStatus(message, type) {
    if (configStatus) {
      const statusMessage = configStatus.querySelector(".status-message");
      if (statusMessage) {
        statusMessage.textContent = message;
      }

      configStatus.className = `config-status ${type}`;
      configStatus.style.display = "block";

      // Auto-hide success messages after 5 seconds
      if (type === "success") {
        setTimeout(() => {
          hideConfigStatus();
        }, 5000);
      }
    }
  }

  function hideConfigStatus() {
    if (configStatus) {
      configStatus.style.display = "none";
    }
  }

  function showMessage(message, type) {
    // Simple console log for now - can be enhanced with UI notifications
  }

  // ==================== AUDIO STREAMING FUNCTIONALITY ====================

  // Add API key status checking function
  async function checkApiKeysStatus() {
    try {
      const response = await fetch("/api/config/status");
      if (response.ok) {
        const status = await response.json();
        if (apiKeyNotice) {
          if (!status.keys_valid) {
            apiKeyNotice.style.display = "block";
          } else {
            apiKeyNotice.style.display = "none";
          }
        }
        // Update streaming button state based on API key status
        updateStreamingButtonState(status.keys_valid);
      }
    } catch (error) {
      console.error("Error checking API keys status:", error);
      if (apiKeyNotice) {
        apiKeyNotice.style.display = "block";
      }
      // Disable streaming button on error
      updateStreamingButtonState(false);
    }
  }

  // Add API key validation function
  async function checkApiKeysBeforeOperation() {
    try {
      const response = await fetch("/api/config/status");
      if (response.ok) {
        const status = await response.json();
        if (!status.keys_valid) {
          const missingKeys = status.missing_keys.join(", ");
          showConfigStatus(
            `❌ Cannot start voice agent. Missing required API keys: ${missingKeys}. Please configure your API keys first.`,
            "error"
          );
          openConfigModal(); // Automatically open config modal
          return false;
        }
        return true;
      }
    } catch (error) {
      console.error("Error checking API keys:", error);
      showConfigStatus(
        "❌ Error checking API key configuration. Please ensure your API keys are properly configured.",
        "error"
      );
      openConfigModal();
      return false;
    }
  }

  // Local Storage API Key Management
  function saveApiKeysToLocalStorage(apiKeys) {
    try {
      localStorage.setItem("voiceAgentApiKeys", JSON.stringify(apiKeys));
      console.log("API keys saved to local storage");
    } catch (error) {
      console.error("Error saving API keys to local storage:", error);
    }
  }

  function loadApiKeysFromLocalStorage() {
    try {
      const savedKeys = localStorage.getItem("voiceAgentApiKeys");
      if (savedKeys) {
        const apiKeys = JSON.parse(savedKeys);
        console.log("API keys loaded from local storage");
        // Auto-populate the config modal if it exists
        populateConfigModal(apiKeys);
        // Send keys to backend
        sendApiKeysToBackend(apiKeys);
        return apiKeys;
      }
    } catch (error) {
      console.error("Error loading API keys from local storage:", error);
    }
    return null;
  }

  function clearApiKeysFromLocalStorage() {
    try {
      localStorage.removeItem("voiceAgentApiKeys");
      console.log("API keys cleared from local storage");
    } catch (error) {
      console.error("Error clearing API keys from local storage:", error);
    }
  }

  async function sendApiKeysToBackend(apiKeys) {
    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiKeys),
      });

      if (response.ok) {
        console.log("API keys sent to backend successfully");
        // Recheck status after sending keys
        checkApiKeysStatus();
      }
    } catch (error) {
      console.error("Error sending API keys to backend:", error);
    }
  }

  function populateConfigModal(apiKeys) {
    if (apiKeys.gemini_api_key) {
      const geminiField = document.getElementById("geminiApiKey");
      if (geminiField) geminiField.value = apiKeys.gemini_api_key;
    }
    if (apiKeys.assemblyai_api_key) {
      const assemblyaiField = document.getElementById("assemblyaiApiKey");
      if (assemblyaiField) assemblyaiField.value = apiKeys.assemblyai_api_key;
    }
    if (apiKeys.murf_api_key) {
      const murfField = document.getElementById("murfApiKey");
      if (murfField) murfField.value = apiKeys.murf_api_key;
    }
    if (apiKeys.openweather_api_key) {
      const weatherField = document.getElementById("openweatherApiKey");
      if (weatherField) weatherField.value = apiKeys.openweather_api_key;
    }
  }

  // Streaming Button State Management
  function updateStreamingButtonState(keysValid = false) {
    const audioStreamBtn = document.getElementById("audioStreamBtn");
    if (audioStreamBtn) {
      if (!keysValid) {
        // Disable the button when API keys are not valid
        audioStreamBtn.disabled = true;
        audioStreamBtn.classList.add("disabled");
        audioStreamBtn.innerHTML = `
          <span class="btn-icon">🔒</span>
          <span class="btn-text">API Keys Required</span>
        `;
        audioStreamBtn.setAttribute("data-state", "disabled");
        audioStreamBtn.title =
          "Please configure your API keys to use voice streaming";
      } else {
        // Enable the button when API keys are valid
        audioStreamBtn.disabled = false;
        audioStreamBtn.classList.remove("disabled");
        audioStreamBtn.innerHTML = `
          <span class="btn-icon">🎤</span>
          <span class="btn-text">Start Voice Streaming</span>
        `;
        audioStreamBtn.setAttribute("data-state", "ready");
        audioStreamBtn.title = "Start voice streaming";
      }
    }
  }

  async function startAudioStreaming() {
    try {
      // Check API keys before starting
      if (!(await checkApiKeysBeforeOperation())) {
        return; // Don't start if API keys are missing
      }

      // Reset streaming state and UI
      resetStreamingState();

      updateConnectionStatus("connecting", "Connecting...");

      // Clear any previous transcriptions
      clearPreviousTranscriptions();

      // Connect to WebSocket with session ID
      audioStreamSocket = new WebSocket(
        `ws://localhost:8000/ws/audio-stream?session_id=${sessionId}`
      );

      audioStreamSocket.onopen = function (event) {
        updateConnectionStatus("connected", "Connected");
        updateStreamingStatus("Connected to server", "success");

        // Send session ID and persona to establish the session on the backend
        audioStreamSocket.send(
          JSON.stringify({
            type: "session_id",
            session_id: sessionId,
            persona: selectedPersona,
          })
        );
      };

      audioStreamSocket.onmessage = function (event) {
        const data = JSON.parse(event.data);

        // Handle API keys required message
        if (data.type === "api_keys_required") {
          updateStreamingStatus("❌ " + data.message, "error");
          showConfigStatus(
            data.message + " Missing keys: " + data.missing_keys.join(", "),
            "error"
          );
          openConfigModal();
          resetStreamingState();
          updateStreamingButtonState(false); // Disable button when API keys are missing
          return;
        }

        if (data.type === "audio_stream_ready") {
          updateStreamingStatus(
            `Ready to stream audio with transcription. Session: ${data.session_id}`,
            "info"
          );
          streamingSessionId.textContent = `Session: ${data.session_id}`;

          // Ensure the frontend session ID matches the backend
          if (data.session_id !== sessionId) {
            sessionId = data.session_id;
            updateUrlWithSessionId(sessionId);
          }

          if (data.transcription_enabled) {
            updateStreamingStatus(
              "🎙️ Real-time transcription enabled",
              "success"
            );
          }
          startRecordingForStreaming();
        } else if (data.type === "chunk_ack") {
          // Removed excessive chunk acknowledgment logging
        } else if (data.type === "command_response") {
          updateStreamingStatus(data.message, "info");
        } else if (data.type === "transcription_ready") {
          updateStreamingStatus("🎯 " + data.message, "success");
        } else if (data.type === "final_transcript") {
          // Display final transcription only if we have text
          if (data.text && data.text.trim()) {
            updateStreamingStatus(`🎙️ FINAL: "${data.text}"`, "recording");

            // Check if we're in weather mode and process the location
            if (isWeatherMode) {
              const extractedLocation = extractLocationFromText(
                data.text.trim()
              );
              updateStreamingStatus(
                `📍 Detected location: "${extractedLocation}" - Getting weather info...`,
                "info"
              );
              getWeatherInfo(extractedLocation);
              deactivateWeatherListeningMode();
            }
          }
        } else if (data.type === "partial_transcript") {
          // Show partial transcripts for feedback
          if (data.text && data.text.trim()) {
            updateStreamingStatus(`🎙️ ${data.text}`, "info");
          }
        } else if (data.type === "turn_end") {
          updateStreamingStatus(
            "🛑 Turn ended - User stopped talking",
            "success"
          );
          if (data.final_transcript && data.final_transcript.trim()) {
            updateStreamingStatus(
              `✅ TURN COMPLETE: "${data.final_transcript}"`,
              "success"
            );

            // Check if we're in weather mode and process the location
            if (isWeatherMode) {
              const extractedLocation = extractLocationFromText(
                data.final_transcript.trim()
              );
              updateStreamingStatus(
                `📍 Detected location: "${extractedLocation}" - Getting weather info...`,
                "info"
              );
              getWeatherInfo(extractedLocation);
              deactivateWeatherListeningMode();
            }
          } else {
            updateStreamingStatus(
              "⚠️ Turn ended but no speech detected",
              "warning"
            );
            showNoSpeechMessage();
          }
        } else if (data.type === "transcription_complete") {
          if (data.text && data.text.trim()) {
            updateStreamingStatus(
              `✅ COMPLETE TRANSCRIPTION: "${data.text}"`,
              "success"
            );
          } else {
            updateStreamingStatus(
              "⚠️ No speech detected in recording",
              "warning"
            );
            showNoSpeechMessage();
          }
        } else if (data.type === "streaming_complete") {
          updateStreamingStatus(`🎯 ${data.message}`, "success");
          if (!data.transcription || !data.transcription.trim()) {
            updateStreamingStatus(
              "⚠️ Recording completed but no speech was detected",
              "warning"
            );
            showNoSpeechMessage();
          }
        } else if (data.type === "transcription_error") {
          updateStreamingStatus(
            "❌ Transcription error: " + data.message,
            "error"
          );
        } else if (data.type === "transcription_stopped") {
          updateStreamingStatus("🛑 " + data.message, "warning");
        } else if (data.type === "llm_streaming_start") {
          updateStreamingStatus(`🤖 ${data.message}`, "info");
          resetAudioPlayback();
          displayLLMStreamingStart(data.user_message);
          // Add user message to chat history immediately
          addUserMessageToChatHistory(data.user_message);
        } else if (data.type === "llm_streaming_chunk") {
          // Display LLM text chunks as they arrive
          displayLLMTextChunk(data.chunk, data.accumulated_length);
          // Update the assistant response in chat history in real-time
          updateAssistantResponseInChatHistory(data.chunk);
        } else if (data.type === "tts_streaming_start") {
          updateStreamingStatus(`🎵 ${data.message}`, "info");
          displayTTSStreamingStart();
        } else if (data.type === "tts_audio_chunk") {
          // Handle audio base64 chunks from TTS
          handleAudioChunk(data);
        } else if (data.type === "tts_status") {
          // Removed excessive TTS status logging
        } else if (data.type === "llm_streaming_complete") {
          updateStreamingStatus(`✅ ${data.message}`, "success");
          displayStreamingComplete(data);

          // Chat history is now updated in real-time when response is saved
          // No need for delayed reload
        } else if (data.type === "llm_streaming_error") {
          updateStreamingStatus(`❌ ${data.message}`, "error");
        } else if (data.type === "tts_streaming_error") {
          updateStreamingStatus(`❌ ${data.message}`, "error");
        } else if (data.type === "response_saved") {
          updateStreamingStatus(`💾 ${data.message}`, "success");
          // Response is already being updated in real-time, just mark as saved
          markResponseAsSaved();
        } else if (data.type === "persona_updated") {
          updateStreamingStatus(`🎭 ${data.message}`, "success");
          // Update the persona badge to reflect the change
          const personaBadge = document.getElementById("currentPersona");
          if (personaBadge) {
            personaBadge.textContent = getPersonaDisplayName(
              data.persona
            ).split(" ")[0];
            personaBadge.setAttribute("data-persona", data.persona);
          }
        } else if (data.type === "weather_request_start") {
          updateStreamingStatus(`🌤️ ${data.message}`, "info");
        } else if (data.type === "weather_location_detected") {
          updateStreamingStatus(`✅ ${data.message}`, "success");
        } else if (data.type === "weather_response") {
          if (data.success) {
            displayWeatherResponse(data);
          } else {
            displayWeatherError(
              data.message || "Failed to get weather information"
            );
          }
        } else if (data.type === "weather_error") {
          displayWeatherError(data.message || "Weather service error");
        } else if (data.type === "weather_location_needed") {
          displayWeatherError(
            data.message || "Please specify a location for weather information"
          );
        } else if (data.type === "quote_request_start") {
          updateStreamingStatus(`💪 ${data.message}`, "info");
        } else if (data.type === "quote_response") {
          console.log("Received quote response:", data); // Debug log
          if (data.success) {
            displayQuoteResponse(data);
            resetMotivationButton(); // Reset button after successful response
          } else {
            updateStreamingStatus(
              "❌ Failed to get motivational quote",
              "error"
            );
            resetMotivationButton();
          }
        } else if (data.type === "quote_request_start") {
          updateStreamingStatus(`💪 ${data.message}`, "info");
        } else if (data.type === "quote_response") {
          if (data.success) {
            displayQuoteResponse(data);
          } else {
            updateStreamingStatus(
              "❌ Failed to get motivational quote",
              "error"
            );
          }
        }
      };

      audioStreamSocket.onerror = function (error) {
        console.error("WebSocket error:", error);
        updateConnectionStatus("error", "Connection Error");
        updateStreamingStatus("WebSocket connection error", "error");
      };

      audioStreamSocket.onclose = function (event) {
        updateConnectionStatus("disconnected", "Disconnected");
        updateStreamingStatus("Connection closed", "warning");
      };
    } catch (error) {
      console.error("Error starting audio streaming:", error);
      updateConnectionStatus("error", "Error");
      updateStreamingStatus(
        "Error starting streaming: " + error.message,
        "error"
      );
    }
  }

  async function startRecordingForStreaming() {
    try {
      audioStreamStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000, // 16kHz for AssemblyAI
          channelCount: 1, // Mono
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)({
        sampleRate: 16000,
      });

      const source = audioContext.createMediaStreamSource(audioStreamStream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = function (e) {
        if (
          audioStreamSocket &&
          audioStreamSocket.readyState === WebSocket.OPEN
        ) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = Math.max(
              -32768,
              Math.min(32767, inputData[i] * 32767)
            );
          }
          audioStreamSocket.send(pcmData.buffer);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Store references for cleanup
      audioStreamRecorder = {
        stop: () => {
          processor.disconnect();
          source.disconnect();
          audioContext.close();
        },
      };

      isStreaming = true;
      if (audioStreamBtn) {
        audioStreamBtn.innerHTML =
          '<span class="btn-icon">⏹️</span><span class="btn-text">Stop Live Conversation</span>';
        audioStreamBtn.className = "btn danger";
        audioStreamBtn.setAttribute("data-state", "recording");
      }

      updateConnectionStatus("recording", "Recording & Streaming");
      updateStreamingStatus("Recording and streaming audio...", "recording");
      if (
        audioStreamSocket &&
        audioStreamSocket.readyState === WebSocket.OPEN
      ) {
        audioStreamSocket.send("start_streaming");
      }
    } catch (error) {
      console.error("Error starting recording for streaming:", error);
      updateConnectionStatus("error", "Recording Error");
      updateStreamingStatus(
        "Error starting recording: " + error.message,
        "error"
      );
    }
  }

  async function stopAudioStreaming() {
    try {
      isStreaming = false;

      // Stop the audio recording (either MediaRecorder or custom processor)
      if (audioStreamRecorder) {
        if (typeof audioStreamRecorder.stop === "function") {
          audioStreamRecorder.stop();
        }
        audioStreamRecorder = null;
      }

      // Stop media stream
      if (audioStreamStream) {
        audioStreamStream.getTracks().forEach((track) => track.stop());
        audioStreamStream = null;
      }
      if (
        audioStreamSocket &&
        audioStreamSocket.readyState === WebSocket.OPEN
      ) {
        audioStreamSocket.send("stop_streaming");
      }

      // Close WebSocket after a short delay to allow final messages
      setTimeout(() => {
        if (audioStreamSocket) {
          audioStreamSocket.close();
        }
      }, 1000);

      // Update UI
      if (audioStreamBtn) {
        audioStreamBtn.innerHTML =
          '<span class="btn-icon">🎤</span><span class="btn-text">Start Live Conversation</span>';
        audioStreamBtn.className = "btn primary";
        audioStreamBtn.setAttribute("data-state", "ready");
      }

      updateConnectionStatus("disconnected", "Disconnected");
      updateStreamingStatus("Audio streaming stopped", "info");
    } catch (error) {
      console.error("Error stopping audio streaming:", error);
      updateStreamingStatus(
        "Error stopping streaming: " + error.message,
        "error"
      );
    }
  }

  function updateConnectionStatus(status, text) {
    if (connectionStatus) {
      connectionStatus.className = `status-badge ${status}`;
      connectionStatus.textContent = text;
    }
  }

  function updateStreamingStatus(message, type) {
    if (streamingStatusLog && audioStreamStatus) {
      audioStreamStatus.style.display = "block";

      const statusEntry = document.createElement("div");
      statusEntry.className = `streaming-status ${type}`;
      statusEntry.innerHTML = `
        <strong>${new Date().toLocaleTimeString()}</strong>: ${message}
      `;

      streamingStatusLog.appendChild(statusEntry);
      streamingStatusLog.scrollTop = streamingStatusLog.scrollHeight;
    }
  }

  function resetStreamingState() {
    // Hide previous streaming UI elements
    const elementsToHide = [
      "llmStreamingArea",
      "ttsStreamingArea",
      "streamingSummaryArea",
      "noSpeechArea",
    ];

    elementsToHide.forEach((elementId) => {
      const element = document.getElementById(elementId);
      if (element) {
        element.style.display = "none";
        if (elementId === "llmStreamingArea") {
          element.innerHTML = "";
        }
      }
    });

    // Clear status log
    if (streamingStatusLog) {
      streamingStatusLog.innerHTML = "";
    }

    // Hide status container
    if (audioStreamStatus) {
      audioStreamStatus.style.display = "none";
    }

    // Reset chat history state
    currentAssistantText = "";

    resetAudioPlayback();
  }

  function clearPreviousTranscriptions() {
    // Clear live transcription area
    const liveArea = document.getElementById("liveTranscriptionArea");
    if (liveArea) {
      liveArea.style.display = "none";
      const transcriptionText = document.getElementById("transcriptionText");
      if (transcriptionText) {
        transcriptionText.innerHTML = "";
      }
    }

    // Clear complete transcription area
    const completeArea = document.getElementById("completeTranscriptionArea");
    if (completeArea) {
      completeArea.style.display = "none";
    }

    // Clear no speech area
    const noSpeechArea = document.getElementById("noSpeechArea");
    if (noSpeechArea) {
      noSpeechArea.style.display = "none";
    }

    // Clear LLM streaming area
    const llmArea = document.getElementById("llmStreamingArea");
    if (llmArea) {
      llmArea.style.display = "none";
      llmArea.innerHTML = "";
    }
  }

  function showNoSpeechMessage() {
    // Speech detection happens in backend, UI display disabled
  }

  // Function to add user message to chat history immediately
  function addUserMessageToChatHistory(userMessage) {
    const chatHistoryList = document.getElementById("chatHistoryList");
    if (!chatHistoryList) return;

    // Remove "no history" message if it exists
    const noHistoryMsg = chatHistoryList.querySelector(".no-history");
    if (noHistoryMsg) {
      noHistoryMsg.remove();
    }

    // Create new conversation pair
    const conversationDiv = document.createElement("div");
    conversationDiv.className = "conversation-pair new-conversation";
    conversationDiv.id = `conversation-${Date.now()}`;

    const currentTime = new Date();

    // User message
    const userDiv = document.createElement("div");
    userDiv.className = "chat-message user";
    userDiv.innerHTML = `
      <div class="message-header">
        <span class="message-role">👤 You</span>
        <small class="message-time">${currentTime.toLocaleString()}</small>
      </div>
      <div class="message-content">${userMessage}</div>
    `;

    // Assistant message placeholder
    const assistantDiv = document.createElement("div");
    assistantDiv.className = "chat-message assistant";
    assistantDiv.id = "current-assistant-response";
    assistantDiv.innerHTML = `
      <div class="message-header">
        <span class="message-role">🤖 AI Assistant</span>
        <small class="message-time">${currentTime.toLocaleString()}</small>
      </div>
      <div class="message-content" id="assistant-content">
        <em>Generating response...</em>
      </div>
    `;

    conversationDiv.appendChild(userDiv);
    conversationDiv.appendChild(assistantDiv);
    chatHistoryList.appendChild(conversationDiv);

    // Add click event listener to open modal
    conversationDiv.addEventListener("click", function () {
      const currentUserMessage = userMessage;
      const assistantMessage =
        currentAssistantText || "Response in progress...";
      openConversationModal(currentUserMessage, assistantMessage);
    });

    // Scroll to new conversation
    conversationDiv.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // Show notification that new conversation started
    if (chatHistoryContainer && chatHistoryContainer.style.display === "none") {
      if (toggleChatHistoryBtn) {
        toggleChatHistoryBtn.textContent = "Show Chat History (New!)";
        toggleChatHistoryBtn.style.backgroundColor = "#667eea";
      }
    }
  }

  // Function to update assistant response in real-time
  function updateAssistantResponseInChatHistory(chunk) {
    const assistantContent = document.getElementById("assistant-content");
    if (!assistantContent) return;

    // Accumulate the response text
    currentAssistantText += chunk;

    // Parse and display the markdown
    try {
      if (typeof marked !== "undefined") {
        const markdownHtml = marked.parse(currentAssistantText);
        assistantContent.innerHTML = markdownHtml;

        // Apply syntax highlighting if available
        if (typeof hljs !== "undefined") {
          assistantContent.querySelectorAll("pre code").forEach((block) => {
            hljs.highlightElement(block);
          });
        }
      } else {
        assistantContent.innerHTML = currentAssistantText.replace(
          /\n/g,
          "<br>"
        );
      }
    } catch (error) {
      console.warn("Markdown parsing error:", error);
      assistantContent.innerHTML = currentAssistantText.replace(/\n/g, "<br>");
    }

    // Scroll to keep the conversation visible
    const assistantDiv = document.getElementById("current-assistant-response");
    if (assistantDiv) {
      assistantDiv.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  // Function to mark the response as saved
  function markResponseAsSaved() {
    const assistantDiv = document.getElementById("current-assistant-response");
    if (assistantDiv) {
      // Remove the ID since this conversation is now complete
      assistantDiv.removeAttribute("id");
      const assistantContent = assistantDiv.querySelector(".message-content");
      if (assistantContent) {
        assistantContent.removeAttribute("id");
      }

      // Add a "saved" indicator
      const messageHeader = assistantDiv.querySelector(".message-header");
      if (messageHeader) {
        const savedIndicator = document.createElement("span");
        savedIndicator.className = "saved-indicator";
        savedIndicator.innerHTML = "💾";
        savedIndicator.title = "Response saved to database";
        savedIndicator.style.marginLeft = "8px";
        savedIndicator.style.fontSize = "12px";
        messageHeader.appendChild(savedIndicator);
      }
    }

    // Reset the accumulated text for next conversation
    currentAssistantText = "";

    // Update button text back to normal
    if (
      toggleChatHistoryBtn &&
      toggleChatHistoryBtn.textContent.includes("New!")
    ) {
      toggleChatHistoryBtn.textContent = "Show Chat History";
      toggleChatHistoryBtn.style.backgroundColor = "";
    }
  }

  function handleAudioChunk(audioData) {
    // Play the audio chunk for streaming
    playAudioChunk(audioData.audio_base64);

    // Update UI with basic audio streaming progress
    updateStreamingStatus(
      `Audio chunk received (${audioData.chunk_size} bytes)`,
      "success"
    );

    if (audioData.is_final) {
      updateStreamingStatus("Audio streaming complete!", "success");
      setTimeout(() => {
        if (!isPlaying && audioChunks.length === 0) {
          updatePlaybackStatus("Audio streaming complete!");
          setTimeout(() => {
            hideAudioPlaybackIndicator();
          }, 2000);
        }
      }, 1000);
    }
  }

  function displayLLMStreamingStart(userMessage) {
    let llmArea = document.getElementById("llmStreamingArea");

    if (!llmArea) {
      llmArea = document.createElement("div");
      llmArea.id = "llmStreamingArea";
      llmArea.className = "llm-streaming-area";

      // Insert after the complete transcription area or streaming status
      const completeArea = document.getElementById("completeTranscriptionArea");
      const statusContainer = document.getElementById("audioStreamStatus");
      const insertAfter = completeArea || statusContainer;

      if (insertAfter) {
        insertAfter.parentNode.insertBefore(llmArea, insertAfter.nextSibling);
      }
    }

    // Update content with current user message
    llmArea.innerHTML = `
      <h4>🤖 AI Response Generation</h4>
      <div class="user-query">
        <strong>Your question:</strong> "${userMessage}"
      </div>
      <div class="llm-response">
        <strong>AI Response:</strong>
        <div id="llmResponseText" class="llm-response-text"></div>
      </div>
    `;

    llmArea.style.display = "block";

    // Clear previous response and show generating message
    const responseText = document.getElementById("llmResponseText");
    if (responseText) {
      responseText.innerHTML = "<em>Generating response...</em>";
      responseText.setAttribute("data-raw-text", "");
    }
  }

  // Function to display LLM text chunks
  function displayLLMTextChunk(chunk, accumulatedLength) {
    const responseText = document.getElementById("llmResponseText");
    if (responseText) {
      // Append the new chunk
      let currentText = responseText.getAttribute("data-raw-text") || "";
      if (currentText === "Generating response...") {
        currentText = "";
      }

      // Accumulate the raw text
      const newText = currentText + chunk;
      responseText.setAttribute("data-raw-text", newText);

      // Parse as Markdown and display
      try {
        if (typeof marked !== "undefined") {
          const markdownHtml = marked.parse(newText);
          responseText.innerHTML = markdownHtml;

          // Apply syntax highlighting if available
          if (typeof hljs !== "undefined") {
            responseText.querySelectorAll("pre code").forEach((block) => {
              hljs.highlightElement(block);
            });
          }
        } else {
          // Fallback to simple line break replacement
          responseText.innerHTML = newText.replace(/\n/g, "<br>");
        }
      } catch (error) {
        console.warn("Markdown parsing error:", error);
        responseText.innerHTML = newText.replace(/\n/g, "<br>");
      }

      // Scroll to bottom
      responseText.scrollTop = responseText.scrollHeight;
    }
  }

  function displayTTSStreamingStart() {
    // Basic TTS streaming UI
    let ttsArea = document.getElementById("ttsStreamingArea");

    if (!ttsArea) {
      ttsArea = document.createElement("div");
      ttsArea.id = "ttsStreamingArea";
      ttsArea.className = "tts-streaming-area";
      ttsArea.innerHTML = `<h4>🎵 Audio Generation</h4><div class="audio-status">Generating audio...</div>`;

      const llmArea = document.getElementById("llmStreamingArea");
      const statusContainer = document.getElementById("audioStreamStatus");
      const insertAfter = llmArea || statusContainer;

      if (insertAfter) {
        insertAfter.parentNode.insertBefore(ttsArea, insertAfter.nextSibling);
      }
    }

    ttsArea.style.display = "block";
  }

  // Removed displayAudioChunkReceived function - not needed for basic functionality

  function displayStreamingComplete(data) {
    let summaryArea = document.getElementById("streamingSummaryArea");

    if (!summaryArea) {
      summaryArea = document.createElement("div");
      summaryArea.id = "streamingSummaryArea";
      summaryArea.className = "streaming-summary-area";

      const ttsArea = document.getElementById("ttsStreamingArea");
      const statusContainer = document.getElementById("audioStreamStatus");
      const insertAfter = ttsArea || statusContainer;

      if (insertAfter) {
        insertAfter.parentNode.insertBefore(
          summaryArea,
          insertAfter.nextSibling
        );
      }
    }

    summaryArea.innerHTML = `
      <h4>✅ Conversation Complete</h4>
      <div class="streaming-summary">
        <div class="summary-item">
          <strong>Complete Response:</strong>
          <div class="final-response" id="finalResponseContent"></div>
        </div>
      </div>
    `;

    summaryArea.style.display = "block";

    // Render final response as Markdown
    const finalResponseElement = document.getElementById(
      "finalResponseContent"
    );
    if (finalResponseElement && data.complete_response) {
      try {
        if (typeof marked !== "undefined") {
          const markdownHtml = marked.parse(data.complete_response);
          finalResponseElement.innerHTML = markdownHtml;

          if (typeof hljs !== "undefined") {
            finalResponseElement
              .querySelectorAll("pre code")
              .forEach((block) => {
                hljs.highlightElement(block);
              });
          }
        } else {
          finalResponseElement.innerHTML = data.complete_response.replace(
            /\n/g,
            "<br>"
          );
        }
      } catch (error) {
        console.warn("Markdown parsing error in final response:", error);
        finalResponseElement.innerHTML = data.complete_response.replace(
          /\n/g,
          "<br>"
        );
      }
    }

    summaryArea.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // Removed displayAudioStreamingComplete function - not needed

  // ==================== AUDIO STREAMING PLAYBACK FUNCTIONS ====================
  // Based on Murf's WebSocket streaming reference implementation

  function initializeAudioContext() {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        playheadTime = audioContext.currentTime;
      }
      return true;
    } catch (error) {
      console.error("Failed to initialize audio context:", error);
      return false;
    }
  }

  function base64ToPCMFloat32(base64) {
    try {
      let binary = atob(base64);
      const offset = wavHeaderSet ? 44 : 0; // Skip WAV header if present

      if (wavHeaderSet) {
        wavHeaderSet = false; // Only process header once
      }

      const length = binary.length - offset;
      const buffer = new ArrayBuffer(length);
      const byteArray = new Uint8Array(buffer);

      for (let i = 0; i < byteArray.length; i++) {
        byteArray[i] = binary.charCodeAt(i + offset);
      }

      const view = new DataView(byteArray.buffer);
      const sampleCount = byteArray.length / 2; // 16-bit samples
      const float32Array = new Float32Array(sampleCount);

      for (let i = 0; i < sampleCount; i++) {
        const int16 = view.getInt16(i * 2, true); // Little endian
        float32Array[i] = int16 / 32768; // Convert to float32 range [-1, 1]
      }

      return float32Array;
    } catch (error) {
      console.error("Error converting base64 to PCM:", error);
      return null;
    }
  }

  function chunkPlay() {
    if (audioChunks.length > 0) {
      const chunk = audioChunks.shift();

      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      try {
        const buffer = audioContext.createBuffer(1, chunk.length, SAMPLE_RATE);
        buffer.copyToChannel(chunk, 0);

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);

        const now = audioContext.currentTime;
        if (playheadTime < now) {
          playheadTime = now + 0.05; // Add small delay to prevent audio gaps
        }

        source.start(playheadTime);
        playheadTime += buffer.duration;

        updatePlaybackStatus(`Playing audio chunk`);

        // Continue playing remaining chunks
        if (audioChunks.length > 0) {
          chunkPlay();
        } else {
          isPlaying = false;
          updatePlaybackStatus(
            "Audio streaming paused - waiting for more chunks..."
          );
        }
      } catch (error) {
        console.error("Error playing audio chunk:", error);
        isPlaying = false;
        hideAudioPlaybackIndicator();
      }
    }
  }

  function playAudioChunk(base64Audio) {
    try {
      // Initialize audio context if not already done
      if (!initializeAudioContext()) {
        return;
      }

      // Show audio playback indicator
      showAudioPlaybackIndicator();

      // Convert base64 to PCM data
      const float32Array = base64ToPCMFloat32(base64Audio);
      if (!float32Array || float32Array.length === 0) {
        return;
      }

      // Add chunk to playback queue
      audioChunks.push(float32Array);

      // Start playback if not already playing
      if (
        !isPlaying &&
        (playheadTime <= audioContext.currentTime + 0.1 ||
          audioChunks.length >= 2)
      ) {
        isPlaying = true;
        audioContext.resume().then(() => {
          chunkPlay();
        });
      }
    } catch (error) {
      console.error("Error in playAudioChunk:", error);
    }
  }

  function resetAudioPlayback() {
    audioChunks = [];
    isPlaying = false;
    wavHeaderSet = true;

    if (audioContext) {
      playheadTime = audioContext.currentTime;
    }

    hideAudioPlaybackIndicator();
  }

  /**
   * Show the audio playback indicator with animation
   */
  function showAudioPlaybackIndicator() {
    const playbackContainer = document.getElementById("audioPlaybackStatus");
    if (playbackContainer) {
      playbackContainer.style.display = "block";

      // Update status text
      const statusText = document.getElementById("playbackStatusText");
      if (statusText) {
        statusText.textContent = "Audio is streaming and playing...";
      }
    }
  }

  /**
   * Hide the audio playback indicator
   */
  function hideAudioPlaybackIndicator() {
    const playbackContainer = document.getElementById("audioPlaybackStatus");
    if (playbackContainer) {
      playbackContainer.style.display = "none";
    }
  }

  /**
   * Update playback status text
   */
  function updatePlaybackStatus(text) {
    const statusText = document.getElementById("playbackStatusText");
    if (statusText) {
      statusText.textContent = text;
    }
  }
});
