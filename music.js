// Chiptune arcade music using Web Audio API
const AudioContext = window.AudioContext || window.webkitAudioContext;
let ctx = null;
let musicPlaying = false;
let stopMusic = null;

// Notes: frequency in Hz
const NOTE = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
  G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46,
  G5: 783.99, A5: 880.00, B5: 987.77,
  G3: 196.00, A3: 220.00, B3: 246.94, C3: 130.81,
  _: 0, // rest
};

// Melody: [note, duration in beats]
const MELODY = [
  [NOTE.E5, 0.5], [NOTE.E5, 0.5], [NOTE._, 0.5], [NOTE.E5, 0.5],
  [NOTE._, 0.5],  [NOTE.C5, 0.5], [NOTE.E5, 1],
  [NOTE.G5, 1],   [NOTE._, 1],    [NOTE.G4, 1],   [NOTE._, 1],
  [NOTE.C5, 1],   [NOTE._, 0.5],  [NOTE.G4, 1],   [NOTE._, 0.5],
  [NOTE.E4, 1],   [NOTE._, 0.5],  [NOTE.A4, 1],   [NOTE.B4, 1],
  [NOTE.A4, 0.5], [NOTE.G4, 0.5], [NOTE.B4, 0.5], [NOTE.G5, 0.5],
  [NOTE.A5, 1],   [NOTE.F5, 0.5], [NOTE.G5, 0.5], [NOTE._, 0.5],
  [NOTE.E5, 1],   [NOTE.C5, 0.5], [NOTE.D5, 0.5], [NOTE.B4, 1],
];

// Bass line
const BASS = [
  [NOTE.C3, 1], [NOTE.C3, 1], [NOTE.G3, 1], [NOTE.G3, 1],
  [NOTE.A3, 1], [NOTE.A3, 1], [NOTE.F4 / 2, 1], [NOTE.F4 / 2, 1],
];

function playNote(audioCtx, freq, startTime, duration, gainNode, type = 'square') {
  if (freq === 0) return;
  const osc = audioCtx.createOscillator();
  const env = audioCtx.createGain();
  osc.connect(env);
  env.connect(gainNode);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  env.gain.setValueAtTime(0, startTime);
  env.gain.linearRampToValueAtTime(1, startTime + 0.01);
  env.gain.linearRampToValueAtTime(0, startTime + duration - 0.01);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function scheduleMelody(audioCtx, masterGain, startTime, bps) {
  let t = startTime;
  MELODY.forEach(([freq, beats]) => {
    const dur = beats / bps;
    playNote(audioCtx, freq, t, dur * 0.9, masterGain, 'square');
    t += dur;
  });
  return t; // end time
}

function scheduleBass(audioCtx, masterGain, startTime, bps, totalBeats) {
  let t = startTime;
  let beat = 0;
  while (beat < totalBeats) {
    BASS.forEach(([freq, beats]) => {
      if (beat >= totalBeats) return;
      const dur = beats / bps;
      playNote(audioCtx, freq, t, dur * 0.8, masterGain, 'triangle');
      t += dur;
      beat += beats;
    });
  }
}

function startArcadeMusic() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.18, ctx.currentTime);
  masterGain.connect(ctx.destination);

  const BPS = 8; // beats per second (tempo)
  const totalBeats = MELODY.reduce((s, [, b]) => s + b, 0);

  let loopStart = ctx.currentTime;
  let running = true;

  function scheduleLoop() {
    if (!running) return;
    const loopDuration = totalBeats / BPS;
    scheduleMelody(ctx, masterGain, loopStart, BPS);
    scheduleBass(ctx, masterGain, loopStart, BPS, totalBeats);
    loopStart += loopDuration;
    // Schedule next loop slightly before current one ends
    const scheduleAhead = loopDuration * 1000 - 200;
    setTimeout(() => { if (running) scheduleLoop(); }, scheduleAhead);
  }

  scheduleLoop();

  return function stop() {
    running = false;
    masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
  };
}

// Toggle button
document.getElementById('music-toggle').addEventListener('click', () => {
  const btn = document.getElementById('music-toggle');
  if (musicPlaying) {
    if (stopMusic) stopMusic();
    musicPlaying = false;
    btn.textContent = '♪ Music: OFF';
  } else {
    stopMusic = startArcadeMusic();
    musicPlaying = true;
    btn.textContent = '♪ Music: ON';
  }
});
