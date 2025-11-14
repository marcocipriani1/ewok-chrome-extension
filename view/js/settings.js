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

import {logAllData, calculateRph, formatTime} from "./utils.js";

let exportCSVBtn = document.getElementById("export-csv-btn");

render();
saveSettingsHandler();
addButtonFunctions();

function render() {
    logAllData();
    const dWarnSubmitCheckbox = document.getElementById("submit-warn");
    chrome.storage.local.get(["settings"], (settings) => {
        console.log(settings.se);
        dWarnSubmitCheckbox.checked = settings.settings.warnIfForgotToStart;

    })
}

function saveSettingsHandler() {
    const dWarnSubmitCheckbox = document.getElementById("submit-warn");
    const dSaveBtn = document.getElementById("save-btn");
    const dSaveStatus = document.getElementById("save-status");

    dSaveBtn.addEventListener("click", () => {
        chrome.storage.local.get(["settings"], (settings) => {
            dSaveStatus.textContent = "Settings saved";
            setTimeout(() => {
                dSaveStatus.textContent = "";
            }, 1500);

            settings.settings.warnIfForgotToStart = dWarnSubmitCheckbox.checked;
            chrome.storage.local.set({"settings": settings.settings});

        })
    })
}

function addButtonFunctions() {
    handleReset();
    handleLogout();

    function handleReset() {
        let resetButton = document.getElementById("reset-btn");
        resetButton.addEventListener("click", () => {
            if (confirm("Are you sure you want to reset the task history?")) {
                chrome.storage.local.set({
                    "taskCount": 0,
                    "startTime": 0,
                    "stopTime": 0,
                    "workedSeconds": 0,
                    "isCounting": false,
                    "currentTaskName": null,
                    "tasks": {},
                    "lastSubmit": null,
                    "totalTime": 0,
                    "totalPayout": 0
                });
                render();
            }
        });
    }
}

function handleLogout() {
    let logoutButton = document.getElementById("logout-btn");
    logoutButton.addEventListener("click", () => {
        if (confirm("Are you sure you want to logout?")) {
            chrome.storage.local.remove(["userId"], function() {
                console.log("User data has been removed.");
                window.location.href = "popup.html";
            });
        }
    });
}

exportCSVBtn.addEventListener("click", exportTasksToCSV);

function exportTasksToCSV() {
    chrome.storage.local.get(["tasks"], (result) => {
        if (Object.keys(result.tasks).length === 0) {
            alert("No tasks have been recorded yet. Please complete some tasks before attempting to export.");
            return;
        }

        let tasksText = "Task Name,Task Count,Time,RPH,";
        let dateSet = new Set();
        let totalTaskCount = 0;
        let totalTime = 0;

        for (const taskName in result.tasks) {
            let taskData = result.tasks[taskName];
            for (const date in taskData.dates) {
                dateSet.add(date);
            }
            totalTaskCount += taskData.taskCount;
            totalTime += taskData.time; // Time in milliseconds
        }

        let dateList = Array.from(dateSet);
        dateList.sort();
        tasksText += dateList.join(',') + "\n";

        for (const taskName in result.tasks) {
            let taskData = result.tasks[taskName];
            let taskCount = taskData.taskCount;
            let taskTimeInMilliseconds = taskData.time;
            let taskTime = formatTime(taskTimeInMilliseconds);
            let rph = calculateRph(taskTimeInMilliseconds, taskCount);
            let tasksRow = `${taskName},${taskCount},${taskTime},${rph} s,`;

            let dateTasks = dateList.map(date => taskData.dates[date] || 0);
            tasksRow += dateTasks.join(',') + "\n";
            tasksText += tasksRow;
        }

        let totalTimeInMilliseconds = totalTime;
        let totalRPH = calculateRph(totalTimeInMilliseconds, totalTaskCount);
        let totalWorkedTime = formatTime(totalTimeInMilliseconds);
        tasksText += `Total,${totalTaskCount},${totalWorkedTime},${totalRPH} s\n`;

        let firstDate = dateList[0].split('-').join('');
        let lastDate = dateList[dateList.length - 1].split('-').join('');
        let filename = `tasks-${firstDate}-${lastDate}.csv`;

        downloadTextFile(tasksText, filename);
    });
}

function downloadTextFile(text, filename) {
    let mimeType = filename.endsWith('.csv') ? 'text/csv' : 'text/plain';
    let element = document.createElement("a");
    element.setAttribute("href", `data:${mimeType};charset=utf-8,` + encodeURIComponent(text));
    element.setAttribute("download", filename);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}
