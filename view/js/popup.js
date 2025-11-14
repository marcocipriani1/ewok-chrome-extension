import { calculateRph, renderTask, formatTime, calculateRatePerSecond } from "./utils.js";
const SERVER_URL = 'https://ewokd.ciprianilab.tech';

document.addEventListener('DOMContentLoaded', initializeExtension);

function initializeExtension() {
    chrome.storage.local.get(["userId"], function(data) {
        if (data.userId) {
            showMainContainer();
            render();
            refreshStatus();
            getTasksStats();
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

function getBotStatus(userId) {
    const payload = { user_id: userId };

    fetch(SERVER_URL + '/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    .then((response) => response.json())
    .then((data) => {
        let status = data.error ? 'Offline' : (data.status === 'Online' ? 'Online' : 'Error');
        let statusElement = document.getElementById("bot-status");
        statusElement.textContent = status;

        if (status === 'Online') {
            statusElement.style.color = 'green';
        } else if (status === 'Offline') {
            statusElement.style.color = 'red';
        } else {
            statusElement.style.color = 'yellow';
        }
    })
    .catch((error) => {
        console.error('Failed to fetch bot status:', error);
        let statusElement = document.getElementById("bot-status");
        statusElement.textContent = 'Offline';
        statusElement.style.color = 'red';
    });
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

function handleLogin(event) {
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
    let payload = { user_id: userId };

    fetch(SERVER_URL + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    .then((response) => {
        if (!response.ok) {
            if(response.status === 403) {
                throw new Error('User not allowed');
            } else {
                throw new Error('Network response was not ok');
            }
        }
        return response.json();
    })
    .then((data) => {
        if (data.error) {
            loginMessage.innerHTML = `<p class="error-message">${data.error}</p>`;
        } else {
            loginMessage.innerHTML = '<p class="success-message">Login successful!</p>';
            chrome.storage.local.set({ userId: userId }, function() {
                console.log('User ID saved successfully: ' + userId);
                setTimeout(() => {
                    showMainContainer();
                    render();
                }, 1000);
            });
        }
    })
    .catch((error) => {
        loginMessage.innerHTML = `<p class="error-message">Error logging in: ${error.message}</p>`;
    });
}

function login(event) {
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
    let payload = { user_id: userId };

    fetch(SERVER_URL + '/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    .then((response) => {
        if (!response.ok) {
            if(response.status === 403) {
                throw new Error('User not allowed');
            } else {
                throw new Error('Network response was not ok');
            }
        }
        return response.json();
    })
    .then((data) => {
        if (data.error) {
            loginMessage.innerHTML = `<p class="error-message">${data.error}</p>`;
        } else {
            loginMessage.innerHTML = '<p class="success-message">Login successful!</p>';
            chrome.storage.local.set({ userId: userId }, function() {
                console.log('User ID saved successfully: ' + userId);
                setTimeout(() => {
                    showMainContainer();
                    render();
                }, 1000);
            });
        }
    })
    .catch((error) => {
        loginMessage.innerHTML = `<p class="error-message">Error logging in: ${error.message}</p>`;
    });
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
    chrome.storage.local.get(["userId"], (data) => {
        if (data.userId) {
            let statusElement = document.getElementById("bot-status");
            statusElement.textContent = 'Checking...';
            statusElement.style.color = 'yellow';
            getBotStatus(data.userId);
        }
    });
}

function sendTasksReport() {
    chrome.storage.local.get(["tasks", "userId"], (result) => {
        if (!result.tasks || Object.keys(result.tasks).length === 0) {
            console.log("No tasks have been recorded yet. Cannot send report.");
            return;
        }
        let payload = {
            user_id: result.userId,
            tasks: result.tasks
        };
        fetch(SERVER_URL + '/process_tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        .then((response) => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then((data) => {
            console.log('Tasks report sent automatically');
        })
        .catch((error) => {
            console.error('Error sending automatic tasks report:', error);
        });
    });
}

function getTasksStats() {
    chrome.storage.local.get(["tasks", "userId"], (result) => {
        console.log('Retrieved tasks:', result.tasks);
        console.log('User ID:', result.userId);

        if (!result.tasks || Object.keys(result.tasks).length === 0) {
            console.log("No tasks have been recorded yet. Skipping stats retrieval.");
            return;
        }

        let payload = {
            user_id: result.userId,
            tasks: result.tasks
        };

        console.log('Sending payload to server:', payload);

        fetch(SERVER_URL + '/get_task_stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
        .then((response) => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then((data) => {
            console.log('Task stats retrieved successfully:', data);
            updateServerDataFields(data.total_time, data.total_payout);
        })
        .catch((error) => {
            console.error('Error getting task stats:', error);
        });
    });
}

function updateServerDataFields(totalTime, totalPayout) {
    document.getElementById("total_time").innerText = totalTime || 0;
    document.getElementById("total_payout").innerText = totalPayout || 0;
    chrome.storage.local.set({ totalTime: totalTime, totalPayout: totalPayout });
}

