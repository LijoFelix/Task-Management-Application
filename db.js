// Simple JSON-file backed database (pure JS, no native deps)
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'taskora.json');

function load() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = { users: [], tasks: [], nextId: { users: 1, tasks: 1 } };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function nextId(data, table) {
  const id = data.nextId[table];
  data.nextId[table] = id + 1;
  return id;
}

module.exports = { load, save, nextId };
