const socket = io();
let timerInterval = null;

// Tambahkan sub-state lokal untuk menampung key pilihan sementara
State.jawabanSaya = ''; 
State.gameStarted = false;

const App = {
  submitLobbyForm() {
    const name = document.getElementById('username').value.trim();
    if (!name) return alert("Username tidak boleh kosong!");
    
    State.username = name;
    State.role = 'Pemain';

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
    State.jawabanSaya = key; // Catat pilihan client
    
    socket.emit('submitAnswer', { roomCode: State.currentRoomCode, jawaban: key });
    
    // Poin 1: Saat diklik nunggu timer, beri style Putih teks Hitam (.state-menunggu)
    const buttons = document.querySelectorAll('.btn-opsi');
    buttons.forEach(btn => {
      btn.disabled = true; // Kunci input tombol
      if (btn.getAttribute('data-key') === key) {
        btn.classList.add('state-menunggu');
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
        App.submitAnswer(''); // Otomatis kirim string kosong jika kehabisan waktu
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
  if (!State.currentRoomCode) return; 
  if(State.gameStarted) return; 
  UI.setView('waiting-view');
  document.getElementById('display-room-code').innerText = State.currentRoomCode;
  if (State.isHost) {
    document.getElementById('start-game-btn').classList.remove('hidden');
  }
  UI.renderPlayerList(players);
});

socket.on('soalBaru', (data) => {
  State.gameStarted = true;
  State.jawabanSaya = ''; // Reset pilihan di soal baru
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

// Poin 2: Event Baru Evaluasi Perubahan Warna Opsi (Ijo / Merah) sebelum ganti view leaderboard
socket.on('revealJawaban', ({ jawabanBenar }) => {
  clearInterval(timerInterval);
  const buttons = document.querySelectorAll('.btn-opsi');
  
  buttons.forEach(btn => {
    btn.disabled = true;
    const keyTombol = btn.getAttribute('data-key');
    
    // Hapus dulu class tunggu putih-hitam
    btn.classList.remove('state-menunggu');

    if (keyTombol === jawabanBenar) {
      // Jawaban yang benar otomatis dapet warna Ijo
      btn.classList.add('jawaban-benar');
    } else if (keyTombol === State.jawabanSaya && State.jawabanSaya !== jawabanBenar) {
      // Jika ini tombol yang dipilih user dan ternyata salah, beri warna Merah
      btn.classList.add('jawaban-salah');
    }
  });
});

socket.on('updateLeaderboard', (leaderboard) => {
  clearInterval(timerInterval);
  UI.setView('leaderboard-view');
  document.getElementById('leaderboard-title').innerText = "Papan Peringkat Sementara";
  document.getElementById('exit-game-btn').classList.add('hidden');
  UI.renderLeaderboard(leaderboard, false); // false = jangan munculkan statistik ringkasan dulu
});

socket.on('gameFinished', (finalLeaderboard) => {
  State.gameStarted = false;
  clearInterval(timerInterval);
  UI.setView('leaderboard-view');
  document.getElementById('leaderboard-title').innerText = "🏆 HASIL AKHIR MATCH 🏆";
  document.getElementById('exit-game-btn').classList.remove('hidden');
  UI.renderLeaderboard(finalLeaderboard, true); // true = tampilkan ringkasan jumlah jawaban Benar & Salah
});

socket.on('roomLeft', () => {
  State.gameStarted = false;
  State.currentRoomCode = '';
  State.isHost = false;
  document.getElementById('exit-game-btn').classList.add('hidden');
  UI.resetLobbyMenu();
  UI.setView('lobby-view');
});

socket.on('errorMsg', (msg) => alert(msg));