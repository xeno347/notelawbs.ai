# Backend

This backend is a small Node.js auth service for the mobile frontend.

## What it needs

- Node.js 18 or newer
- `PORT` for the HTTP server, default `4000`
- `JWT_SECRET` for signing sessions
- `USERS_FILE` if you want to store users somewhere other than `backend/data/users.json`
- `TOKEN_TTL_SECONDS` if you want a different session lifetime

## What it does

- `POST /auth/login` for existing users only
- `GET /auth/me` for session validation
- No public registration route

## Default demo user

- Email: `admin@notelawbs.ai`
- Password: `ChangeMe123!`

## Scripts

- `npm start`
- `npm run dev`
- `npm run create-user -- email password [name] [role]`
