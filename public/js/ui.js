const UI = {
  setView(viewId) {
    ['lobby-view', 'waiting-view', 'game-view', 'leaderboard-view'].forEach(id => {
      document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(viewId).classList.remove('hidden');
  },

  renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = players.map(p => `<div class='row-item'><span>👤 ${p.username}</span><span style='color:#10b981;'>Ready</span></div>`).join('');
  },

  renderLeaderboard(data) {
    const box = document.getElementById('leaderboard-data');
    box.innerHTML = data.map((p, idx) => `
        <div class='row-item'>
            <span><strong>#${idx + 1}</strong> ${p.username}</span>
            <span style='color: #38bdf8;'>${p.score} pts</span>
        </div>
    `).join('');
  }
};