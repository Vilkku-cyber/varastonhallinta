import React, { useState, useEffect } from "react";
import { database, ref, onValue, push, remove, update } from "./firebaseConfig";
import "./ToDo.css";

function ToDo() {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    const tasksRef = ref(database, "todo");
    onValue(tasksRef, (snapshot) => {
      const data = snapshot.val() || {};
      const taskList = Object.entries(data).map(([id, task]) => ({ id, ...task }));
      setTasks(taskList);
    });
  }, []);

  const addTask = () => {
    if (!newTask.trim()) return;
    push(ref(database, "todo"), {
      text: newTask.trim(),
      done: false,
      created: new Date().toISOString(),
    });
    setNewTask("");
  };

  const toggleDone = (task) => update(ref(database, `todo/${task.id}`), { done: !task.done });
  const deleteTask = (task) => remove(ref(database, `todo/${task.id}`));

  const startEditing = (task) => {
    setEditingTaskId(task.id);
    setEditingText(task.text);
  };
  const cancelEditing = () => {
    setEditingTaskId(null);
    setEditingText("");
  };
  const saveEdit = (taskId) => {
    if (!editingText.trim()) return;
    update(ref(database, `todo/${taskId}`), { text: editingText.trim() });
    setEditingTaskId(null);
    setEditingText("");
  };

  return (
    <div className="todo-container">
      <h1 className="todo-title">📝 Tehtävälista</h1>

      <div className="todo-input-row">
        <input
          type="text"
          placeholder="Kirjoita uusi tehtävä..."
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          className="todo-input"
        />
        <button onClick={addTask} className="btn btn-primary">Lisää</button>
      </div>

      <ul className="todo-list">
        {[...tasks].sort((a, b) => a.done - b.done).map((task) => (
          <li key={task.id} className={`todo-item ${task.done ? "is-done" : ""}`}>
            {/* Vasen: checkbox + teksti (oma grid) */}
            <div className="todo-left">
              <input
                type="checkbox"
                className="todo-checkbox"
                checked={task.done}
                onChange={() => toggleDone(task)}
              />

              {editingTaskId === task.id ? (
                <div className="edit-inline">
                  <input
                    className="todo-edit-input"
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit(task.id)}
                    autoFocus
                  />
                  <button className="btn btn-ghost" onClick={() => saveEdit(task.id)}>✔</button>
                  <button className="btn btn-ghost" onClick={cancelEditing}>✖</button>
                </div>
              ) : (
                <span className={`todo-text ${task.done ? "line" : ""}`}>{task.text}</span>
              )}
            </div>

            {/* Oikea: muokkaa + poista -napit vierekkäin */}
            <div className="todo-actions">
              {editingTaskId !== task.id && (
                <button
                  className="btn btn-muted"
                  title="Muokkaa"
                  onClick={() => startEditing(task)}
                >
                  ✏️
                </button>
              )}
              <button className="btn btn-danger" onClick={() => deleteTask(task)}>
                Poista
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ToDo;
