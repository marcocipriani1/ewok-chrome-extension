/*
Ewok Chrome Extension: integrates with ewokd and the bot to track EWOQ tasks, forward alerts, and generate work-time reports.
Copyright (C) 2023-2025 Marco Cipriani <marcocipriani@tutanota.com>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
You should have received a copy of the GNU General Public License
along with this program. If not, see https://www.gnu.org/licenses/.
*/

// Task Counter Constants
const SUBMIT_BTN_SELECTOR = '//*[text()="' + "Submit" + '"]';
const TASK_NAME_SELECTOR = "/html/body/rating-portal-root/rating-portal-app/div[2]/app-header/div/div[1]/span[1]";
const TASK_NAME_SELECTOR_TEST = "//*[@id=\"task\"]";

// Task Alert Constants
const TARGET_ELEMENT_SELECTOR = 'material-button[class*="start-button"]';
const WS_SERVER_URL = "ws://127.0.0.1:8080/ws";

let taskStartTime = new Date().getTime();
let signalSent = false;
let wasDisabled = true;
let userId;
let socket = null;
let isSocketConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

// Initialize both functionalities
initializeTaskCounter();
initializeTaskAlert();

// WebSocket Connection Management
function connectWebSocket() {
    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
        console.log("WebSocket already connected or connecting");
        return;
    }

    console.log("Connecting to WebSocket server...");
    socket = new WebSocket(WS_SERVER_URL);

    socket.onopen = () => {
        console.log("WebSocket connected successfully");
        isSocketConnected = true;
        reconnectAttempts = 0;
    };

    socket.onmessage = (event) => {
        try {
            const response = JSON.parse(event.data);
            console.log("WebSocket response:", response);
            
            if (response.status === 'error') {
                console.error("Server error:", response.error);
            }
        } catch (error) {
            console.error("Error parsing WebSocket message:", error);
        }
    };

    socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        isSocketConnected = false;
    };

    socket.onclose = () => {
        console.log("WebSocket disconnected");
        isSocketConnected = false;
        
        // Attempt to reconnect
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`Reconnecting... Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
            setTimeout(connectWebSocket, RECONNECT_DELAY);
        } else {
            console.error("Max reconnection attempts reached");
        }
    };
}

// Send message through WebSocket with connection check
function sendWebSocketMessage(action, payload) {
    return new Promise((resolve, reject) => {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            console.log("WebSocket not connected, attempting to connect...");
            connectWebSocket();
            
            // Wait for connection and retry
            const checkConnection = setInterval(() => {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    clearInterval(checkConnection);
                    sendMessage();
                }
            }, 500);
            
            // Timeout after 5 seconds
            setTimeout(() => {
                clearInterval(checkConnection);
                reject(new Error("WebSocket connection timeout"));
            }, 5000);
        } else {
            sendMessage();
        }
        
        function sendMessage() {
            try {
                const message = JSON.stringify({ action, payload });
                socket.send(message);
                
                // Wait for response
                const responseHandler = (event) => {
                    try {
                        const response = JSON.parse(event.data);
                        socket.removeEventListener('message', responseHandler);
                        resolve(response);
                    } catch (error) {
                        reject(error);
                    }
                };
                
                socket.addEventListener('message', responseHandler);
                
                // Timeout after 10 seconds
                setTimeout(() => {
                    socket.removeEventListener('message', responseHandler);
                    reject(new Error("Response timeout"));
                }, 10000);
            } catch (error) {
                reject(error);
            }
        }
    });
}

function initializeTaskCounter() {
    countTasksByClick();
    countTasksByCtrlEnter();
}

function initializeTaskAlert() {
    chrome.storage.local.get(['userId'], function(result) {
        if (result.userId !== undefined && result.userId !== null) {
            // keep as string to preserve full snowflake precision
            userId = String(result.userId);
            connectWebSocket();
        } else {
            userId = undefined;
        }
        observeElement();
    });
}

// Task Counter Functions
function countTasksByClick() {
    let currentSubmitButton = null;
    let submitButton = null;
    let taskName = null;

    document.addEventListener("click", () => {
        taskName = getTaskName();
        currentSubmitButton = getSubmitButton();

        if (currentSubmitButton !== null && !currentSubmitButton.isSameNode(submitButton)) {
            submitButton = currentSubmitButton;
            currentSubmitButton.addEventListener("click", getTaskCounter(taskName));
        }
    });
}

function countTasksByCtrlEnter() {
    document.addEventListener("keydown", (e) => {
        let submitButton = getSubmitButton();

        if (submitButton !== null) {
            let isSubmitActive = (submitButton.getAttribute("aria-disabled") === "false");
            if (isTest()) {
                isSubmitActive = (submitButton.disabled === false);
            }

            if (isSubmitActive && e.ctrlKey && e.key === "Enter") {
                let taskName = getTaskName();
                getTaskCounter(taskName)();
            }
        }
    });
}

function getTaskCounter(taskName) {
    return async () => {
        let currentTime = new Date().getTime();
        let timeToComplete = (currentTime - taskStartTime) / 1000; // Convert to seconds
        taskStartTime = currentTime;

        await getDataFromStorage().then(data => {
            if (data.isCounting) {
                saveToStorage(data, taskName, timeToComplete);
            } else {
                alert("Message from ewok\n\n" +
                "You have submitted a task but ewok is not started!\n\n" +
                "You can disable this warning in the settings.")
            }
        });
    };
}

function saveToStorage(data, taskName, timeToComplete) {
    let tasks = data.tasks;
    let currentTime = new Date().getTime();
    let currentDate = new Date().toISOString().split('T')[0];

    if (!tasks.hasOwnProperty(taskName)) {
        tasks[taskName] = {
            time: 0,
            taskCount: 0,
            dates: {}
        };
    }

    tasks[taskName].time += timeToComplete * 1000; // Convert to milliseconds
    tasks[taskName].taskCount++;

    if (!tasks[taskName].dates.hasOwnProperty(currentDate)) {
        tasks[taskName].dates[currentDate] = 0;
    }

    tasks[taskName].dates[currentDate]++;

    chrome.storage.local.set({
        "taskCount": data.taskCount + 1,
        "currentTaskName": taskName,
        "tasks": tasks,
        "lastSubmit": currentTime,
        "workedSeconds": (data.workedSeconds || 0) + timeToComplete
    });
}

async function getDataFromStorage() {
    return new Promise(((resolve, reject) => {
        try {
            chrome.storage.local.get(["isCounting", "taskCount", "tasks", "lastSubmit"], (r) => {
                resolve(r);
            })
        } catch (ex) {
            reject(ex);
        }
    }));
}

function getSubmitButton() {
    let submitButton = document.evaluate(SUBMIT_BTN_SELECTOR, document, null,
                                         XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

    if (isTest()) {
        return submitButton;
    }

    if (submitButton === null) {
        return null;
    }

    return submitButton.parentElement;
}

function getTaskName() {
    if (isTest()) {
        return document.evaluate(TASK_NAME_SELECTOR_TEST, document, null,
                                 XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.innerHTML;
    }

    return document.evaluate(TASK_NAME_SELECTOR, document, null,
                             XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.innerHTML;
}

function isTest() {
    return document.location.href.includes("file:///");
}

// Task Alert Functions - Now using WebSocket
async function sendSignalToDiscordBot() {
    console.log('Sending signal to Discord bot via WebSocket...');

    const message = 'Tasks are now available. Please check your task queue https://tenor.com/view/typing-fast-cat-gif-23588893';
    const payload = {
        // keep user_id as string
        user_id: userId,
        messages: [{ text: message, count: 1 }]
    };

    console.log(`Payload to server: ${JSON.stringify(payload)}`);

    try {
        const response = await sendWebSocketMessage('send_signal', payload);
        
        if (response && response.status === 'success') {
            console.log('Signal sent to the bot successfully:', response.data);
        } else if (response) {
            console.error('Error from server:', response.error);
        } else {
            console.error('No response from server');
        }
    } catch (error) {
        console.error('Error sending signal to the bot:', error);
    }
}

async function checkAndSendSignal(element) {
    if (!element) {
        console.log("Target element not found, skipping signal check");
        return;
    }

    const isDisabled = element.disabled || element.hasAttribute('hidden') || !element.classList.contains('enabled');
    if (wasDisabled && !isDisabled) {
        wasDisabled = false;
        console.log("Element checked, initiating process to send signal");
        await sendSignalToDiscordBot();
        signalSent = true;
    } else if (!wasDisabled && isDisabled) {
        wasDisabled = true;
    }
}

function observeElement() {
    if (!userId) {
        console.log("User ID not found, retrying in 1 second");
        setTimeout(observeElement, 1000);
        return;
    }

    console.log("Initiating process to observe element");
    let targetElement = document.querySelector(TARGET_ELEMENT_SELECTOR);

    if (!targetElement) {
        console.log("Target element not found, retrying in 1 second");
        setTimeout(observeElement, 1000);
        return;
    }

    checkAndSendSignal(targetElement);

    console.log("Target element found, initiating observation process");

    const observer = new MutationObserver(async (mutations) => {
        if (signalSent) {
            observer.disconnect();
            console.log("Signal sent, stopping observation");
            return;
        }

        mutations.forEach(async (mutation) => {
            if (mutation.type === 'attributes' && (mutation.attributeName === 'style' || mutation.attributeName === 'disabled' || mutation.attributeName === 'hidden' || mutation.attributeName === 'class')) {
                await checkAndSendSignal(targetElement);
            }
        });
    });

    observer.observe(targetElement, { attributes: true });

    setInterval(() => {
        const newTargetElement = document.querySelector(TARGET_ELEMENT_SELECTOR);
        if (newTargetElement !== targetElement) {
            console.log("Target element changed, updating observer");
            observer.disconnect();
            targetElement = newTargetElement;
            if (targetElement) {
                wasDisabled = targetElement.disabled || targetElement.hasAttribute('hidden') || !targetElement.classList.contains('enabled');
                observer.observe(targetElement, { attributes: true });
                checkAndSendSignal(targetElement);
            } else {
                console.log("New target element not found, retrying observation");
                setTimeout(observeElement, 1000);
            }
        }
    }, 1000);
}

// Message listener for starting observation
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'start_observation') {
        // preserve as string
        userId = request.userId !== undefined && request.userId !== null ? String(request.userId) : undefined;
        connectWebSocket();
        observeElement();
    }
});

// Clean up WebSocket on page unload
window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.close();
    }
});
