const { Pool } = require('pg');
require('dotenv').config();

// Подключение к базе данных
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

async function createTables() {
  // Таблица пользователей
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Теперь UUID
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Новая таблица для резюме
  await pool.query(`
    CREATE TABLE IF NOT EXISTS resumes (
      resume_id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(user_id) ON DELETE CASCADE, -- Ссылка на UUID
      title VARCHAR(255) NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("Таблицы 'users' и 'resumes' проверены/созданы.");
}

module.exports = { pool, createTables };