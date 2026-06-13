const express = require('express');
const { load, save, nextId } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

const VALID_STATUS = ['todo', 'in-progress', 'done'];
const VALID_PRIORITY = ['low', 'medium', 'high'];

// Get all tasks for current user (with optional filters)
router.get('/', auth, (req, res) => {
  const data = load();
  let tasks = data.tasks.filter(t => t.owner_id === req.user.id);

  const { status, priority, search } = req.query;
  if (status && VALID_STATUS.includes(status)) {
    tasks = tasks.filter(t => t.status === status);
  }
  if (priority && VALID_PRIORITY.includes(priority)) {
    tasks = tasks.filter(t => t.priority === priority);
  }
  if (search) {
    const q = search.toLowerCase();
    tasks = tasks.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    );
  }

  tasks = tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(tasks);
});

// Get task stats for current user
router.get('/stats', auth, (req, res) => {
  const data = load();
  const tasks = data.tasks.filter(t => t.owner_id === req.user.id);
  const now = new Date();

  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in-progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    overdue: tasks.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'done').length,
    high_priority: tasks.filter(t => t.priority === 'high' && t.status !== 'done').length,
  };

  res.json(stats);
});

// Get single task
router.get('/:id', auth, (req, res) => {
  const data = load();
  const id = parseInt(req.params.id);
  const task = data.tasks.find(t => t.id === id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.owner_id !== req.user.id) return res.status(403).json({ error: 'Not authorized to view this task' });
  res.json(task);
});

// Create task
router.post('/', auth, (req, res) => {
  const { title, description, status, priority, due_date } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const finalStatus = VALID_STATUS.includes(status) ? status : 'todo';
  const finalPriority = VALID_PRIORITY.includes(priority) ? priority : 'medium';

  const data = load();
  const id = nextId(data, 'tasks');
  const now = new Date().toISOString();
  const task = {
    id,
    title,
    description: description || '',
    status: finalStatus,
    priority: finalPriority,
    due_date: due_date || null,
    owner_id: req.user.id,
    created_at: now,
    updated_at: now,
  };
  data.tasks.push(task);
  save(data);

  req.app.get('io').to(`user:${req.user.id}`).emit('task:created', task);
  res.status(201).json(task);
});

// Update task
router.put('/:id', auth, (req, res) => {
  const { title, description, status, priority, due_date } = req.body;
  const data = load();
  const id = parseInt(req.params.id);
  const task = data.tasks.find(t => t.id === id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.owner_id !== req.user.id) return res.status(403).json({ error: 'Not authorized to edit this task' });

  if (title !== undefined) task.title = title;
  if (description !== undefined) task.description = description;
  if (status !== undefined && VALID_STATUS.includes(status)) task.status = status;
  if (priority !== undefined && VALID_PRIORITY.includes(priority)) task.priority = priority;
  if (due_date !== undefined) task.due_date = due_date;
  task.updated_at = new Date().toISOString();

  save(data);

  req.app.get('io').to(`user:${req.user.id}`).emit('task:updated', task);
  res.json(task);
});

// Delete task
router.delete('/:id', auth, (req, res) => {
  const data = load();
  const id = parseInt(req.params.id);
  const task = data.tasks.find(t => t.id === id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.owner_id !== req.user.id) return res.status(403).json({ error: 'Not authorized to delete this task' });

  data.tasks = data.tasks.filter(t => t.id !== id);
  save(data);

  req.app.get('io').to(`user:${req.user.id}`).emit('task:deleted', { id });
  res.json({ message: 'Task deleted successfully' });
});

module.exports = router;
