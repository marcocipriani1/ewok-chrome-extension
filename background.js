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
