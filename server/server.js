// server/server.js
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

server.listen(serverConfig.port, () => {
  console.log(`====================================================`);
  console.log(`[Central Server Node] Berjalan di http://localhost:${serverConfig.port}`);
  console.log(`[Environment] Mode: ${serverConfig.env}`);
  console.log(`====================================================`);
});