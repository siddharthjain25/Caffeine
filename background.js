let blockedWebsites = [];
let focusTime = 5 * 60; // Default 25 minutes in seconds
let focusActive = false; // Tracks whether focus mode is active
let fullRestrictionMode = false; // Tracks whether full restriction mode is enabled
let remainingTime = focusTime; // Remaining time in seconds

async function playSound(source = "sounds/start.mp3", volume = 1) {
  await createOffscreen();
  await chrome.runtime.sendMessage({ play: { source, volume } });
}

async function createOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Playing sound for focus session.",
  });
}

// Function to start focus mode
function startFocusSession() {
  chrome.storage.sync.get(
    ["focusTime", "blockedLinks", "fullRestriction"],
    (items) => {
      focusTime = items.focusTime || focusTime;
      blockedWebsites = items.blockedLinks || blockedWebsites;
      fullRestrictionMode = items.fullRestriction || false;

      focusActive = true;
      remainingTime = focusTime; // Reset remaining time
      updateTimer();

      // Save session state
      chrome.storage.sync.set({
        focusActive,
        remainingTime,
        fullRestrictionMode,
      });

      chrome.alarms.create("focusEnd", { delayInMinutes: focusTime / 60 });

      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "Caffeine",
        message: "Caffeine session started. Stay productive!",
      });

      playSound("sounds/start.mp3", 1); // Play start sound
      console.log("Caffeine session started.");

      // Disable stop button in popup if full restriction mode is enabled
      if (fullRestrictionMode) {
        chrome.storage.sync.set({ stopButtonDisabled: true });
      }
    }
  );
}

// Function to stop focus mode
function stopFocusSession() {
  if (fullRestrictionMode) {
    playSound("sounds/end.mp3", 1); // Play end sound
    // Full restriction mode is enabled; notify user
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Caffeine",
      message: "Caffeine session cannot be stopped in Full Restriction Mode.",
    });
    return; // Do nothing if full restriction mode is enabled
  }

  focusActive = false;
  remainingTime = 0;
  chrome.alarms.clear("focusEnd", (wasCleared) => {
    if (wasCleared) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "Caffeine",
        message: "Caffeine session has been ended.",
      });
      console.log("Caffeine session stopped.");
    } else {
      console.error("Failed to clear caffeine timer alarm.");
    }
  });

  // Save session state
  chrome.storage.sync.set({ focusActive, remainingTime });
}

// Update remaining time every second
function updateTimer() {
  if (focusActive && remainingTime > 0) {
    remainingTime--;
    chrome.storage.sync.set({ remainingTime });

    // Notify popup to update timer display
    chrome.runtime.sendMessage({
      command: "updateTimer",
      timeLeft: remainingTime,
    });

    // Schedule the next update in 1 second
    setTimeout(updateTimer, 1000);
  } else if (remainingTime <= 0) {
    playSound("sounds/end.mp3", 1); // Play end sound
  }
}

// Handle tab closures for blocked websites
function handleTab(tabId, url) {
  if (focusActive && isBlockedWebsite(url)) {
    console.log("Closing tab:", url);
    chrome.tabs.remove(tabId, () => {
      if (chrome.runtime.lastError) {
        console.error("Error closing tab:", chrome.runtime.lastError);
      }
    });
  }
}

// Check if the URL is blocked
function isBlockedWebsite(url) {
  return blockedWebsites.some((blockedUrlPattern) => {
    try {
      const pattern = new RegExp(blockedUrlPattern.replace(/\*/g, ".*"));
      return pattern.test(url);
    } catch (e) {
      console.error("Error in blocked website pattern:", blockedUrlPattern, e);
      return false;
    }
  });
}

// Monitor tab updates and creations
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    handleTab(tabId, changeInfo.url);
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  handleTab(tab.id, tab.url);
});

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "focusEnd") {
    remainingTime = 0;

    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png", // Ensure this path is correct
      title: "Caffeine",
      message: "Caffeine session ended!",
    });
    playSound("sounds/end.mp3", 1); // Play end sound
    // Reactivate the stop button in popup if full restriction mode was enabled
    chrome.storage.sync.set({ focusActive: false, remainingTime: 0 });
  }
});

// Listener for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === "startFocus") {
    startFocusSession();
    sendResponse({ result: "Caffeine session started" });
  } else if (request.command === "stopFocus") {
    stopFocusSession();
    sendResponse({ result: "Caffeine session stopped" });
  } else if (request.command === "getStatus") {
    // Respond with current timer status
    chrome.storage.sync.get(["focusActive", "remainingTime"], (items) => {
      sendResponse({
        focusActive: items.focusActive,
        remainingTime: items.remainingTime,
      });
    });
    return true; // Indicate async response
  }
});
