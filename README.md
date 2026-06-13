# ✅ Taskora — Professional Task Management Platform

Taskora is a full-stack task management web app with secure authentication, full task CRUD, live real-time updates via WebSockets, and a polished responsive dark UI.

## ✨ Features

- **Authentication & Authorization**: JWT-based register/login, passwords hashed with bcrypt. Every task is private to its owner.
- **Task CRUD**: Create, view, edit, and delete tasks with title, description, status, priority, and due date.
- **Status workflow**: To Do → In Progress → Done, changeable via quick dropdown on each task card.
- **Real-time updates (WebSockets)**: Powered by Socket.IO — any change (create/update/delete) instantly syncs across all open tabs/devices for that user, with a live "connected" indicator.
- **Dashboard stats**: Live counters for total, to-do, in-progress, done, overdue, and high-priority tasks.
- **Filtering & search**: Filter by status, priority, and free-text search across title/description.
- **Overdue detection**: Tasks past their due date (and not done) are flagged automatically.
- **Responsive dark UI**: Clean blue/cyan gradient theme that adapts to mobile and desktop screens.
- **Toast notifications**: Friendly feedback for creates, updates, deletes, and real-time events from other sessions.

## 🚀 Getting Started

```bash
npm install
npm start
```

Then open **http://localhost:3000** in your browser. Override the port with the `PORT` environment variable if needed.

## 📡 API Endpoints

| Method | Endpoint              | Auth required | Description                        |
|--------|-----------------------|----------------|-------------------------------------|
| POST   | `/api/auth/register`  | No             | Register a new user                  |
| POST   | `/api/auth/login`     | No             | Login and get a JWT token            |
| GET    | `/api/auth/me`        | Yes            | Get current user info                |
| GET    | `/api/tasks`          | Yes            | List your tasks (supports `?status=`, `?priority=`, `?search=`) |
| GET    | `/api/tasks/stats`    | Yes            | Get task statistics                  |
| GET    | `/api/tasks/:id`      | Yes (owner)    | Get a single task                    |
| POST   | `/api/tasks`          | Yes            | Create a new task                    |
| PUT    | `/api/tasks/:id`      | Yes (owner)    | Update a task                        |
| DELETE | `/api/tasks/:id`      | Yes (owner)    | Delete a task                        |
| GET    | `/api/health`         | No             | Health check                         |

## 🔌 Real-time Events (Socket.IO)

Connect with `io({ auth: { token: <JWT> } })`. The server then joins the socket to a private room and emits:

- `task:created` — a new task was created
- `task:updated` — a task was edited (including status changes)
- `task:deleted` — a task was deleted (`{ id }`)

## 🗂️ Project Structure

```
Taskora/
├── server.js          # Express + Socket.IO entry point
├── db.js              # JSON-file database helper
├── taskora.json       # Auto-created data store
├── middleware/
│   └── auth.js         # JWT auth middleware
├── routes/
│   ├── auth.js          # Register/login/me
│   └── tasks.js         # Task CRUD + stats
└── public/              # Frontend SPA
    ├── index.html
    ├── styles.css
    └── app.js
```

## ✅ Verified Working

All features tested end-to-end via live API calls and a real Socket.IO client:
- ✔️ Registration, login, and rejection of invalid credentials
- ✔️ JWT-protected routes reject requests without a valid token
- ✔️ Task create/update/delete with strict per-user ownership checks
- ✔️ Filtering by status, priority, and search term
- ✔️ Stats endpoint correctly counts total/todo/in-progress/done/overdue/high-priority
- ✔️ Real-time `task:created` event received live over WebSocket immediately after creating a task via the REST API
- ✔️ Frontend assets (HTML/CSS/JS + Socket.IO client) served correctly

## 🔐 Notes

- Set a custom `JWT_SECRET` environment variable in production.
- `taskora.json` is created automatically on first run.
- Passwords are never stored in plain text.

Stay organized! ✅
# Task-Management-Application
