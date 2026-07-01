class BroadcastEngine {
  // Strategi Push-based broadcast untuk menjamin sinkronisasi data real-time seluruh simpul client
  toRoom(io, roomCode, event, data) {
    io.to(roomCode).emit(event, data);
  }
}

module.exports = new BroadcastEngine();