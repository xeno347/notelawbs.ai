const { ensureDatabase, run, all, get } = require('./sqlite');
const { defaultUsers } = require('../config');
const { hashPassword } = require('./passwords');

function sqlValue(value) {
  if (value == null) {
    return 'NULL';
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function initUsersTable() {
  ensureDatabase().exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      passwordHash TEXT NOT NULL
    );
  `);
}

async function readUsers() {
  initUsersTable();
  const users = all('SELECT id, email, name, role, passwordHash FROM users ORDER BY email ASC');
  if (users.length > 0) {
    return users;
  }

  const seededUsers = defaultUsers.map((user) => ({
    id: user.id,
    email: user.email.toLowerCase(),
    name: user.name,
    role: user.role,
    passwordHash: hashPassword(user.password),
  }));

  for (const entry of seededUsers) {
    ensureDatabase().exec(
      `INSERT INTO users (id, email, name, role, passwordHash) VALUES (${[
        entry.id,
        entry.email,
        entry.name,
        entry.role,
        entry.passwordHash,
      ].map(sqlValue).join(', ')})`,
    );
  }
  return seededUsers;
}

async function saveUsers(_filePath, users) {
  initUsersTable();
  const database = ensureDatabase();
  database.exec('DELETE FROM users;');
  for (const entry of users) {
    database.exec(
      `INSERT INTO users (id, email, name, role, passwordHash) VALUES (${[
        entry.id,
        entry.email,
        entry.name,
        entry.role,
        entry.passwordHash,
      ].map(sqlValue).join(', ')})`,
    );
  }
}

module.exports = {
  readUsers,
  saveUsers,
};
