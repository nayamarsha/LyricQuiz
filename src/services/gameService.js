// src/services/gameService.js
const db = require('../../database/connection');
const scoreCalculator = require('../utils/scoreCalculator');
const broadcast = require('../../server/broadcast');
const gameConfig = require('../../config/game.config');

class GameService {
  constructor() {
    this.rooms = {};
  }

  async createRoom(hostId, username) {
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    const questions = await db.getQuestions();
    this.rooms[roomCode] = {
      hostId,
      players: {},
      questions,
      currentQuestionIdx: 0,
      status: 'WAITING',
      questionStartTime: null
    };
    this.rooms[roomCode].players[hostId] = { username, score: 0, answered: false };
    return roomCode;
  }

  joinRoom(roomCode, playerId, username) {
    const room = this.rooms[roomCode];
    if (!room || room.status !== 'WAITING') return false;
    room.players[playerId] = { username, score: 0, answered: false };
    return true;
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
    // Reset status jawaban setiap pemain untuk sesi soal baru
    Object.keys(room.players).forEach(id => room.players[id].answered = false);

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

    if (jawaban === currentQuestion.jawabanBenar) {
      player.score += scoreCalculator.calculate(responseTime);
    }

    // Evaluasi apakah seluruh simpul client yang terhubung sudah mengirim jawaban
    const allAnswered = Object.values(room.players).every(p => p.answered);
    const sortedLeaderboard = Object.values(room.players).sort((a, b) => b.score - a.score);

    if (allAnswered) {
      // PUSH BROADCAST: Kirim leaderboard hanya saat SEMUA pemain selesai menjawab soal ini
      broadcast.toRoom(io, roomCode, 'updateLeaderboard', sortedLeaderboard);
      this.handleTransition(io, roomCode);
    } else {
      // Jika belum semua menjawab, beri tahu client yang bersangkutan bahwa jawabannya telah diterima
      io.to(playerId).emit('waitingForOthers');
    }
  }

  handleTransition(io, roomCode) {
    const room = this.rooms[roomCode];
    
    if (room.currentQuestionIdx < room.questions.length - 1) {
      room.currentQuestionIdx++;
      // Memberikan jeda waktu evaluasi leaderboard sebelum otomatis ke soal berikutnya
      setTimeout(() => this.startNextQuestion(io, roomCode), gameConfig.transitionDelayMs);
    } else {
      room.status = 'FINISHED';
      const finalLeaderboard = Object.values(room.players).sort((a, b) => b.score - a.score);
      broadcast.toRoom(io, roomCode, 'gameFinished', finalLeaderboard);

      // Async Non-Blocking Task: Pipeline penyimpanan arsip skor ke MySQL Database
      finalLeaderboard.forEach(async (p) => {
        try {
          await db.saveFinalScore(p.username, p.score);
        } catch (err) {
          console.error(`[Error] Gagal mengarsipkan skor ${p.username}:`, err);
        }
      });
    }
  }
}

module.exports = new GameService();