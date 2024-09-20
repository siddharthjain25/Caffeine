const focusTimeInput = document.getElementById("focusTime");
const focusTimeValue = document.getElementById("focusTimeValue");
const blockedLinksInput = document.getElementById("blockedLinks");
const startButton = document.getElementById("start");
const stopButton = document.getElementById("stop");
const timerDisplay = document.getElementById("timerDisplay");
const fullRestrictionCheckbox = document.getElementById("fullRestriction");

let focusActive = false;
let fullRestrictionMode = false;

// Load audio files
const startSound = new Audio(chrome.runtime.getURL("sounds/start.mp3"));
const endSound = new Audio(chrome.runtime.getURL("sounds/end.mp3"));

// Function to update timer display
function updateTimerDisplay(timeLeft) {
  let minutes = Math.floor(timeLeft / 60);
  let seconds = timeLeft % 60;
  timerDisplay.textContent = `${minutes}:${
    seconds < 10 ? "0" + seconds : seconds
  }`;
}

// Function to check and update the status when popup opens
function updateStatus() {
  chrome.runtime.sendMessage({ command: "getStatus" }, (response) => {
    if (response) {
      focusActive = response.focusActive;
      updateTimerDisplay(response.remainingTime);
      startButton.disabled = focusActive;
      stopButton.disabled = !focusActive && !fullRestrictionMode;
    }
  });
}

// Update focus time value when slider is adjusted
focusTimeInput.addEventListener("input", () => {
  const selectedTime = focusTimeInput.value;
  focusTimeValue.textContent = `${selectedTime} minutes`;
});

// Function to start timer
function startTimer() {
  if (focusActive) return;

  // Validate focusTime from the slider
  const focusTime = parseInt(focusTimeInput.value) * 60;

  // Parse and validate blockedLinks
  const blockedLinks = blockedLinksInput.value
    .split(",")
    .map((link) => link.trim())
    .filter((link) => link !== "");

  fullRestrictionMode = fullRestrictionCheckbox.checked;

  // Save the focusTime, blockedLinks, and fullRestrictionMode in storage
  chrome.storage.sync.set({
    focusTime,
    blockedLinks,
    fullRestriction: fullRestrictionMode,
  });

  chrome.runtime.sendMessage({ command: "startFocus" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Message error:", chrome.runtime.lastError);
    } else {
      console.log(response.result);
      startSound.play(); // Play start sound
    }
  });

  // Disable start button and handle stop button state
  startButton.disabled = true;
  stopButton.disabled = fullRestrictionMode;
}

// Function to stop timer
function stopTimer() {
  if (fullRestrictionMode) {
    alert("Full Restriction Mode is enabled. The timer cannot be stopped.");
    return;
  }

  endSound.play(); // Play end sound when focus ends
  chrome.runtime.sendMessage({ command: "stopFocus" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Message error:", chrome.runtime.lastError);
    } else {
      console.log(response.result);
      // Reset the form state after stopping the timer
      startButton.disabled = false;
      stopButton.disabled = true;
    }
  });
}

// Function to handle adding links
function addLink() {
  const newLink = blockedLinksInput.value.trim();
  if (newLink) {
    chrome.storage.sync.get("blockedLinks", (items) => {
      let currentLinks = items.blockedLinks || [];
      if (!currentLinks.includes(newLink)) {
        currentLinks.push(newLink);
        chrome.storage.sync.set({ blockedLinks: currentLinks }, () => {
          console.log("Link added:", newLink);
          blockedLinksInput.value = ""; // Clear the input field
        });
      } else {
        console.log("Link already in list:", newLink);
      }
    });
  }
}

// Load saved settings and timer state
chrome.storage.sync.get(
  ["focusTime", "blockedLinks", "fullRestriction", "timerState"],
  (items) => {
    if (items.focusTime) {
      focusTimeInput.value = items.focusTime / 60; // Convert from seconds to minutes
      focusTimeValue.textContent = `${focusTimeInput.value} minutes`;
    }
    if (items.blockedLinks)
      blockedLinksInput.value = items.blockedLinks.join(", ");
    if (items.fullRestriction !== undefined)
      fullRestrictionCheckbox.checked = items.fullRestriction;

    if (items.timerState) {
      updateTimerDisplay(items.timerState.timeLeft);
      focusActive = items.timerState.focusActive;
      fullRestrictionMode = items.timerState.fullRestrictionMode;
      startButton.disabled = focusActive;
      stopButton.disabled = !focusActive && !fullRestrictionMode;
    }
  }
);

// Set up the popup UI
updateStatus(); // Check and update status when popup opens

// Event listeners for buttons
startButton.addEventListener("click", startTimer);
stopButton.addEventListener("click", stopTimer);

// Listen for updates from the background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.command === "updateTimer") {
    updateTimerDisplay(message.timeLeft);
  } else if (message.command === "focusEnd" || message.command === "playEndSound") {
    endSound.play(); // Play end sound when focus ends
  } 
});
