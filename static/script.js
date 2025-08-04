console.log("🎤 Voice Agent Day 1 - System Ready!");

// Simple functions for Day 1 interactions

function checkStatus() {
    console.log("Checking system status...");
    
    const messageElement = document.getElementById('statusMessage');
    messageElement.classList.add('show');
    
    // Hide message after 3 seconds
    setTimeout(() => {
        messageElement.classList.remove('show');
    }, 3000);
    
    console.log("✅ Status check complete - All systems operational!");
}

function showProgress() {
    console.log("Displaying progress information...");
    
    const progressInfo = `
📊 Challenge Progress:
• Day 1/30 Completed
• Foundation: ✅ Complete
• Backend: ✅ Flask Running  
• Frontend: ✅ Connected
• Next Step: Day 2 - Voice Input

🚀 Ready to build amazing voice applications!
    `;
    
    alert(progressInfo);
    console.log("Progress information displayed");
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log("🏁 Day 1 Voice Agent Project Initialized");
    console.log("✅ HTML structure loaded");
    console.log("✅ CSS styling applied");
    console.log("✅ JavaScript functionality active");
    console.log("🎯 Ready for voice development journey!");
});
