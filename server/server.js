require('dotenv').config(); // <- WAJIB DI BARIS PERTAMA

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const serverConfig = require('../config/server.config');
const messageHandler = require('./messageHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

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