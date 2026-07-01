const gameService = require('../src/services/gameService');
const broadcast = require('./broadcast');

function registerEvents(io, socket) {
  console.log(`[Network Log] Node Client Terhubung: ${socket.id}`);

  socket.on('createRoom', async (username) => {
    try {
      const roomCode = await gameService.createRoom(socket.id, username);
      socket.join(roomCode);
      const players = gameService.getPlayers(roomCode);
      socket.emit('roomCreated', { roomCode, players });
      console.log(`[Room Engine] Room ${roomCode} diinisiasi oleh Host: ${username}`);
    } catch (err) {
      socket.emit('errorMsg', 'Gagal membuat room.');
    }
  });

  socket.on('joinRoom', ({ roomCode, username }) => {
    const success = gameService.joinRoom(roomCode, socket.id, username);
    if (!success) {
      return socket.emit('errorMsg', 'Room tidak valid atau game sudah dimulai.');
    }
    socket.join(roomCode);
    broadcast.toRoom(io, roomCode, 'playerJoined', gameService.getPlayers(roomCode));
  });

  socket.on('startGame', ({ roomCode }) => {
    if (gameService.isHost(roomCode, socket.id)) {
      gameService.startNextQuestion(io, roomCode);
    }
  });

  socket.on('submitAnswer', async ({ roomCode, jawaban }) => {
    // Diproses menggunakan Concurrency Engine non-blocking (Naya Dev Task)
    await gameService.processAnswer(io, roomCode, socket.id, jawaban);
  });

  socket.on('disconnect', () => {
    console.log(`[Network Log] Node Client Terputus: ${socket.id}`);
  });
}

module.exports = { registerEvents };