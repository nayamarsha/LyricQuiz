const gameConfig = require('../../config/game.config');

function calculate(responseTimeMs) {
  // Base score + Bonus kecepatan asinkron dinamis
  const speedBonus = Math.max(0, Math.floor((gameConfig.questionTimeoutMs - responseTimeMs) * 0.005));
  return gameConfig.baseScore + speedBonus;
}

module.exports = { calculate };