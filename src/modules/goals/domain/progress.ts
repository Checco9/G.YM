export type GoalProgress = { percent: number; achieved: boolean };

/**
 * Percentuale di completamento tra valore iniziale e target.
 * Vale sia per obiettivi in salita (60 kg di panca) sia in discesa (arrivare a 80 kg di peso).
 */
export function goalProgress(start: number, current: number, target: number): GoalProgress {
  if (target === start) return { percent: current === target ? 100 : 0, achieved: current === target };
  const raw = ((current - start) / (target - start)) * 100;
  const percent = Math.max(0, Math.min(100, Math.round(raw)));
  const achieved = target > start ? current >= target : current <= target;
  return { percent: achieved ? 100 : percent, achieved };
}
