// database/connection.js
const mysql = require('mysql2/promise');
const dbConfig = require('../config/database.config');

class DatabaseConnection {
  constructor() {
    this.pool = null;
    // Jalankan inisialisasi otomatis secara asinkron di latar belakang
    this.init().catch(err => {
      console.error('[MySQL Error] Gagal menginisialisasi database:', err.message);
    });
  }

  async init() {
    console.log('[DB Engine] Memulai pengecekan dan inisialisasi database...');
    
    // 1. Koneksi awal tanpa memilih database untuk memastikan database ada/dibuat
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password
    });

    // 2. Buat database jika belum tersedia
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`);
    await connection.end();

    // 3. Inisialisasi Async Connection Pool yang sesungguhnya ke database target
    this.pool = mysql.createPool(dbConfig);

    // 4. Buat Tabel Soal
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS queries_soal (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lirik TEXT NOT NULL,
        opsi_a VARCHAR(255) NOT NULL,
        opsi_b VARCHAR(255) NOT NULL,
        opsi_c VARCHAR(255) NOT NULL,
        opsi_d VARCHAR(255) NOT NULL,
        opsi_e VARCHAR(255) NOT NULL,
        jawaban_benar CHAR(1) NOT NULL
      );
    `);

    // 5. Buat Tabel Skor (Untuk mencatat arsip leaderboard final)
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS skor_pemain (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        skor INT NOT NULL,
        dibuat_pada TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Otomatis Seed Data Soal jika tabel masih kosong
    const [rows] = await this.pool.query('SELECT COUNT(*) as total FROM queries_soal');
    if (rows[0].total === 0) {
      console.log('[DB Engine] Tabel soal kosong. Melakukan seeding data otomatis...');
      
      const dataSeed = [
        ["Kulihat Ibu Pertiwi, sedang bersusah hati. Air matanya berlinang, mas intannya terkenang...", "Indonesia Raya", "Ibu Pertiwi", "Tanah Airku", "Rayuan Pulau Kelapa", "Bagimu Negeri", "B"],
        ["Hati-hati di jalan. Kukira kita akan bersama. Begitu banyak cerita yang telah kita lalui...", "Monokrom", "Sepatu", "Hati-Hati di Jalan", "Diri", "Gajah", "C"],
        ["Sebab kau terlalu indah dari sekadar kata. Dunia berhenti sejenak menikmati indahmu...", "Komang", "Sesuatu di Jogja", "Untungnya, Hidup Harus Tetap Berjalan", "Penjaga Hati", "Rumah Singgah", "A"],
        ["Mimpi adalah kunci untuk kita menaklukkan dunia. Berlarilah tanpa lelah sampai engkau meraihnya...", "Laskar Pelangi", "Sang Dewi", "Perahu Kertas", "Bintang di Surga", "Negeri di Awan", "A"],
        ["Jangan salahkan faham ku kini tertuju oh. Siapa yang tau, Siapa yang mau, Kau di sana, Aku diseberangmu...", "Evaluasi", "Secukupnya", "Mangu", "Rumah Ke Rumah", "Membasuh", "C"],
        ["Kalau memang harus terluka, aku akan belajar lagi. Sebab hati ini sudah terlatih patah hati...", "Patah", "Terlatih Patah Hati", "Aku Yang Salah", "Tak Segampang Itu", "Cinta Luar Biasa", "B"]
      ];

      const queryInsert = `
        INSERT INTO queries_soal (lirik, opsi_a, opsi_b, opsi_c, opsi_d, opsi_e, jawaban_benar) 
        VALUES ?
      `;
      await this.pool.query(queryInsert, [dataSeed]);
      console.log('[DB Engine] Sukses melakukan seeding 6 soal bawaan.');
    } else {
      console.log('[DB Engine] Data soal terdeteksi ready. Seeding dilewati.');
    }
  }

  // Mengambil soal dari MySQL secara asinkron
  async getQuestions() {
    // Memastikan pool sudah siap sebelum query dijalankan
    if (!this.pool) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return this.getQuestions();
    }

    const [rows] = await this.pool.query('SELECT * FROM queries_soal');
    
    // Lakukan mapping dari format database ke format objek JSON game engine
    return rows.map(row => ({
      id: row.id,
      lirik: row.lirik,
      opsi: {
        A: row.opsi_a,
        B: row.opsi_b,
        C: row.opsi_c,
        D: row.opsi_d,
        E: row.opsi_e
      },
      jawabanBenar: row.jawaban_benar
    }));
  }

  // Menyimpan skor akhir ke MySQL
  async saveFinalScore(username, score) {
    if (!this.pool) return;
    try {
      await this.pool.query(
        'INSERT INTO skor_pemain (username, skor) VALUES (?, ?)',
        [username, score]
      );
      console.log(`[MySQL DB Replikasi] Sukses menyimpan data skor untuk: ${username}`);
    } catch (err) {
      console.error('[MySQL DB Error] Gagal menyimpan skor:', err.message);
    }
  }
}

module.exports = new DatabaseConnection();