const { io } = require("socket.io-client");

// 1. URL Domain Server Node.js kamu di Railway
const SERVER_URL = "https://lyricquiz-production.up.railway.app/"; 

// 2. PIN Room aktif yang kamu buat sebagai Host di browser
const ROOM_CODE = "ZUTSC"; 

const TOTAL_PLAYERS = 100;
// Array variasi jawaban untuk disimulasikan oleh bot (termasuk string kosong jika kehabisan waktu)
const ANSWER_OPTIONS = ["A", "B", "C", "D", "E", ""]; 

console.log(`[Cloud Simulator] Menghubungkan ${TOTAL_PLAYERS} bot interaktif...`);

for (let i = 1; i <= TOTAL_PLAYERS; i++) {
  setTimeout(() => {
    const socket = io(SERVER_URL, {
      transports: ['websocket']
    });

    socket.on("connect", () => {
      socket.emit("joinRoom", {
        roomCode: ROOM_CODE,
        username: `Test_Bot${i}`,
        role: "Pemain"
      });
    });

    // ==========================================
    // MENANGANI SIMULASI JAWABAN PARALEL
    // ==========================================
    socket.on("soalBaru", (data) => {
      // Pilih variasi jawaban secara acak untuk setiap bot
      const randomIndex = Math.floor(Math.random() * ANSWER_OPTIONS.length);
      const jawabanBot = ANSWER_OPTIONS[randomIndex];

      // Beri jeda acak antara 1 sampai 5 detik seolah-olah bot sedang "berpikir" dan mengklik tombol
      const waktuBerpikirMs = Math.floor(Math.random() * 4000) + 1000;

      setTimeout(() => {
        // Kirim jawaban secara asinkron ke server Railway
        socket.emit("submitAnswer", {
          roomCode: ROOM_CODE,
          jawaban: jawabanBot
        });
      }, waktuBerpikirMs);
    });

    socket.on("connect_error", (err) => {
      console.error(`[Gagal] Bot_${i}: ${err.message}`);
    });

  }, i * 100); 
}