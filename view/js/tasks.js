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
