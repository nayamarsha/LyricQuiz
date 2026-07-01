const gameService = require('../src/services/gameService');
const broadcast = require('./broadcast');

const messageHandler = {
  registerEvents(io, socket) {
    
    socket.on('createRoom', async ({ username, role }) => {
      const roomCode = await gameService.createRoom(socket.id, username, role);
      socket.join(roomCode);
      
      const players = gameService.getPlayers(roomCode);
      socket.emit('roomCreated', { roomCode, players });
    });

    socket.on('joinRoom', ({ roomCode, username, role }) => {
      const success = gameService.joinRoom(roomCode, socket.id, username, role);
      
      if (success) {
        socket.join(roomCode);
        const players = gameService.getPlayers(roomCode);
        // Distribusikan daftar simpul aktif ke seluruh klien terhubung di dalam room
        broadcast.toRoom(io, roomCode, 'roomUpdated', { players });
      } else {
        socket.emit('errorMsg', 'Gagal gabung room. Kemungkinan kode salah atau room sudah main.');
      }
    });

    socket.on('startGame', ({ roomCode }) => {
      if (gameService.isHost(roomCode, socket.id)) {
        gameService.startNextQuestion(io, roomCode);
      } else {
        socket.emit('errorMsg', 'Hanya Host yang bisa memulai match!');
      }
    });

    socket.on('submitAnswer', ({ roomCode, jawaban }) => {
      gameService.processAnswer(io, roomCode, socket.id, jawaban);
    });

    // Poin 5: Menangani Event User keluar game secara manual
    socket.on('leaveRoom', ({ roomCode }) => {
      const res = gameService.leaveRoom(roomCode, socket.id);
      socket.leave(roomCode);
      socket.emit('roomLeft');

      if (res && !res.destroyed) {
        // kabari player lain kalau ada yang keluar
        broadcast.toRoom(io, roomCode, 'roomUpdated', { players: res.remainingPlayers });
      }
    });

    // Otomatis lepaskan simpul socket jika tab browser tertutup
    socket.on('disconnect', () => {
      // Cari jika socket ini terdaftar di salah satu room aktif
      for (const code in gameService.rooms) {
        if (gameService.rooms[code].players[socket.id]) {
          const res = gameService.leaveRoom(code, socket.id);
          if (res && !res.destroyed) {
            broadcast.toRoom(io, code, 'roomUpdated', { players: res.remainingPlayers });
          }
          break;
        }
      }
    });
  }
};

module.exports = messageHandler;