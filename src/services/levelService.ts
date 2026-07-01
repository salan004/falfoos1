export function calculateLevel(points: number): number {
  let level = 1;
  while (points >= level * level * 50) {
    level++;
  }
  return Math.max(1, level - 1);
}

export function getNextLevelPoints(currentLevel: number): number {
  return currentLevel * currentLevel * 50;
}

export function checkLevelUp(currentLevel: number, totalPoints: number): boolean {
  const nextLevel = calculateLevel(totalPoints);
  return nextLevel > currentLevel;
}
