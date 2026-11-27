// audio.js — the soundscape, all synthesised with WebAudio: engine drone,
// wind rush, a ring chime and a landing thud. No audio files, no network.
export function createAudio() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);

  // Engine: two detuned saws through a low-pass, pitch and loudness follow throttle.
  const engineOsc1 = ctx.createOscillator();
  engineOsc1.type = 'sawtooth';
  const engineOsc2 = ctx.createOscillator();
  engineOsc2.type = 'sawtooth';
  engineOsc2.detune.value = 8;
  const engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 420;
  engineFilter.Q.value = 2;
  const engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  engineOsc1.connect(engineFilter);
  engineOsc2.connect(engineFilter);
  engineFilter.connect(engineGain);
  engineGain.connect(master);
  engineOsc1.start();
  engineOsc2.start();

  // Wind: looped noise through a band-pass, louder and higher with airspeed.
  const noiseLength = ctx.sampleRate * 2;
  const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseLength; i++) noiseData[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 700;
  windFilter.Q.value = 0.6;
  const windGain = ctx.createGain();
  windGain.gain.value = 0;
  noise.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(master);
  noise.start();

  // Propeller putter: a low square wave pulsing with rpm.
  const putter = ctx.createOscillator();
  putter.type = 'square';
  putter.frequency.value = 12;
  const putterGain = ctx.createGain();
  putterGain.gain.value = 0;
  const putterFilter = ctx.createBiquadFilter();
  putterFilter.type = 'lowpass';
  putterFilter.frequency.value = 160;
  putter.connect(putterFilter);
  putterFilter.connect(putterGain);
  putterGain.connect(master);
  putter.start();

  return {
    ctx,
    /** Call on a user gesture: browsers block audio before one. */
    resume() {
      if (ctx.state === 'suspended') void ctx.resume();
    },
    /** Follows throttle (0..1) and airspeed (m/s) every frame. */
    update(throttle, speed) {
      const rpm = 38 + throttle * 62;
      engineOsc1.frequency.setTargetAtTime(rpm, ctx.currentTime, 0.08);
      engineOsc2.frequency.setTargetAtTime(rpm * 1.5, ctx.currentTime, 0.08);
      engineFilter.frequency.setTargetAtTime(320 + throttle * 700, ctx.currentTime, 0.1);
      engineGain.gain.setTargetAtTime(0.02 + throttle * 0.10, ctx.currentTime, 0.1);
      putter.frequency.setTargetAtTime(9 + throttle * 14, ctx.currentTime, 0.1);
      putterGain.gain.setTargetAtTime(0.012 + throttle * 0.03, ctx.currentTime, 0.1);
      const wind = Math.min(0.16, (speed / 72) * 0.16);
      windGain.gain.setTargetAtTime(wind, ctx.currentTime, 0.15);
      windFilter.frequency.setTargetAtTime(500 + speed * 9, ctx.currentTime, 0.15);
    },
    /** A bright two-note chime when a ring is cleared. */
    ringChime() {
      const now = ctx.currentTime;
      for (const [freq, at] of [[880, 0], [1318, 0.09]]) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now + at);
        gain.gain.exponentialRampToValueAtTime(0.22, now + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.5);
        osc.connect(gain);
        gain.connect(master);
        osc.start(now + at);
        osc.stop(now + at + 0.55);
      }
    },
    /** A low thud for touchdown and a dull crunch for a crash. */
    thud(hard) {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(hard ? 70 : 95, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.25);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(hard ? 0.5 : 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.4);
    },
    /** Mutes everything (used when the tab is hidden). */
    mute() {
      master.gain.value = 0;
    },
    unmute() {
      master.gain.value = 0.5;
    },
  };
}
