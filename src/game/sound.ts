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
  // Soft card thud with harmonic
  tone(520, 0.06, 'sine', 0.07);
  window.setTimeout(() => tone(260, 0.1, 'sine', 0.04), 15);
}

export function drawCardSound(): void {
  // Paper rustle using noise + filter via 2 detuned saws
  tone(180, 0.14, 'sawtooth', 0.04);
  window.setTimeout(() => tone(185, 0.1, 'sawtooth', 0.025), 10);
}

export function specialSound(): void {
  // Warm bell-like tone with overtone
  sequence([[659, 0.14], [880, 0.18]], 'sine');
}

export function penaltySound(): void {
  // Low drop
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.22);
  g.gain.setValueAtTime(0, ac.currentTime);
  g.gain.linearRampToValueAtTime(0.12, ac.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.25);
  osc.connect(g).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.28);
}

export function winSound(): void {
  // C major arpeggio — C5 E5 G5 C6
  sequence([[523, 0.14], [659, 0.14], [784, 0.14], [1047, 0.28]], 'sine');
}

export function loseSound(): void {
  // Descending minor
  sequence([[392, 0.18], [349, 0.18], [294, 0.22], [233, 0.32]], 'sine');
}
