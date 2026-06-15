// Звуковая архитектура. Звуки синтезируются через WebAudio, поэтому
// внешние файлы не нужны — но при желании их легко подменить на семплы.
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.08): void {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, ac.currentTime);
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  osc.connect(g).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duration + 0.02);
}

function sequence(notes: Array<[number, number]>, type: OscillatorType = 'triangle'): void {
  let t = 0;
  for (const [freq, dur] of notes) {
    window.setTimeout(() => tone(freq, dur, type), t * 1000);
    t += dur;
  }
}

export function playCardSound(): void {
  tone(440, 0.08, 'triangle', 0.06);
}

export function drawCardSound(): void {
  tone(220, 0.12, 'sawtooth', 0.05);
}

export function specialSound(): void {
  sequence([[523, 0.08], [659, 0.1]], 'triangle');
}

export function penaltySound(): void {
  sequence([[300, 0.1], [200, 0.16]], 'sawtooth');
}

export function winSound(): void {
  sequence([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.22]], 'triangle');
}

export function loseSound(): void {
  sequence([[392, 0.16], [311, 0.16], [233, 0.3]], 'sine');
}
