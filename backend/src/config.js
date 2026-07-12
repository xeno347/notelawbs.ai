const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');

module.exports = {
  port: Number(process.env.PORT || 4000),
  tokenTtlSeconds: Number(process.env.TOKEN_TTL_SECONDS || 60 * 60 * 24 * 7),
  jwtSecret: process.env.JWT_SECRET || 'notelawbs-dev-secret-change-me',
  usersFile: process.env.USERS_FILE || path.join(rootDir, 'data', 'users.json'),
  databaseFile: process.env.DATABASE_FILE || path.join(dataDir, 'notelawbs.sqlite'),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  maxBodyBytes: Number(process.env.MAX_BODY_BYTES || 1024 * 1024),
  defaultUsers: [
    {
      id: 'user-admin',
      email: 'admin@notelawbs.ai',
      name: 'Admin User',
      role: 'admin',
      password: 'ChangeMe123!',
    },
  ],
};
