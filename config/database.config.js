// Memasukkan dotenv di sini juga untuk memastikan variabel lingkungan terbaca saat testing/isolasi
require('dotenv').config();

module.exports = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'quiz_db',
  connectionLimit: 10
};