(() => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let ctx, masterGain, playing = false, loopTimeout = null;

  const BPM = 158;
  const B = 60 / BPM; // seconds per beat (quarter note)

  // Convert note name + octave to frequency
  function hz(name, oct) {
    const map = { C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11 };
    if (!(name in map)) return 0;
    return 440 * Math.pow(2, (map[name] + (oct - 4) * 12 - 9) / 12);
  }

  // --- Lead melody (Super Mario Bros theme) ---
  // [beat_offset, note, octave, duration_beats, volume]
  const LEAD = [
    [0,'E',5,.5,1],[.5,'E',5,.5,1],[1.5,'E',5,.5,1],
    [2,'C',5,.5,1],[2.5,'E',5,1,1],[3.5,'G',5,1,1],
    [5,'G',4,1,.8],
    [8,'C',5,1.5,1],[9.5,'G',4,1,.8],[11,'E',4,1.5,.8],
    [12,'A',4,1,.9],[13,'B',4,1,.9],[14,'Bb',4,.5,.8],[14.5,'A',4,1,.9],
    [16,'G',4,.67,.8],[16.67,'E',5,.67,1],[17.33,'G',5,.67,1],
    [18,'A',5,1,1],[19,'F',5,.5,.9],[19.5,'G',5,.5,.9],
    [20,'E',5,1,1],[21,'C',5,.5,.9],[21.5,'D',5,.5,.9],[22,'B',4,1.5,.9],
    [24,'G',5,.5,1],[24.5,'F#',5,.5,1],[25,'E',5,1,1],
    [26,'C',5,.5,.9],[26.5,'D',5,.5,.9],[27,'B',4,1,.9],
    [28,'G',4,.5,.8],[28.5,'G',4,.5,.8],[29,'G',4,1,.8],
    [30,'C',5,2,1],
  ];

  // --- Arpeggio channel (16th notes, 4 chords cycling) ---
  const ARP_CHORDS = [
    ['C','E','G','C'], // C maj
    ['G','B','D','G'], // G maj
    ['A','C','E','A'], // A min
    ['F','A','C','F'], // F maj
  ];

  // --- Drums ---
  // Patterns on 16th-note grid (16 slots = 1 bar of 4/4)
  const KICK  = [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0];
  const SNARE = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0];
  const HAT   = [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0];
  const HAT_O = [0,0,0,1, 0,0,0,1, 0,0,0,1, 0,0,0,1]; // open hat offbeat

  // --- Oscillator helper ---
  function schedOsc(freq, type, start, dur, vol) {
    if (!freq) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(vol, start + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(dur, 0.02));
    osc.connect(env); env.connect(masterGain);
    osc.start(start); osc.stop(start + dur + 0.02);
  }

  // Add a light chorus/detune effect to the lead
  function schedLead(freq, start, dur, vol) {
    if (!freq) return;
    [-4, 0, 4].forEach(detune => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(vol / 3, start + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(dur, 0.02));
      osc.connect(env); env.connect(masterGain);
      osc.start(start); osc.stop(start + dur + 0.02);
    });
  }

  function playKick(time) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(170, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.13);
    env.gain.setValueAtTime(0.9, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
    osc.connect(env); env.connect(masterGain);
    osc.start(time); osc.stop(time + 0.2);
  }

  function playSnare(time) {
    const len = Math.floor(ctx.sampleRate * 0.14);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    const bp  = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = buf;
    bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 1.0;
    env.gain.setValueAtTime(0.6, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.13);
    src.connect(bp); bp.connect(env); env.connect(masterGain);
    src.start(time);
  }

  function playHat(time, vol, open) {
    const dur = open ? 0.09 : 0.035;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    const hp  = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = buf;
    hp.type = 'highpass'; hp.frequency.value = 9500;
    env.gain.setValueAtTime(vol, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(hp); hp.connect(env); env.connect(masterGain);
    src.start(time);
  }

  function scheduleLoop(startTime) {
    if (!playing) return;

    const TOTAL_BEATS = 32; // 8 bars
    const SIXTEENTH = B * 0.25;

    // --- Lead melody ---
    LEAD.forEach(([tb, name, oct, dur, vol]) => {
      schedLead(hz(name, oct), startTime + tb * B, dur * B * 0.88, vol * 0.28);
    });

    // --- Bass: root + fifth per bar ---
    const ROOTS   = ['C','G','A','F', 'C','G','A','F'];
    const FIFTHS  = {C:'G', G:'D', A:'E', F:'C'};
    ROOTS.forEach((root, bar) => {
      const t = startTime + bar * 4 * B;
      schedOsc(hz(root, 2), 'sawtooth', t,          B * 0.75, 0.18);
      schedOsc(hz(root, 3), 'triangle', t,          B * 0.75, 0.22);
      schedOsc(hz(FIFTHS[root], 3), 'triangle', t + B,      B * 0.75, 0.16);
      schedOsc(hz(root, 3), 'triangle', t + B * 2,  B * 0.75, 0.2);
      schedOsc(hz(FIFTHS[root], 3), 'triangle', t + B * 3, B * 0.75, 0.16);
    });

    // --- Arpeggio: 16th notes ---
    for (let bar = 0; bar < 8; bar++) {
      const chord = ARP_CHORDS[bar % 4];
      for (let i = 0; i < 16; i++) {
        const oct = i < 8 ? 4 : 5;
        const f = hz(chord[i % 4], oct);
        const t = startTime + (bar * 4 + i * 0.25) * B;
        schedOsc(f, 'square', t, SIXTEENTH * 0.7, 0.055);
      }
    }

    // --- Drums: 128 sixteenth notes (8 bars) ---
    const totalSixteenths = TOTAL_BEATS * 4;
    for (let i = 0; i < totalSixteenths; i++) {
      const t = startTime + i * SIXTEENTH;
      const slot = i % 16;
      if (KICK[slot])  playKick(t);
      if (SNARE[slot]) playSnare(t);
      if (HAT[slot])   playHat(t, 0.13, false);
      if (HAT_O[slot]) playHat(t, 0.09, true);
    }

    // Reschedule next loop ~250ms before end
    const loopMs = (TOTAL_BEATS * B) * 1000;
    loopTimeout = setTimeout(
      () => scheduleLoop(startTime + TOTAL_BEATS * B),
      loopMs - 250
    );
  }

  function start() {
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.65;
    masterGain.connect(ctx.destination);
    playing = true;
    scheduleLoop(ctx.currentTime + 0.05);
  }

  function stop() {
    playing = false;
    clearTimeout(loopTimeout);
    if (masterGain) {
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
      setTimeout(() => { masterGain.disconnect(); masterGain = null; }, 350);
    }
  }

  document.getElementById('music-toggle').addEventListener('click', () => {
    const btn = document.getElementById('music-toggle');
    if (playing) {
      stop();
      btn.textContent = '♪ Music: OFF';
    } else {
      start();
      btn.textContent = '♪ Music: ON';
    }
  });
})();
