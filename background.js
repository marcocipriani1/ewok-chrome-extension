chrome.runtime.onInstalled.addListener(function () {
    chrome.storage.local.get(["taskCount"], function(result) {
        if (typeof result.taskCount === "undefined") {
            chrome.storage.local.set({
                "taskCount": 0,
                "startTime": 0,
                "stopTime": 0,
                "workedSeconds": 0,
                "isCounting": false,
                "currentTaskName": null,
                "tasks": {},
                "lastSubmit": null,
                "settings": {"warnIfForgotToStart": true}
            });
            console.log("Parameters initialized!");
        } else {
            console.log("Existing data found, skipping initialization.");
        }
    });
});
