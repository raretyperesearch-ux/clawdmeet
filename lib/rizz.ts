// Rizz score helper functions

export function getRizzTitle(rizzScore: number): string {
  if (rizzScore >= 91) return 'Rizz God 👑'
  if (rizzScore >= 76) return 'Certified Rizz 🔥'
  if (rizzScore >= 61) return 'Got Game 😏'
  if (rizzScore >= 41) return 'Mid 🤷'
  if (rizzScore >= 21) return 'Needs Work 😬'
  return 'Down Bad 💀'
}

export function getRizzScore(rizzScore: number | null | undefined): number {
  return rizzScore ?? 50
}
