import React, { useState, useEffect } from "react";
import { database, ref, onValue, push, remove, update } from "./firebaseConfig";
import "./ToDo.css"; // 🔥 Lisää tämä!

function ToDo() {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");

  useEffect(() => {
    const tasksRef = ref(database, "todo");
    onValue(tasksRef, (snapshot) => {
      const data = snapshot.val() || {};
      const taskList = Object.entries(data).map(([id, task]) => ({
        id,
        ...task
      }));
      setTasks(taskList);
    });
  }, []);

  const addTask = () => {
    if (newTask.trim() === "") return;
    const tasksRef = ref(database, "todo");
    push(tasksRef, {
      text: newTask,
      done: false,
      created: new Date().toISOString(),
    });
    setNewTask("");
  };

  const toggleDone = (task) => {
    const taskRef = ref(database, `todo/${task.id}`);
    update(taskRef, { done: !task.done });
  };

  const deleteTask = (task) => {
    const taskRef = ref(database, `todo/${task.id}`);
    remove(taskRef);
  };

  return (
    <div className="todo-container">
      <h1 className="todo-title">📝 Tehtävälista</h1>

      <div className="todo-input-group">
        <input
          type="text"
          placeholder="Kirjoita uusi tehtävä..."
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          className="todo-input"
        />
        <button onClick={addTask} className="todo-button">
          Lisää
        </button>
      </div>

      <ul className="todo-list">
        {tasks.map((task) => (
          <li key={task.id} className="todo-item">
            <div className="todo-task">
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => toggleDone(task)}
              />
              <span className={`todo-text ${task.done ? "done" : ""}`}>
                {task.text}
              </span>
            </div>
            <button onClick={() => deleteTask(task)} className="todo-delete">
              Poista
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ToDo;
