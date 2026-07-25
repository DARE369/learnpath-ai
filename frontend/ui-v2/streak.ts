export function streakTierMessage(days: number): string {
  if (days <= 0) return "Start learning today to begin your streak.";
  if (days < 3) return "Building the habit. Keep going!";
  if (days < 7) return "Momentum building! You're on a roll 🔥";
  if (days < 30) return "Consistent learner! Keep the fire burning 🔥🔥";
  return "Unstoppable! Legendary commitment 🔥🔥🔥";
}
