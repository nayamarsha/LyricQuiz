// src/services/gameService.js
const db = require('../../database/connection'); // Keluar ke 'src', keluar ke 'root', masuk ke 'database'
const scoreCalculator = require('../utils/scoreCalculator'); // Keluar ke 'src', masuk ke 'utils'
const broadcast = require('../../server/broadcast'); // Keluar ke 'src', keluar ke 'root', masuk ke 'server'
const gameConfig = require('../../config/game.config'); // Keluar ke 'src', keluar ke 'root', masuk ke 'config'

class GameService {
  constructor() {
    this.rooms = {};
  }

  async createRoom(hostId, username, role) {
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    
    // Simulasi penanganan total 5 soal terlepas dari database (Poin 7)
    let questions = [];
    try {
      questions = await db.getQuestions();
    } catch (e) {
      console.log("Database connection error, using mock core setup.");
    }

    // fallback jika data di db kurang dari 5 atau gagal fetch
    if (!questions || questions.length < 5) {
      questions = [
        { lirik: "Aku yang dulu bukanlah yang sekarang...", opsi: { A: "Cinta Satu Malam", B: "Lagu Tegar", C: "Alamat Palsu", D: "Kemesraan" }, jawabanBenar: "B" },
        { lirik: "Hingga tua bersama, menjaga hati ini...", opsi: { A: "Kopi Dangdut", B: "Komang", C: "Kisah Sempurna", D: "Kemesraan" }, jawabanBenar: "B" },
        { lirik: "Ku menangis... membayangkan...", opsi: { A: "Hati-Hati di Jalan", B: "Sang Dewi", C: "Lirik Ratapan", D: "Matahariku" }, jawabanBenar: "C" },
        { lirik: "Begitu syulit lupakan Rehan...", opsi: { A: "Lagu Viral", B: "Cukup Diri Ini", C: "Sial", D: "Gara-Gara Sebotol" }, jawabanBenar: "A" },
        { lirik: "Kau rumahku, tempatku bersandar...", opsi: { A: "Tertawan Hati", B: "Rumah", C: "Rayuan Perempuan Gila", D: "Monokrom" }, jawabanBenar: "B" }
      ];
    }

    // Batasi maksimum hanya sampai 5 soal saja sesuai kriteria poin 7
    questions = questions.slice(0, 5);

    this.rooms[roomCode] = {
      hostId,
      players: {},
      questions,
      currentQuestionIdx: 0,
      status: 'WAITING',
      questionStartTime: null
    };

    // Poin 1 & 3: Menyimpan data berdasarkan Role pilihan
    this.rooms[roomCode].players[hostId] = { username, score: 0, answered: false, role };
    return roomCode;
  }

  joinRoom(roomCode, playerId, username, role) {
    const room = this.rooms[roomCode];
    if (!room || room.status !== 'WAITING') return false;
    room.players[playerId] = { username, score: 0, answered: false, role };
    return true;
  }

  leaveRoom(roomCode, playerId) {
    const room = this.rooms[roomCode];
    if (!room) return null;
    
    delete room.players[playerId];
    
    // Jika room kosong atau host keluar, tutup roomnya
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
    
    // Reset status jawaban pemain. Jika dia adalah penonton, set answered ke true
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

    // Hanya beri nilai jika role-nya adalah Pemain dan benar
    if (player.role === 'Pemain' && jawaban === currentQuestion.jawabanBenar) {
      player.score += scoreCalculator.calculate(responseTime);
    }

    // Evaluasi seluruh pemain aktif (mengabaikan penonton karena sudah otomatis true)
    const allAnswered = Object.values(room.players).every(p => p.answered);
    const sortedLeaderboard = Object.values(room.players).sort((a, b) => b.score - a.score);

    if (allAnswered) {
      broadcast.toRoom(io, roomCode, 'updateLeaderboard', sortedLeaderboard);
      this.handleTransition(io, roomCode);
    } else {
      io.to(playerId).emit('waitingForOthers');
    }
  }

  handleTransition(io, roomCode) {
    const room = this.rooms[roomCode];
    if (!room) return;
    
    if (room.currentQuestionIdx < room.questions.length - 1) {
      room.currentQuestionIdx++;
      const delay = gameConfig.transitionDelayMs || 4000;
      setTimeout(() => this.startNextQuestion(io, roomCode), delay);
    } else {
      room.status = 'FINISHED';
      const finalLeaderboard = Object.values(room.players).sort((a, b) => b.score - a.score);
      broadcast.toRoom(io, roomCode, 'gameFinished', finalLeaderboard);

      finalLeaderboard.forEach(async (p) => {
        if(p.role === 'Pemain') {
            try {
              await db.saveFinalScore(p.username, p.score);
            } catch (err) {
              console.error(`[Error] Gagal mengarsipkan skor ${p.username}:`, err);
            }
        }
      });
    }
  }
}

module.exports = new GameService();