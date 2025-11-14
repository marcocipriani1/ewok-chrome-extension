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

import {renderTask} from "./utils.js";

let taskList = document.getElementById("task-stats");
let totalTasks = 0;

chrome.storage.local.get(["tasks"], (result) => {
    for (const taskName in result.tasks) {
        totalTasks += result.tasks[taskName].taskCount;
        let taskData = result.tasks[taskName];
        let task = renderTask(taskName, taskData);
        taskList.append(task);
    }
    document.getElementById("total-tasks").innerText = `Total tasks: ${totalTasks}`;
});
