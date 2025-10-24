// Task Counter Constants
const SUBMIT_BTN_SELECTOR = '//*[text()="' + "Submit" + '"]';
const TASK_NAME_SELECTOR = "/html/body/rating-portal-root/rating-portal-app/div[2]/app-header/div/div[1]/span[1]";
const TASK_NAME_SELECTOR_TEST = "//*[@id=\"task\"]";

// Task Alert Constants
const TARGET_ELEMENT_SELECTOR = 'material-button[class*="start-button"]';
const SERVER_URL = 'https://ewokd.ciprianilab.tech';

let taskStartTime = new Date().getTime();
let signalSent = false;
let wasDisabled = true;
let userId;

// Initialize both functionalities
initializeTaskCounter();
initializeTaskAlert();

function initializeTaskCounter() {
    countTasksByClick();
    countTasksByCtrlEnter();
}

function initializeTaskAlert() {
    chrome.storage.local.get(['userId'], function(result) {
        userId = result.userId;
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

// Task Alert Functions
function sendSignalToDiscordBot() {
    console.log('Sending signal to Discord bot...');

    const message = 'Tasks are now available. Please check your task queue https://tenor.com/view/typing-fast-cat-gif-23588893';
    const payload = { user_id: userId, messages: [{ text: message, count: 1 }] };

    console.log(`Payload to server: ${JSON.stringify(payload)}`);

    fetch(SERVER_URL + '/send_signal', {
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
        console.log('Signal sent to the bot successfully:', data);
    })
    .catch((error) => {
        console.error('Error sending signal to the bot:', error);
    });
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
        userId = request.userId;
        observeElement();
    }
});
