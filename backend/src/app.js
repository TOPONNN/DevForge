const cors = require('cors');
const express = require('express');

const healthRouter = require('./routes/health');
const roomsRouter = require('./routes/rooms');
const gamesRouter = require('./routes/games');
const membersRouter = require('./routes/members');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(express.json());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Origin not allowed by CORS'));
    },
  })
);

app.use('/api/health', healthRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/games', gamesRouter);
app.use('/api/members', membersRouter);

app.use((error, req, res, next) => {
  const status = Number(error.status || 500);
  const message = error.message || 'Internal Server Error';

  res.status(status).json({ status, message });
});

module.exports = app;
