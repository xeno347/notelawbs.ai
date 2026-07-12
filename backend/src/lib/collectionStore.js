const fs = require('fs/promises');
const path = require('path');

async function ensureDirectory(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readCollection(filePath, fallback = []) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    return fallback;
  }
}

async function writeCollection(filePath, value) {
  await ensureDirectory(filePath);
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function nextId(prefix) {
  return `${prefix}_${require('crypto').randomUUID()}`;
}

module.exports = {
  readCollection,
  writeCollection,
  nextId,
};
