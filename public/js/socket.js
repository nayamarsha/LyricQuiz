const socket = io();

const App = {
  createRoom() {
    const name = document.getElementById('username').value.trim();
    if (!name) return alert("Username kosong!");
    State.username = name;
    State.isHost = true;
    socket.emit('createRoom', name);
  },

  joinRoom() {
    const name = document.getElementById('username').value.trim();
    const code = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (!name || !code) return alert("Isi nama dan PIN room!");
    State.username = name;
    State.currentRoomCode = code;
    socket.emit('joinRoom', { roomCode: code, username: name });
  },

  startGame() {
    socket.emit('startGame', { roomCode: State.currentRoomCode });
  },

  submitAnswer(key) {
    socket.emit('submitAnswer', { roomCode: State.currentRoomCode, jawaban: key });
    const buttons = document.querySelectorAll('.btn-opsi');
    buttons.forEach(btn => btn.disabled = true);
  }
};

// Stream Receiver Events
socket.on('roomCreated', ({ roomCode, players }) => {
  State.currentRoomCode = roomCode;
  UI.setView('waiting-view');
  document.getElementById('display-room-code').innerText = roomCode;
  document.getElementById('start-game-btn').classList.remove('hidden');
  UI.renderPlayerList(players);
});

socket.on('playerJoined', (players) => {
  UI.setView('waiting-view');
  document.getElementById('display-room-code').innerText = State.currentRoomCode;
  UI.renderPlayerList(players);
});

socket.on('soalBaru', (data) => {
  UI.setView('game-view');
  document.getElementById('question-number').innerText = `Soal ${data.nomor} dari ${data.totalSoal}`;
  document.getElementById('lyric-prompt').innerText = `"${data.lirik}"`;

  const box = document.getElementById('options-box');
  box.innerHTML = '';
  Object.entries(data.opsi).forEach(([key, value]) => {
    box.innerHTML += `<button class="btn-opsi" onclick="App.submitAnswer('${key}')">${key}. ${value}</button>`;
  });
});

socket.on('updateLeaderboard', (leaderboard) => {
  UI.setView('leaderboard-view');
  document.getElementById('leaderboard-title').innerText = "Papan Peringkat Sementara";
  UI.renderLeaderboard(leaderboard);
});

socket.on('gameFinished', (finalLeaderboard) => {
  UI.setView('leaderboard-view');
  document.getElementById('leaderboard-title').innerText = "🏆 HASIL AKHIR MATCH 🏆";
  UI.renderLeaderboard(finalLeaderboard);
});


socket.on('errorMsg', (msg) => alert(msg));