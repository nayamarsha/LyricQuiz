const db = require('../../database/connection');
const scoreCalculator = require('../utils/scoreCalculator');
const broadcast = require('../../server/broadcast');
const gameConfig = require('../../config/game.config');

class GameService {
  constructor() {
    this.rooms = {};
  }

  async createRoom(hostId, username, role) {
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    
    let questions = [];
    try {
      questions = await db.getQuestions();
    } catch (e) {
      console.log("Database connection error, using mock core setup.");
    }

    if (!questions || questions.length < 5) {
      questions = [
  {
    lirik: "Tak ingin usai, cahaya mu temani hariku. Walau semua telah berlalu, ku tak mampu melupakanmu...",
    opsi: {
      A: "Tak Ingin Usai - Keisya Levronka",
      B: "Komang - Raim Laode",
      C: "Sial - Mahalini",
      D: "Tak Segampang Itu - Anggi Marito"
    },
    jawabanBenar: "A"
  },
  {
    lirik: "Sebab kau terlalu indah dari sekadar kata, dunia berhenti sejenak menikmati indahmu...",
    opsi: {
      A: "Komang - Raim Laode",
      B: "Sisa Rasa - Mahalini",
      C: "Hati-Hati di Jalan - Tulus",
      D: "Rumah ke Rumah - Hindia"
    },
    jawabanBenar: "A"
  },
  {
    lirik: "Perjalanan membawamu bertemu denganku, ku bertemu kamu. Sepertimu yang kucari, konon aku juga seperti yang kaucari...",
    opsi: {
      A: "Hati-Hati di Jalan - Tulus",
      B: "Bertaut - Nadin Amizah",
      C: "Monokrom - Tulus",
      D: "Evaluasi - Hindia"
    },
    jawabanBenar: "A"
  },
  {
    lirik: "Memang tidak mudah, tapi ku sudah terbiasa. Sendiri menjalani hari tanpa dirimu lagi...",
    opsi: {
      A: "Sial - Mahalini",
      B: "Tak Segampang Itu - Anggi Marito",
      C: "Pesan Terakhir - Lyodra",
      D: "Bawa Dia Kembali - Mahalini"
    },
    jawabanBenar: "B"
  },
  {
    lirik: "Semua yang sirna kan kembali lagi, semua yang sempat hilang akan datang menghampiri...",
    opsi: {
      A: "Bertaut - Nadin Amizah",
      B: "Rayuan Perempuan Gila - Nadin Amizah",
      C: "Tak Ingin Usai - Keisya Levronka",
      D: "Sisa Rasa - Mahalini"
    },
    jawabanBenar: "B"
  }
]
    }

    questions = questions.slice(0, 5);

    this.rooms[roomCode] = {
      hostId,
      players: {},
      questions,
      currentQuestionIdx: 0,
      status: 'WAITING',
      questionStartTime: null
    };

    // Ditambahkan tracker benar & salah
    this.rooms[roomCode].players[hostId] = { username, score: 0, answered: false, role, benar: 0, salah: 0 };
    return roomCode;
  }

  joinRoom(roomCode, playerId, username, role) {
    const room = this.rooms[roomCode];
    if (!room || room.status !== 'WAITING') return false;
    // Ditambahkan tracker benar & salah
    room.players[playerId] = { username, score: 0, answered: false, role, benar: 0, salah: 0 };
    return true;
  }

  leaveRoom(roomCode, playerId) {
    const room = this.rooms[roomCode];
    if (!room) return null;
    
    delete room.players[playerId];
    if (Object.keys(room.players).length === 0 || room.hostId === playerId) {
      delete this.rooms[roomCode];
      return { destroyed: true };
    }
    return { destroyed: false, remainingPlayers: Object.values(room.players) };
  }

  getPlayers(roomCode) {
    return Object.values(this.rooms[roomCode]?.players || {});
  }

  isHost(roomCode, playerId) {
    return this.rooms[roomCode]?.hostId === playerId;
  }

  startNextQuestion(io, roomCode) {
    const room = this.rooms[roomCode];
    if (!room) return;

    room.status = 'PLAYING';
    Object.keys(room.players).forEach(id => {
      room.players[id].answered = (room.players[id].role === 'Penonton');
    });

    const question = room.questions[room.currentQuestionIdx];
    room.questionStartTime = Date.now();

    broadcast.toRoom(io, roomCode, 'soalBaru', {
      nomor: room.currentQuestionIdx + 1,
      totalSoal: room.questions.length,
      lirik: question.lirik,
      opsi: question.opsi
    });
  }

