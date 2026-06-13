// ============ Taskora Frontend ============
const API = '/api';

const state = {
  token: localStorage.getItem('taskora_token') || null,
  user: JSON.parse(localStorage.getItem('taskora_user') || 'null'),
  tasks: [],
  filters: { status: '', priority: '', search: '' },
  socket: null,
};

const app = document.getElementById('app');
const navLinks = document.getElementById('nav-links');
const toastContainer = document.getElementById('toast-container');

// ---------- Helpers ----------
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

function fmtDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(task) {
  return task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date(new Date().toDateString());
}

function timeAgo(dateStr) {
  const date = new Date(dateStr);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function showToast(message, type = 'info') {
  const icons = { info: 'ℹ️', success: '✅', error: '❌' };
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${icons[type] || icons.info}</span><span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const res = await fetch(API + path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function setAuth(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('taskora_token', token);
  localStorage.setItem('taskora_user', JSON.stringify(user));
  connectSocket();
}

function logout() {
  if (state.socket) state.socket.disconnect();
  state.token = null;
  state.user = null;
  state.socket = null;
  localStorage.removeItem('taskora_token');
  localStorage.removeItem('taskora_user');
  navigate('login');
}

// ---------- Socket.IO ----------
function connectSocket() {
  if (state.socket) state.socket.disconnect();
  state.socket = io({ auth: { token: state.token } });

  state.socket.on('connect', () => {
    updateConnStatus(true);
  });

  state.socket.on('disconnect', () => {
    updateConnStatus(false);
  });

  state.socket.on('connect_error', () => {
    updateConnStatus(false);
  });

  state.socket.on('task:created', (task) => {
    if (!state.tasks.find(t => t.id === task.id)) {
      state.tasks.unshift(task);
      renderTaskGrid();
      refreshStats();
      showToast(`New task "${task.title}" added`, 'success');
    }
  });

  state.socket.on('task:updated', (task) => {
    const idx = state.tasks.findIndex(t => t.id === task.id);
    if (idx !== -1) {
      state.tasks[idx] = task;
      renderTaskGrid();
      refreshStats();
    }
  });

  state.socket.on('task:deleted', ({ id }) => {
    state.tasks = state.tasks.filter(t => t.id !== id);
    renderTaskGrid();
    refreshStats();
  });
}

function updateConnStatus(connected) {
  const dot = document.getElementById('conn-dot');
  const label = document.getElementById('conn-label');
  if (!dot) return;
  dot.classList.toggle('connected', connected);
  if (label) label.textContent = connected ? 'Live' : 'Offline';
}

// ---------- Router ----------
function navigate(route) {
  window.location.hash = route;
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', () => {
  if (state.user && state.token) connectSocket();
  render();
});

function currentRoute() {
  return window.location.hash.slice(1) || 'home';
}

// ---------- Nav ----------
function renderNav() {
  if (state.user) {
    navLinks.innerHTML = `
      <span class="conn-status"><span class="conn-dot" id="conn-dot"></span><span id="conn-label">Connecting…</span></span>
      <a href="#home">Dashboard</a>
      <span style="color:var(--text-dim); font-size:14px;">Hi, <strong style="color:var(--text)">${escapeHtml(state.user.name)}</strong></span>
      <button class="btn btn-sm" id="logout-btn">Logout</button>
    `;
    document.getElementById('logout-btn').onclick = logout;
    if (state.socket) updateConnStatus(state.socket.connected);
  } else {
    navLinks.innerHTML = `
      <a href="#login">Login</a>
      <a href="#register">Register</a>
    `;
  }
}

// ---------- Main Render ----------
async function render() {
  renderNav();
  const route = currentRoute();

  if (!state.user && route !== 'login' && route !== 'register') {
    return navigate('login');
  }

  if (route === 'login') return renderLogin();
  if (route === 'register') return renderRegister();
  return renderDashboard();
}

// ---------- Dashboard ----------
async function renderDashboard() {
  app.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Your Tasks</h1>
        <p class="subtitle">Stay on top of everything that matters</p>
      </div>
      <button class="btn btn-primary" onclick="openTaskModal()">➕ New Task</button>
    </div>

    <div class="stats-grid" id="stats-grid">
      <div class="stat-card stat-total"><div class="label">Total</div><div class="value">–</div></div>
      <div class="stat-card stat-todo"><div class="label">To Do</div><div class="value">–</div></div>
      <div class="stat-card stat-progress"><div class="label">In Progress</div><div class="value">–</div></div>
      <div class="stat-card stat-done"><div class="label">Done</div><div class="value">–</div></div>
      <div class="stat-card stat-overdue"><div class="label">Overdue</div><div class="value">–</div></div>
      <div class="stat-card stat-high"><div class="label">High Priority</div><div class="value">–</div></div>
    </div>

    <div class="filters">
      <input type="text" id="search-input" placeholder="🔍 Search tasks..." value="${escapeHtml(state.filters.search)}" />
      <select id="status-filter">
        <option value="">All Statuses</option>
        <option value="todo">To Do</option>
        <option value="in-progress">In Progress</option>
        <option value="done">Done</option>
      </select>
      <select id="priority-filter">
        <option value="">All Priorities</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
    </div>

    <div class="task-grid" id="task-grid"><div class="spinner"></div></div>
  `;

  // restore filter values
  document.getElementById('status-filter').value = state.filters.status;
  document.getElementById('priority-filter').value = state.filters.priority;

  document.getElementById('search-input').oninput = debounce((e) => {
    state.filters.search = e.target.value;
    loadTasks();
  }, 300);
  document.getElementById('status-filter').onchange = (e) => {
    state.filters.status = e.target.value;
    loadTasks();
  };
  document.getElementById('priority-filter').onchange = (e) => {
    state.filters.priority = e.target.value;
    loadTasks();
  };

  if (state.socket) updateConnStatus(state.socket.connected);

  await Promise.all([loadTasks(), refreshStats()]);
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function loadTasks() {
  const grid = document.getElementById('task-grid');
  if (!grid) return;
  grid.innerHTML = `<div class="spinner"></div>`;
  try {
    const params = new URLSearchParams();
    if (state.filters.status) params.set('status', state.filters.status);
    if (state.filters.priority) params.set('priority', state.filters.priority);
    if (state.filters.search) params.set('search', state.filters.search);
    const tasks = await api(`/tasks?${params.toString()}`);
    state.tasks = tasks;
    renderTaskGrid();
  } catch (e) {
    grid.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
  }
}

async function refreshStats() {
  const gridEl = document.getElementById('stats-grid');
  if (!gridEl) return;
  try {
    const stats = await api('/tasks/stats');
    const cards = gridEl.querySelectorAll('.stat-card .value');
    cards[0].textContent = stats.total;
    cards[1].textContent = stats.todo;
    cards[2].textContent = stats.in_progress;
    cards[3].textContent = stats.done;
    cards[4].textContent = stats.overdue;
    cards[5].textContent = stats.high_priority;
  } catch (e) { /* ignore */ }
}

function renderTaskGrid() {
  const grid = document.getElementById('task-grid');
  if (!grid) return;

  if (state.tasks.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="icon">📋</div>
        <p>No tasks found. ${state.filters.search || state.filters.status || state.filters.priority ? 'Try adjusting your filters.' : 'Create your first task to get started!'}</p>
      </div>`;
    return;
  }

  grid.innerHTML = state.tasks.map(taskCardHtml).join('');
}

function statusLabel(status) {
  return { todo: 'To Do', 'in-progress': 'In Progress', done: 'Done' }[status] || status;
}

function taskCardHtml(t) {
  const overdue = isOverdue(t);
  return `
    <div class="task-card ${t.status === 'done' ? 'done' : ''}" id="task-${t.id}">
      <div class="task-top">
        <div class="task-title">${escapeHtml(t.title)}</div>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-sm" onclick="openTaskModal(${t.id})" title="Edit">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteTask(${t.id})" title="Delete">🗑️</button>
        </div>
      </div>
      ${t.description ? `<div class="task-desc">${escapeHtml(t.description)}</div>` : ''}
      <div class="task-meta">
        <span class="badge badge-${t.status}">${statusLabel(t.status)}</span>
        <span class="badge badge-${t.priority}">${t.priority}</span>
        ${overdue ? '<span class="badge badge-overdue">⚠ Overdue</span>' : ''}
        ${t.due_date ? `<span class="due-date">📅 ${fmtDate(t.due_date)}</span>` : ''}
      </div>
      <div class="task-actions">
        <select class="status-select" onchange="quickStatusChange(${t.id}, this.value)">
          <option value="todo" ${t.status === 'todo' ? 'selected' : ''}>To Do</option>
          <option value="in-progress" ${t.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
          <option value="done" ${t.status === 'done' ? 'selected' : ''}>Done</option>
        </select>
      </div>
    </div>
  `;
}

async function quickStatusChange(id, status) {
  try {
    const updated = await api(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx !== -1) state.tasks[idx] = updated;
    renderTaskGrid();
    refreshStats();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function deleteTask(id) {
  if (!confirm('Delete this task permanently?')) return;
  try {
    await api(`/tasks/${id}`, { method: 'DELETE' });
    state.tasks = state.tasks.filter(t => t.id !== id);
    renderTaskGrid();
    refreshStats();
    showToast('Task deleted', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ---------- Task Modal ----------
function openTaskModal(id) {
  const task = id ? state.tasks.find(t => t.id === id) : null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'task-modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>${task ? '✏️ Edit Task' : '➕ New Task'}</h2>
      <div id="modal-error"></div>
      <div class="form-group">
        <label>Title</label>
        <input id="task-title" type="text" placeholder="Task title..." value="${task ? escapeHtml(task.title) : ''}" />
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="task-description" rows="4" placeholder="Optional details...">${task ? escapeHtml(task.description) : ''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Status</label>
          <select id="task-status">
            <option value="todo" ${task && task.status === 'todo' ? 'selected' : ''}>To Do</option>
            <option value="in-progress" ${task && task.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
            <option value="done" ${task && task.status === 'done' ? 'selected' : ''}>Done</option>
          </select>
        </div>
        <div class="form-group">
          <label>Priority</label>
          <select id="task-priority">
            <option value="low" ${task && task.priority === 'low' ? 'selected' : ''}>Low</option>
            <option value="medium" ${!task || task.priority === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="high" ${task && task.priority === 'high' ? 'selected' : ''}>High</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Due Date (optional)</label>
        <input id="task-due" type="date" value="${task && task.due_date ? task.due_date.slice(0,10) : ''}" />
      </div>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-primary" id="save-task-btn">${task ? 'Save Changes' : 'Create Task'}</button>
        <button class="btn" id="cancel-task-btn">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.getElementById('cancel-task-btn').onclick = closeModal;

  document.getElementById('save-task-btn').onclick = async () => {
    const title = document.getElementById('task-title').value.trim();
    const description = document.getElementById('task-description').value.trim();
    const status = document.getElementById('task-status').value;
    const priority = document.getElementById('task-priority').value;
    const due_date = document.getElementById('task-due').value || null;
    const errBox = document.getElementById('modal-error');
    errBox.innerHTML = '';

    if (!title) {
      errBox.innerHTML = `<div class="alert alert-error">Title is required.</div>`;
      return;
    }

    try {
      if (task) {
        const updated = await api(`/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify({ title, description, status, priority, due_date }) });
        const idx = state.tasks.findIndex(t => t.id === task.id);
        if (idx !== -1) state.tasks[idx] = updated;
        showToast('Task updated', 'success');
      } else {
        const created = await api('/tasks', { method: 'POST', body: JSON.stringify({ title, description, status, priority, due_date }) });
        state.tasks.unshift(created);
        showToast('Task created', 'success');
      }
      renderTaskGrid();
      refreshStats();
      closeModal();
    } catch (e) {
      errBox.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
    }
  };
}

function closeModal() {
  const overlay = document.getElementById('task-modal-overlay');
  if (overlay) overlay.remove();
}

// ---------- Auth Pages ----------
function renderLogin() {
  app.innerHTML = `
    <div class="card auth-card">
      <h2>Welcome back 👋</h2>
      <div id="auth-error"></div>
      <div class="form-group">
        <label>Username or Email</label>
        <input id="login-username" type="text" placeholder="yourname" />
      </div>
      <div class="form-group">
        <label>Password</label>
        <input id="login-password" type="password" placeholder="••••••••" />
      </div>
      <button class="btn btn-primary btn-block" id="login-btn">Login</button>
      <p class="auth-switch">Don't have an account? <a href="#register">Register here</a></p>
    </div>
  `;

  const submit = async () => {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errBox = document.getElementById('auth-error');
    errBox.innerHTML = '';
    if (!username || !password) {
      errBox.innerHTML = `<div class="alert alert-error">Please fill in all fields.</div>`;
      return;
    }
    try {
      const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      setAuth(data.token, data.user);
      navigate('home');
    } catch (e) {
      errBox.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
    }
  };

  document.getElementById('login-btn').onclick = submit;
  document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

function renderRegister() {
  app.innerHTML = `
    <div class="card auth-card">
      <h2>Create your account ✨</h2>
      <div id="auth-error"></div>
      <div class="form-group">
        <label>Full Name</label>
        <input id="reg-name" type="text" placeholder="Jane Doe" />
      </div>
      <div class="form-group">
        <label>Username</label>
        <input id="reg-username" type="text" placeholder="janedoe" />
      </div>
      <div class="form-group">
        <label>Email</label>
        <input id="reg-email" type="email" placeholder="you@example.com" />
      </div>
      <div class="form-group">
        <label>Password</label>
        <input id="reg-password" type="password" placeholder="At least 6 characters" />
      </div>
      <button class="btn btn-primary btn-block" id="reg-btn">Create Account</button>
      <p class="auth-switch">Already have an account? <a href="#login">Login here</a></p>
    </div>
  `;

  document.getElementById('reg-btn').onclick = async () => {
    const name = document.getElementById('reg-name').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const errBox = document.getElementById('auth-error');
    errBox.innerHTML = '';

    if (!name || !username || !email || !password) {
      errBox.innerHTML = `<div class="alert alert-error">Please fill in all fields.</div>`;
      return;
    }

    try {
      const data = await api('/auth/register', { method: 'POST', body: JSON.stringify({ name, username, email, password }) });
      setAuth(data.token, data.user);
      navigate('home');
    } catch (e) {
      errBox.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
    }
  };
}

// Expose functions used by inline handlers
window.navigate = navigate;
window.openTaskModal = openTaskModal;
window.deleteTask = deleteTask;
window.quickStatusChange = quickStatusChange;
