console.log("🎤 Voice Agent Day 1 - System Ready!");

async function submitText() {
    const text = document.getElementById('ttsInput').value.trim();
    const audioPlayer = document.getElementById('audioPlayer');
    const button = document.querySelector('.action-btn');
    
    if (!text) {
        alert('Please enter text!');
        return;
    }
    
    // Show loading
    button.disabled = true;
    button.textContent = 'Loading...';
    
    try {
        const response = await fetch('/generate-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });
        
        const data = await response.json();
        
        if (data.success && data.audio_url) {
            audioPlayer.src = data.audio_url;
            audioPlayer.style.display = 'block';
            audioPlayer.load();
        }
    } catch (error) {
        alert('Error: ' + error.message);
    } finally {
        // Reset button
        button.disabled = false;
        button.textContent = 'Generate Audio';
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log("🏁 Day 1 Voice Agent Project Initialized");
    console.log("✅ HTML structure loaded");
    console.log("✅ CSS styling applied");
    console.log("✅ JavaScript functionality active");
    console.log("🎯 Ready for voice development journey!");
});
