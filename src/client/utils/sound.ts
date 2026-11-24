/**
 * Procedural sound effects with the Web Audio API. Zero audio files.
 * The context is created lazily on the first user gesture.
 */

const MUTE_KEY = 'pakia:muted';

let ctx: AudioContext | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export const isMuted = (): boolean => muted;

export const setMuted = (value: boolean): void => {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // Storage can be unavailable in private mode; the toggle still works for this session.
  }
};

const audio = (): AudioContext | null => {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
};

type ToneOptions = {
  freq: number;
  to?: number;
  type?: OscillatorType;
  duration: number;
  volume?: number;
  delay?: number;
};

const tone = ({
  freq,
  to,
  type = 'sine',
  duration,
  volume = 0.18,
  delay = 0,
}: ToneOptions): void => {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
};

/** Short filtered noise burst: the rustle of a paper bag. */
const rustle = (duration = 0.09, volume = 0.22, delay = 0): void => {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + delay;
  const frames = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++)
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
  const source = ac.createBufferSource();
  source.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  filter.Q.value = 0.7;
  const gain = ac.createGain();
  gain.gain.value = volume;
  source.connect(filter).connect(gain).connect(ac.destination);
  source.start(start);
};

const buzz = (ms: number): void => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Vibration is optional.
  }
};

export const sfx = {
  pick: () => tone({ freq: 520, to: 780, duration: 0.07, volume: 0.12 }),
  place: () => {
    rustle(0.1, 0.25);
    tone({
      freq: 180,
      to: 110,
      type: 'triangle',
      duration: 0.12,
      volume: 0.22,
    });
    buzz(8);
  },
  rotate: () =>
    tone({
      freq: 900,
      to: 1200,
      type: 'triangle',
      duration: 0.04,
      volume: 0.1,
    }),
  invalid: () => {
    tone({ freq: 150, type: 'square', duration: 0.12, volume: 0.06 });
    buzz(30);
  },
  conflict: () => {
    tone({
      freq: 440,
      to: 330,
      type: 'triangle',
      duration: 0.12,
      volume: 0.12,
    });
    tone({
      freq: 330,
      to: 250,
      type: 'triangle',
      duration: 0.14,
      volume: 0.1,
      delay: 0.1,
    });
  },
  lift: () => rustle(0.06, 0.15),
  tap: () => tone({ freq: 700, duration: 0.03, volume: 0.08 }),
  win: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) =>
      tone({
        freq,
        type: 'triangle',
        duration: 0.22,
        volume: 0.16,
        delay: i * 0.09,
      })
    );
  },
  stamp: () => {
    tone({ freq: 120, to: 50, type: 'sine', duration: 0.25, volume: 0.4 });
    rustle(0.15, 0.35);
    buzz(40);
  },
};
