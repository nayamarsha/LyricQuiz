const UI = {
  modeLobby: '', 

  setView(viewId) {
    ['lobby-view', 'waiting-view', 'game-view', 'leaderboard-view'].forEach(id => {
      document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(viewId).classList.remove('hidden');
  },

  showLobbyForm(mode) {
    this.modeLobby = mode;
    document.getElementById('menu-utama').classList.add('hidden');
    document.getElementById('form-container').classList.remove('hidden');

    const joinFields = document.getElementById('join-fields');
    const submitBtn = document.getElementById('btn-submit-action');

    if (mode === 'create') {
      joinFields.classList.add('hidden');
      submitBtn.innerText = "Buat Room & Masuk 🚀";
      submitBtn.style.background = "#ec4899";
    } else if (mode === 'join') {
      joinFields.classList.remove('hidden');
      submitBtn.innerText = "Gabung Match 🔌";
      submitBtn.style.background = "#2563eb";
    }
  },

  resetLobbyMenu() {
    this.modeLobby = '';
    document.getElementById('menu-utama').classList.remove('hidden');
    document.getElementById('form-container').classList.add('hidden');
    document.getElementById('username').value = '';
    document.getElementById('room-code-input').value = '';
  },

  renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = players.map(p => {
      const isSelf = p.username === State.username;
      const highlightClass = isSelf ? 'highlight-user' : '';
      
      return `
        <div class='row-item ${highlightClass}'>
            <span>👤 ${p.username}</span>
            <span style='color:#10b981;'>Ready</span>
        </div>`;
    }).join('');
  },

  // Poin 3: Modifikasi tampilan data leaderboard akhir untuk menyisipkan summary benar/salah
  renderLeaderboard(data, isFinal = false) {
    const box = document.getElementById('leaderboard-data');
    box.innerHTML = data.map((p, idx) => {
      const isSelf = p.username === State.username;
      const highlightClass = isSelf ? 'highlight-user' : '';
      
      // Jika leaderboard akhir, cetak string summary stat jawaban
      const statsHtml = isFinal 
        ? `<span class="badge-stats">✅ Benar: ${p.benar || 0} | ❌ Salah: ${p.salah || 0}</span>` 
        : '';

      return `
        <div class='row-item ${highlightClass}'>
            <div>
                <span><strong>#${idx + 1}</strong> ${p.username}</span>
                ${statsHtml}
            </div>
            <span style='color: #38bdf8; font-weight: bold;'>${p.score} pts</span>
        </div>
    `;
    }).join('');
  }
};