  async processAnswer(io, roomCode, playerId, jawaban) {
    const room = this.rooms[roomCode];
    if (!room || room.status !== 'PLAYING') return;

    const player = room.players[playerId];
    if (!player || player.answered) return;

    player.answered = true;
    const currentQuestion = room.questions[room.currentQuestionIdx];
    const responseTime = Date.now() - room.questionStartTime;

    // Hitung statistik performa jawaban (Poin 3)
    if (player.role === 'Pemain') {
      if (jawaban === currentQuestion.jawabanBenar) {
        player.score += scoreCalculator.calculate(responseTime);
        player.benar += 1;
      } else {
        player.salah += 1;
      }
    }

    const allAnswered = Object.values(room.players).every(p => p.answered);
    const sortedLeaderboard = Object.values(room.players).sort((a, b) => b.score - a.score);

    if (allAnswered) {
      // Poin 2: Kirim kunci jawaban benar ke klien agar warna opsi bisa dievaluasi sebelum pindah layar
      broadcast.toRoom(io, roomCode, 'revealJawaban', {
        jawabanBenar: currentQuestion.jawabanBenar,
        leaderboard: sortedLeaderboard
      });
      
      // Berikan jeda waktu 3 detik bagi user untuk melihat hasil warnanya, baru transisi ke Papan Skor
      setTimeout(() => {
        broadcast.toRoom(io, roomCode, 'updateLeaderboard', sortedLeaderboard);
        this.handleTransition(io, roomCode);
      }, 3000);

    } else {
      io.to(playerId).emit('waitingForOthers');
    }
  }

  handleTransition(io, roomCode) {
    const room = this.rooms[roomCode];
    if (!room) return;
    
    if (room.currentQuestionIdx < room.questions.length - 1) {
      room.currentQuestionIdx++;
      const delay = gameConfig.transitionDelayMs || 4000; // Delay jeda layar leaderboard sebelum soal berikutnya
      setTimeout(() => this.startNextQuestion(io, roomCode), delay);
    } else {
      room.status = 'FINISHED';
      const finalLeaderboard = Object.values(room.players).sort((a, b) => b.score - a.score);
      broadcast.toRoom(io, roomCode, 'gameFinished', finalLeaderboard);
    }
  }

  async runPerformanceBenchmark() {
    const { performance } = require('perf_hooks');
    const db = require('../../database/connection');

    // 1. Pengujian Pendekatan Asynchronous (Bawaan Driver MySQL Promise)
    const startAsync = performance.now();
    // Mengambil data soal dari database secara asinkron beberapa kali untuk beban stress-test
    for (let i = 0; i < 50; i++) {
      await db.getQuestions();
    }
    const endAsync = performance.now();
    const execTimeAsync = (endAsync - startAsync) / 1000; // Konversi ke detik

    // 2. Pengujian Pendekatan Sequential (Blocking Logika Simulasi)
    const startSeq = performance.now();
    for (let i = 0; i < 50; i++) {
      // Mensimulasikan blocking thread sequential dengan synchronous loop berat sebelum query selesai
      let totalHeavyCompute = 0;
      for (let j = 0; j < 5e6; j++) { totalHeavyCompute += j; }
      await db.getQuestions();
    }
    const endSeq = performance.now();
    const execTimeSeq = (endSeq - startSeq) / 1000; // Konversi ke detik

    // 3. Menghitung Nilai Speedup & Throughput
    const speedup = execTimeSeq / (execTimeAsync || 0.001);
    const totalTugas = 50; // Jumlah pemanggilan query
    const throughputSeq = totalTugas / execTimeSeq;
    const throughputAsync = totalTugas / execTimeAsync;

    return {
      executionTime: {
        sequential: execTimeSeq.toFixed(4) + " detik",
        async: execTimeAsync.toFixed(4) + " detik"
      },
      speedup: speedup.toFixed(2) + "x lebih cepat",
      throughput: {
        sequential: throughputSeq.toFixed(2) + " req/detik",
        async: throughputAsync.toFixed(2) + " req/detik"
      }
    };
  }
}

module.exports = new GameService();