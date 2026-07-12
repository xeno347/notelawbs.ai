const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { databaseFile } = require('../config');

let db;

function ensureDatabase() {
  if (db) {
    return db;
  }

  fs.mkdirSync(path.dirname(databaseFile), { recursive: true });
  db = new DatabaseSync(databaseFile);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);
  return db;
}

function tableExists(name) {
  const stmt = ensureDatabase().prepare('SELECT 1 FROM sqlite_master WHERE type = ? AND name = ? LIMIT 1');
  return Boolean(stmt.get('table', name));
}

function columnExists(table, column) {
  const stmt = ensureDatabase().prepare(`PRAGMA table_info(${table})`);
  return stmt.all().some((row) => row.name === column);
}

function run(sql, params = {}) {
  return ensureDatabase().prepare(sql).run(params);
}

function all(sql, params = {}) {
  return ensureDatabase().prepare(sql).all(params);
}

function get(sql, params = {}) {
  return ensureDatabase().prepare(sql).get(params);
}

module.exports = {
  ensureDatabase,
  tableExists,
  columnExists,
  run,
  all,
  get,
};
