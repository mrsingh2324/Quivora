function calculateAnswerPoints({
  isCorrect,
  responseTimeMs = null,
  timeLimitSeconds = 30,
  streakCount = 0,
}) {
  if (!isCorrect) return { points: 0, speedBonus: 0, streakBonus: 0 };

  const basePoints = 100;
  const limitMs = Math.max(1, Number(timeLimitSeconds) || 30) * 1000;
  const elapsedMs =
    responseTimeMs === null || responseTimeMs === undefined
      ? limitMs
      : Math.max(0, Math.min(limitMs, Number(responseTimeMs)));
  const remainingRatio = Math.max(0, (limitMs - elapsedMs) / limitMs);
  const speedBonus = Math.round(basePoints * 0.5 * remainingRatio);
  const streakBonus = Math.round(basePoints * Math.min(0.5, Math.max(0, streakCount) * 0.1));

  return {
    points: basePoints + speedBonus + streakBonus,
    speedBonus,
    streakBonus,
  };
}

function calculateTotalScore(answers) {
  return answers.reduce((total, answer) => {
    if (typeof answer.points === "number") return total + answer.points;
    return total + (answer.isCorrect ? 100 : 0);
  }, 0);
}

function calculateCurrentStreak(answers) {
  let streak = 0;
  for (let index = answers.length - 1; index >= 0; index -= 1) {
    if (!answers[index].isCorrect) break;
    streak += 1;
  }
  return streak;
}

module.exports = {
  calculateAnswerPoints,
  calculateCurrentStreak,
  calculateTotalScore,
};
