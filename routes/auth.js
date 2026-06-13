const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { load, save, nextId } = require('../db');
const { SECRET, auth } = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', (req, res) => {
  const { name, username, email, password } = req.body;
  if (!name || !username || !email || !password) {
    return res.status(400).json({ error: 'Name, username, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const data = load();
    const existing = data.users.find(u => u.username === username || u.email === email);
    if (existing) {
      return res.status(409).json({ error: 'Username or email already in use' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const id = nextId(data, 'users');
    const newUser = { id, name, username, email, password: hash, created_at: new Date().toISOString() };
    data.users.push(newUser);
    save(data);

    const user = { id, name, username, email };
    const token = jwt.sign(user, SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user });
  } catch (e) {
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const data = load();
  const row = data.users.find(u => u.username === username || u.email === username);
  if (!row) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password, row.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const user = { id: row.id, name: row.name, username: row.username, email: row.email };
  const token = jwt.sign(user, SECRET, { expiresIn: '7d' });

  res.json({ token, user });
});

// Get current user
router.get('/me', auth, (req, res) => {
  const data = load();
  const row = data.users.find(u => u.id === req.user.id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json({ id: row.id, name: row.name, username: row.username, email: row.email, created_at: row.created_at });
});

module.exports = router;
