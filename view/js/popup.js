import { calculateRph, renderTask, formatTime, calculateRatePerSecond } from "./utils.js";

const WS_SERVER_URL = 'ws://127.0.0.1:8080/ws';

let socket = null;
let isSocketConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;
let messageHandlers = new Map();
let messageId = 0;
let connectionPromise = null; // Track ongoing connection attempts

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initializeExtension);

function initializeExtension() {
    // Start connection immediately
    connectWebSocket();
    
    chrome.storage.local.get(["userId"], function(data) {
        if (data.userId) {
            showMainContainer();
            render();
            // Wait a bit for WebSocket to connect before checking status
            setTimeout(() => refreshStatus(), 1000);
            setTimeout(() => getTasksStats(), 1500);
        } else {
            showLoginContainer();
        }
    });
    addButtonFunctions();
}

function showLoginContainer() {
    document.getElementById("login-container").style.display = "block";
    document.getElementById("main-container").style.display = "none";
}

function showMainContainer() {
    document.getElementById("login-container").style.display = "none";
    document.getElementById("main-container").style.display = "block";
}

// Improved WebSocket Connection
function connectWebSocket() {
    // If already connecting or connected, return existing promise
    if (connectionPromise) {
        return connectionPromise;
    }

    if (socket && socket.readyState === WebSocket.OPEN) {
        console.log("WebSocket already connected");
        return Promise.resolve();
    }

    if (socket && socket.readyState === WebSocket.CONNECTING) {
        console.log("WebSocket already connecting, waiting...");
        return connectionPromise;
    }

    console.log("Connecting to WebSocket server...");
    
    connectionPromise = new Promise((resolve, reject) => {
        try {
            socket = new WebSocket(WS_SERVER_URL);
            
            const timeout = setTimeout(() => {
                if (socket.readyState !== WebSocket.OPEN) {
                    socket.close();
                    connectionPromise = null;
                    reject(new Error("WebSocket connection timeout"));
                }
            }, 10000); // 10 second timeout

            socket.onopen = () => {
                clearTimeout(timeout);
                console.log("✅ WebSocket connected successfully");
                isSocketConnected = true;
                reconnectAttempts = 0;
                connectionPromise = null;
                resolve();
            };

            socket.onmessage = (event) => {
                try {
                    const response = JSON.parse(event.data);
                    console.log("📨 WebSocket response:", response);
                    
                    if (response.messageId !== undefined && messageHandlers.has(response.messageId)) {
                        const handler = messageHandlers.get(response.messageId);
                        messageHandlers.delete(response.messageId);
                        handler(response);
                    }
                } catch (error) {
                    console.error("❌ Error parsing WebSocket message:", error);
                }
            };

            socket.onerror = (error) => {
                clearTimeout(timeout);
                console.error("❌ WebSocket error:", error);
                isSocketConnected = false;
                connectionPromise = null;
            };

            socket.onclose = () => {
                clearTimeout(timeout);
                console.log("🔌 WebSocket disconnected");
                isSocketConnected = false;
                connectionPromise = null;
                
                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    console.log(`🔄 Reconnecting... Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
                    setTimeout(() => connectWebSocket(), RECONNECT_DELAY);
                } else {
                    console.error("❌ Max reconnection attempts reached");
                }
            };
        } catch (error) {
            connectionPromise = null;
            reject(error);
        }
    });

    return connectionPromise;
}

// Improved sendWebSocketMessage with better connection handling
async function sendWebSocketMessage(action, payload) {
    console.log(`📤 Sending message: ${action}`, payload);
    
    return new Promise(async (resolve, reject) => {
        try {
            // Ensure WebSocket is connected
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                console.log("🔄 WebSocket not connected, connecting...");
                try {
                    await connectWebSocket();
                } catch (error) {
                    console.error("❌ Failed to connect:", error);
                    reject(new Error("Failed to establish WebSocket connection"));
                    return;
                }
            }

            // Double-check connection
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                reject(new Error("WebSocket is not open after connection attempt"));
                return;
            }

            const msgId = messageId++;
            const message = JSON.stringify({ action, payload, messageId: msgId });
            
            // Set up response handler with timeout
            const timeout = setTimeout(() => {
                if (messageHandlers.has(msgId)) {
                    messageHandlers.delete(msgId);
                    reject(new Error(`Response timeout for action: ${action}`));
                }
            }, 15000); // 15 second timeout for response
            
            messageHandlers.set(msgId, (response) => {
                clearTimeout(timeout);
                console.log(`📥 Received response for ${action}:`, response);
                
                if (response.status === 'success') {
                    resolve(response.data);
                } else {
                    reject(new Error(response.error || 'Unknown error'));
                }
            });
            
            // Send the message
            socket.send(message);
            console.log(`✉️ Message sent: ${action}`);
            
        } catch (error) {
            console.error(`❌ Error in sendWebSocketMessage:`, error);
            reject(error);
        }
    });
}

// Improved getBotStatus
async function getBotStatus(userId) {
    const payload = { user_id: userId };
    const statusElement = document.getElementById("bot-status");

    statusElement.textContent = "Checking...";
    statusElement.style.color = "yellow";

    try {
        console.log("🔍 Checking bot status...");
        const data = await sendWebSocketMessage("status", payload);
        console.log("✅ Status response:", data);
        
        let status;
        if (data?.status === "Online") {
            status = "Online";
            statusElement.style.color = "green";
        } else {
            status = "Unknown";
            statusElement.style.color = "orange";
        }
        
        statusElement.textContent = status;

    } catch (error) {
        console.error("❌ Failed to fetch bot status:", error);
        statusElement.textContent = "Offline";
        statusElement.style.color = "red";
    }
}

function render() {
    chrome.storage.local.get(null, (data) => {
        let currentWorkedSeconds = data.workedSeconds || 0;

        document.getElementById("total_time").innerText = data.totalTime || 0;
        document.getElementById("total_payout").innerText = data.totalPayout || 0;

        if (data.isCounting) {
            let currentTime = new Date().getTime();
            currentWorkedSeconds += (currentTime - data.startTime) / 1000;
        }

        renderCountingStatus(data.isCounting);
        renderWorkedTime();
        renderTaskCount(data.taskCount || 0);
        renderRph(data.tasks || {});
        renderCurrentTask(data.currentTaskName, data.tasks ? data.tasks[data.currentTaskName] : null);
    });
}

function renderCountingStatus(isCounting) {
    let countingStatusDom = document.getElementById("counting-status");
    countingStatusDom.innerHTML = isCounting ?
    "<span style='color:#006400;font-weight:bold'>Counting</span>" :
    "<span style='color:#FF0000;font-weight:bold'>Not counting</span>";
}

function renderWorkedTime() {
    chrome.storage.local.get(["tasks"], (result) => {
        let totalTime = 0;

        if (result.tasks) {
            for (const taskName in result.tasks) {
                let taskData = result.tasks[taskName];
                totalTime += taskData.time;
            }
        }

        let totalWorkedTime = formatTime(totalTime, false);
        document.getElementById("worked-time").innerHTML = totalWorkedTime;
    });
}

function renderTaskCount(taskCount) {
    document.getElementById("task-count").innerHTML = taskCount;
}

function renderRph(tasks) {
    let totalTime = 0;
    let totalTasks = 0;

    for (const taskName in tasks) {
        let taskData = tasks[taskName];
        totalTime += taskData.time;
        totalTasks += taskData.taskCount;
    }

    let averageTime = totalTasks > 0 ? totalTime / totalTasks : 0;
    let formattedAverageTime = formatTime(averageTime);

    document.getElementById("rph").innerHTML = `${formattedAverageTime}`;
}

function renderCurrentTask(currentTaskName, currentTask) {
    let dCurrentTask = document.getElementById("current-task");
    let dRenderedCurrentTask;
    if (currentTaskName === null || currentTask === null) {
        let dNoTaskSolved = document.createElement("p");
        dNoTaskSolved.setAttribute("class", "font-bold mb-10");
        dNoTaskSolved.innerHTML = "No Task Solved";
        dRenderedCurrentTask = document.createElement("div");
        dRenderedCurrentTask.append(dNoTaskSolved);
        dRenderedCurrentTask.append(document.createElement("hr"));
    } else {
        dRenderedCurrentTask = renderTask(currentTaskName, currentTask);
    }
    dRenderedCurrentTask.setAttribute("id", "current-task");
    dCurrentTask.replaceWith(dRenderedCurrentTask);
}

function addButtonFunctions() {
    document.getElementById("login-form").addEventListener("submit", handleLogin);
    document.getElementById("start-btn").addEventListener("click", handleStart);
    document.getElementById("stop-btn").addEventListener("click", handleStop);
    document.getElementById("login-btn").addEventListener("click", login);
    document.getElementById("send-report-btn").addEventListener("click", sendTasksReport);
}

async function handleLogin(event) {
    event.preventDefault();
    let userIdInput = document.getElementById("user-id-input");
    let userId = userIdInput.value.trim();
    let loginMessage = document.getElementById("login-message");

    if (!userId) {
        loginMessage.innerHTML = '<p class="error-message">Please fill in all fields.</p>';
        return;
    }

    if (!/^\d+$/.test(userId)) {
        loginMessage.innerHTML = '<p class="error-message">User ID should only contain digits.</p>';
        return;
    }

    loginMessage.innerHTML = '<div class="loading"></div>';

    try {
        const data = await sendWebSocketMessage('login', { user_id: userId });
        
        loginMessage.innerHTML = '<p class="success-message">Login successful!</p>';
        chrome.storage.local.set({ userId: userId }, function() {
            console.log('User ID saved successfully: ' + userId);
            setTimeout(() => {
                showMainContainer();
                render();
                refreshStatus();
                getTasksStats();
            }, 1000);
        });
    } catch (error) {
        if (error.message.includes('not allowed') || error.message.includes('not authorized')) {
            loginMessage.innerHTML = '<p class="error-message">User not authorized</p>';
        } else {
            loginMessage.innerHTML = `<p class="error-message">Error logging in: ${error.message}</p>`;
        }
    }
}

async function login(event) {
    event.preventDefault();
    let userIdInput = document.getElementById("user-id-input");
    let userId = userIdInput.value.trim();
    let loginMessage = document.getElementById("login-message");

    if (!userId) {
        loginMessage.innerHTML = '<p class="error-message">Please fill in all fields.</p>';
        return;
    }

    if (!/^\d+$/.test(userId)) {
        loginMessage.innerHTML = '<p class="error-message">User ID should only contain digits.</p>';
        return;
    }

    loginMessage.innerHTML = '<div class="loading"></div>';

    try {
        const data = await sendWebSocketMessage('login', { user_id: userId });
        
        loginMessage.innerHTML = '<p class="success-message">Login successful!</p>';
        chrome.storage.local.set({ userId: userId }, function() {
            console.log('User ID saved successfully: ' + userId);
            setTimeout(() => {
                showMainContainer();
                render();
                refreshStatus();
                getTasksStats();
            }, 1000);
        });
    } catch (error) {
        if (error.message.includes('not allowed') || error.message.includes('not authorized')) {
            loginMessage.innerHTML = '<p class="error-message">User not authorized</p>';
        } else {
            loginMessage.innerHTML = `<p class="error-message">Error logging in: ${error.message}</p>`;
        }
    }
}

function handleStart() {
    console.log("start clicked");
    chrome.storage.local.get(["isCounting"], function (data) {
        if (!data.isCounting) {
            let startTime = new Date().getTime();
            chrome.storage.local.set({
                "startTime": startTime,
                "isCounting": true,
                "lastSubmit": startTime
            });
            console.log("Timer started");
            render();
        }
    });
}

function handleStop() {
    chrome.storage.local.get(["stopTime", "startTime", "workedSeconds", "isCounting"], function (data) {
        if (data.isCounting) {
            let stopTime = new Date().getTime();
            chrome.storage.local.set({
                "workedSeconds": (data.workedSeconds || 0) + (stopTime - data.startTime) / 1000,
                "stopTime": stopTime,
                "isCounting": false
            });
            render();
        }
        console.log("Timer stopped");
    });
}

function refreshStatus() {
    chrome.storage.local.get(["userId"], async (data) => {
        if (data.userId) {
            let statusElement = document.getElementById("bot-status");
            statusElement.textContent = 'Checking...';
            statusElement.style.color = 'yellow';
            
            // Ensure WebSocket is ready before checking status
            try {
                if (!socket || socket.readyState !== WebSocket.OPEN) {
                    await connectWebSocket();
                }
                await getBotStatus(data.userId);
            } catch (error) {
                console.error("Error in refreshStatus:", error);
                statusElement.textContent = 'Connection Error';
                statusElement.style.color = 'red';
            }
        }
    });
}

async function sendTasksReport() {
    try {
        const result = await new Promise((resolve) => {
            chrome.storage.local.get(["tasks", "userId"], resolve);
        });

        if (!result.tasks || Object.keys(result.tasks).length === 0) {
            console.log("No tasks have been recorded yet. Cannot send report.");
            return;
        }

        const data = await sendWebSocketMessage('process_tasks', {
            user_id: result.userId,
            tasks: result.tasks
        });

        console.log('Tasks report sent successfully:', data);
    } catch (error) {
        console.error('Error sending tasks report:', error);
    }
}

async function getTasksStats() {
    try {
        const result = await new Promise((resolve) => {
            chrome.storage.local.get(["tasks", "userId"], resolve);
        });

        console.log('Retrieved tasks:', result.tasks);
        console.log('User ID:', result.userId);

        if (!result.tasks || Object.keys(result.tasks).length === 0) {
            console.log("No tasks have been recorded yet. Skipping stats retrieval.");
            return;
        }

        const data = await sendWebSocketMessage('get_task_stats', {
            user_id: result.userId,
            tasks: result.tasks
        });

        console.log('Task stats retrieved successfully:', data);
        updateServerDataFields(data.total_time, data.total_payout);
    } catch (error) {
        console.error('Error getting task stats:', error);
    }
}

function updateServerDataFields(totalTime, totalPayout) {
    document.getElementById("total_time").innerText = totalTime || 0;
    document.getElementById("total_payout").innerText = totalPayout || 0;
    chrome.storage.local.set({ totalTime: totalTime, totalPayout: totalPayout });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.close();
    }
});