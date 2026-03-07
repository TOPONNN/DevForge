const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'mysql',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'pokemon',
  password: process.env.MYSQL_PASSWORD || 'pokemon1234',
  database: process.env.MYSQL_DATABASE || 'pokemon_prophunt',
  waitForConnections: true,
  connectionLimit: 10,
});

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS members (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(20) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      nickname VARCHAR(20) NOT NULL,
      total_games INT NOT NULL DEFAULT 0,
      total_wins INT NOT NULL DEFAULT 0,
      total_catches INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_sessions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      room_code VARCHAR(10) NOT NULL,
      map_id VARCHAR(30) NOT NULL,
      player_count INT NOT NULL,
      trainer_win BOOLEAN NOT NULL,
      duration INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      game_session_id BIGINT NOT NULL,
      member_id BIGINT,
      player_name VARCHAR(50) NOT NULL,
      role VARCHAR(20) NOT NULL,
      species VARCHAR(30),
      caught BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_session_id) REFERENCES game_sessions(id),
      FOREIGN KEY (member_id) REFERENCES members(id)
    )
  `);
}

module.exports = {
  pool,
  initDatabase,
};
