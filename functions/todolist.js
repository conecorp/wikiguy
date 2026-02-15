const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const {
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder
} = require('discord.js');

const TODO_FILE = path.join(__dirname, '../todos.json');

// Simple async mutex to avoid races during load-modify-save
let fileLock = Promise.resolve();

async function withLock(fn) {
    const result = fileLock.then(async () => {
        return await fn();
    });
    fileLock = result.catch(() => {}); // Ensure the chain continues even on error
    return result;
}

async function loadTodos() {
    try {
        const data = await fs.readFile(TODO_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        if (e.code === 'ENOENT') return {};
        console.error("Error loading todos:", e);
        return {};
    }
}

async function saveTodos(todos) {
    try {
        await fs.writeFile(TODO_FILE, JSON.stringify(todos, null, 4));
    } catch (e) {
        console.error("Error saving todos:", e);
    }
}

async function addTodoTask(categoryId, name, description) {
    return await withLock(async () => {
        const todos = await loadTodos();
        if (!todos[categoryId]) todos[categoryId] = [];

        const newTask = {
            id: crypto.randomUUID(),
            name,
            description: description || "",
            completed: false
        };

        todos[categoryId].push(newTask);
        await saveTodos(todos);
        return newTask;
    });
}

async function getTodoList(categoryId) {
    const todos = await loadTodos();
    return todos[categoryId] || [];
}

function buildTodoListContainer(categoryId, tasks, wikiConfig) {
    const activeTasks = tasks.filter(t => !t.completed);
    if (activeTasks.length === 0) return null;

    const container = new ContainerBuilder();
    const section = new SectionBuilder();

    let content = `## Todo List for ${wikiConfig.name}\n`;
    activeTasks.forEach((task, index) => {
        content += `${index + 1}. **${task.name}**${task.description ? ` - ${task.description}` : ""}\n`;
    });

    section.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));

    // SectionBuilder requires an accessory. Use a fallback transparent image.
    const fallbackImage = "https://upload.wikimedia.org/wikipedia/commons/8/89/HD_transparent_picture.png";
    section.setThumbnailAccessory(thumbnail => thumbnail.setURL(fallbackImage));

    container.addSectionComponents(section);
    return container;
}

async function updateTasks(categoryId, completedTaskIds) {
    return await withLock(async () => {
        const todos = await loadTodos();
        if (!todos[categoryId]) return [];

        todos[categoryId] = todos[categoryId].map(task => {
            if (completedTaskIds.includes(task.id)) {
                return { ...task, completed: true };
            }
            return task;
        });

        await saveTodos(todos);
        return todos[categoryId].filter(t => !t.completed);
    });
}

function buildTickModal(categoryId, tasks) {
    const activeTasks = tasks.filter(t => !t.completed);
    if (activeTasks.length === 0) return null;

    // Type 18: LABEL Container, Type 22: CHECKBOX_GROUP
    return {
        title: "Tick off completed tasks",
        custom_id: `todo_tick_modal_${categoryId}`,
        components: [
            {
                type: 18,
                components: [
                    {
                        type: 22,
                        custom_id: "completed_tasks",
                        options: activeTasks.slice(0, 10).map(task => ({
                            label: task.name.slice(0, 100),
                            value: task.id,
                            description: task.description ? task.description.slice(0, 100) : undefined
                        }))
                    }
                ]
            }
        ]
    };
}

module.exports = {
    addTodoTask,
    getTodoList,
    buildTodoListContainer,
    updateTasks,
    buildTickModal,
    loadTodos
};
