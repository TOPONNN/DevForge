const express = require('express');

const { pool } = require('../database');

const router = express.Router();

function sanitizeMember(member) {
  if (!member) {
    return null;
  }

  const { password, ...safeMember } = member;
  return safeMember;
}

router.post('/register', async (req, res, next) => {
  try {
    const { username, password, nickname } = req.body || {};

    if (!username || !password || !nickname) {
      const error = new Error('username, password, nickname are required');
      error.status = 400;
      throw error;
    }

    const [result] = await pool.query(
      `
      INSERT INTO members (username, password, nickname)
      VALUES (?, ?, ?)
      `,
      [username, password, nickname]
    );

    const [rows] = await pool.query(
      `
      SELECT id, username, nickname, total_games, total_wins, total_catches, created_at, updated_at
      FROM members
      WHERE id = ?
      `,
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    if (error && error.code === 'ER_DUP_ENTRY') {
      error.status = 409;
      error.message = 'username already exists';
    }
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      const error = new Error('username and password are required');
      error.status = 400;
      throw error;
    }

    const [rows] = await pool.query('SELECT * FROM members WHERE username = ? LIMIT 1', [username]);
    const member = rows[0];

    if (!member || member.password !== password) {
      const error = new Error('Invalid username or password');
      error.status = 401;
      throw error;
    }

    res.json(sanitizeMember(member));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, username, nickname, total_games, total_wins, total_catches, created_at, updated_at
      FROM members
      WHERE id = ?
      LIMIT 1
      `,
      [req.params.id]
    );

    if (!rows[0]) {
      const error = new Error('Member not found');
      error.status = 404;
      throw error;
    }

    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
