const socket = io();
let timerInterval = null;

const App = {
  submitLobbyForm() {
    const name = document.getElementById('username').value.trim();
    if (!name) return alert("Username tidak boleh kosong!");
    
    State.username = name;
    State.role = 'Pemain'; // Otomatis diset sebagai pemain aktif

    if (UI.modeLobby === 'create') {
      State.isHost = true;
      socket.emit('createRoom', { username: name, role: 'Pemain' });
    } else if (UI.modeLobby === 'join') {
      const code = document.getElementById('room-code-input').value.trim().toUpperCase();
      if (!code) return alert("Masukkan Kode PIN Room terlebih dahulu!");
      State.currentRoomCode = code;
      socket.emit('joinRoom', { roomCode: code, username: name, role: 'Pemain' });
    }
  },

  startGame() {
    socket.emit('startGame', { roomCode: State.currentRoomCode });
  },

  submitAnswer(key) {
    clearInterval(timerInterval);
    socket.emit('submitAnswer', { roomCode: State.currentRoomCode, jawaban: key });
    
    const buttons = document.querySelectorAll('.btn-opsi');
    buttons.forEach(btn => {
      btn.disabled = true;
      if (btn.getAttribute('data-key') === key) {
        btn.classList.add('terpilih');
      }
    });
  },

  exitGame() {
    clearInterval(timerInterval);
    socket.emit('leaveRoom', { roomCode: State.currentRoomCode });
    State.currentRoomCode = '';
    State.isHost = false;
    document.getElementById('exit-game-btn').classList.add('hidden');
    UI.resetLobbyMenu();
    UI.setView('lobby-view');
  },

  startCountdown(seconds) {
    clearInterval(timerInterval);
    const display = document.getElementById('timer-countdown');
    display.innerText = seconds;

    timerInterval = setInterval(() => {
      seconds--;
      display.innerText = seconds;
      if (seconds <= 0) {
        clearInterval(timerInterval);
        App.submitAnswer('');
      }
    }, 1000);
  }
};

// Stream Receiver Events
socket.on('roomCreated', ({ roomCode, players }) => {
  State.currentRoomCode = roomCode;
  UI.setView('waiting-view');
  document.getElementById('display-room-code').innerText = roomCode;
  
  if (State.isHost) {
    document.getElementById('start-game-btn').classList.remove('hidden');
  } else {
    document.getElementById('start-game-btn').classList.add('hidden');
  }
  UI.renderPlayerList(players);
});

socket.on('roomUpdated', ({ players }) => {
  UI.setView('waiting-view');
  document.getElementById('display-room-code').innerText = State.currentRoomCode;
  if (State.isHost) {
    document.getElementById('start-game-btn').classList.remove('hidden');
  }
  UI.renderPlayerList(players);
});

socket.on('soalBaru', (data) => {
  UI.setView('game-view');
  document.getElementById('question-number').innerText = `Soal ${data.nomor} dari ${data.totalSoal}`;
  document.getElementById('lyric-prompt').innerText = `"${data.lirik}"`;

  const box = document.getElementById('options-box');
  box.innerHTML = '';

  Object.entries(data.opsi).forEach(([key, value]) => {
    box.innerHTML += `<button class="btn-opsi" data-key="${key}" onclick="App.submitAnswer('${key}')">${key}. ${value}</button>`;
  });

  App.startCountdown(15);
});

socket.on('updateLeaderboard', (leaderboard) => {
  clearInterval(timerInterval);
  UI.setView('leaderboard-view');
  document.getElementById('leaderboard-title').innerText = "Papan Peringkat Sementara";
  document.getElementById('exit-game-btn').classList.add('hidden');
  UI.renderLeaderboard(leaderboard);
});

socket.on('gameFinished', (finalLeaderboard) => {
  clearInterval(timerInterval);
  UI.setView('leaderboard-view');
  document.getElementById('leaderboard-title').innerText = "🏆 HASIL AKHIR MATCH 🏆";
  document.getElementById('exit-game-btn').classList.remove('hidden');
  UI.renderLeaderboard(finalLeaderboard);
});

socket.on('roomLeft', () => {
  State.currentRoomCode = '';
  State.isHost = false;
  document.getElementById('exit-game-btn').classList.add('hidden');
  UI.resetLobbyMenu();
  UI.setView('lobby-view');
});

socket.on('errorMsg', (msg) => alert(msg));