const crypto = require('crypto');
const { usersFile } = require('./config');
const { readUsers, saveUsers } = require('./lib/jsonStore');
const { hashPassword } = require('./lib/passwords');

async function main() {
  const [, , emailArg, passwordArg, nameArg, roleArg] = process.argv;
  if (!emailArg || !passwordArg) {
    console.error('Usage: npm run create-user -- email password [name] [role]');
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  const name = nameArg || email;
  const role = roleArg || 'user';
  const users = await readUsers(usersFile);
  const existing = users.find((user) => user.email === email);
  if (existing) {
    console.error(`User already exists: ${email}`);
    process.exit(1);
  }

  users.push({
    id: `user_${crypto.randomUUID()}`,
    email,
    name,
    role,
    passwordHash: hashPassword(passwordArg),
  });

  await saveUsers(usersFile, users);
  console.log(`Created user: ${email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
