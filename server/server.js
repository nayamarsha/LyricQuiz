require('dotenv').config(); 

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const serverConfig = require('../config/server.config');
const messageHandler = require('./messageHandler');
const gameService = require('../src/services/gameService'); 

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

app.get('/api/benchmark', async (req, res) => {
  try {
    const hasilAnalisis = await gameService.runPerformanceBenchmark();
    res.json(hasilAnalisis);
  } catch (error) {
    console.error('[Benchmark Error]:', error);
    res.status(500).json({ error: "Gagal memproses kalkulasi benchmark." });
  }
});

io.on('connection', (socket) => {
  messageHandler.registerEvents(io, socket);
});

// AMAN: Menggunakan Port Dinamis dari Railway, jika tidak ada baru gunakan dari config/8080
const PORT = process.env.PORT || serverConfig.port || 8080;

// WAJIB: Tambahkan '0.0.0.0' agar bisa diakses dari jaringan luar Railway
server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`[Central Server Node] Berjalan di port: ${PORT}`);
  console.log(`[Environment] Mode: ${serverConfig.env}`);
  console.log(`====================================================`);
});