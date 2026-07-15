// Тактильная отдача (вибрация) для премиальных микровзаимодействий на телефоне.
// Безопасно игнорируется на устройствах без поддержки Vibration API.
let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

function vibrate(pattern: number | number[]): void {
  if (!enabled) return;
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* некоторые браузеры блокируют без жеста — молча игнорируем */
  }
}

export const haptics = {
  tap: () => vibrate(8),
  play: () => vibrate(12),
  draw: () => vibrate([6, 30, 6]),
  special: () => vibrate([14, 40, 14]),
  penalty: () => vibrate([24, 50, 24, 50, 24]),
  win: () => vibrate([18, 60, 18, 60, 40]),
  lose: () => vibrate([60, 40, 120]),
};
