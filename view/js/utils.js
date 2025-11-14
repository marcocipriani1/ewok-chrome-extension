
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

export function renderTask(taskName, taskData) {
    let dRenderedTask = document.createElement("div");
    dRenderedTask.setAttribute("id", taskName);

    dRenderedTask.append(renderTaskName());
    dRenderedTask.append(renderTaskStat());
    dRenderedTask.append(document.createElement("hr"));

    return dRenderedTask;


    function renderTaskName() {
        let dTaskName = document.createElement("p");
        dTaskName.innerHTML = taskName;
        dTaskName.setAttribute("class", "font-bold");

        return dTaskName;
    }

    function calculateAverageTimePerTask(workedMilliseconds, counter) {
        if (counter === 0) {
            return 0;
        }
        return Math.round((workedMilliseconds / 1000) / counter); // Convert to seconds and round
    }

    function renderTaskStat() {
        let dTaskStat = document.createElement("div");
        let numberOfSolvedTasks = taskData.taskCount;
        let formattedTime = formatTime(taskData.time); // Assuming taskData.time is in milliseconds
        let averageTimePerTask = calculateAverageTimePerTask(taskData.time, numberOfSolvedTasks);

        dTaskStat.innerHTML = `
        <p>Tasks: ${numberOfSolvedTasks}</p>
        <p>Time: ${formattedTime}</p>
        <p>Avg Time per Task: ${formatTime(averageTimePerTask * 1000)}</p>
        `;

        return dTaskStat;
    }


}

export function calculateRph(workedMilliseconds, taskCount) {
    if (workedMilliseconds === 0 || taskCount === 0) return 0;
    const hours = workedMilliseconds / (1000 * 60 * 60);
    return Math.round(taskCount / hours);
}

export function calculateRatePerSecond(workedMilliseconds, taskCount) {
    if (workedMilliseconds === 0 || taskCount === 0) return 0;
    const seconds = workedMilliseconds / 1000;
    return (taskCount / seconds).toFixed(2);
}

export function logAllData() {
    chrome.storage.local.get(null, (data) => {
        console.log(data);
    });
}

export function formatTime(milliseconds) {
    let seconds = Math.floor(milliseconds / 1000);
    let hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    let minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;

    // Pad the minutes and seconds with leading zeros, if required
    hours = hours.toString().padStart(2, '0');
    minutes = minutes.toString().padStart(2, '0');
    seconds = seconds.toString().padStart(2, '0');

    // Format the time as "hh:mm:ss"
    return `${hours}:${minutes}:${seconds}`;
}




