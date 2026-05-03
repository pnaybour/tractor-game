const CARROTS_TO_FILL_HORSE = 5;

const state = {
  carrotsFed: 0,
  holdingCarrot: false,
  nextPatch: 0,
  busy: false,
  pendingActions: 0,
  activeSounds: new Set(),
  audioContext: null,
  musicStarted: false,
  musicTimer: null,
};

const elements = {
  actionButton: document.querySelector("[data-testid='action-button']"),
  carrotCount: document.querySelector("[data-testid='carrot-count']"),
  carrotDots: document.querySelector("[data-testid='carrot-dots']"),
  carriedCarrot: document.querySelector("[data-testid='carried-carrot']"),
  digger: document.querySelector("[data-testid='digger']"),
  horse: document.querySelector("[data-testid='horse']"),
  message: document.querySelector("[data-testid='message']"),
  troughCarrots: document.querySelector("[data-testid='trough-carrots']"),
  world: document.querySelector("[data-testid='world']"),
  patches: Array.from(document.querySelectorAll(".soil-mound")),
};

const soundFiles = {
  shovel: makeAudio("assets/sounds/shovel.ogg"),
  crunches: [
    makeAudio("assets/sounds/crunch-1.ogg"),
    makeAudio("assets/sounds/crunch-2.ogg"),
    makeAudio("assets/sounds/crunch-3.ogg"),
  ],
  horseNeigh: makeAudio("assets/sounds/horse-neigh.ogg"),
};

const diggerStops = {
  patch: ["13vw", "22vw", "31vw", "40vw", "49vw"],
  horse: "68vw",
  home: "15vw",
};

const musicNotes = {
  c3: 130.81,
  g3: 196,
  a3: 220,
  c4: 261.63,
  d4: 293.66,
  e4: 329.63,
  g4: 392,
  a4: 440,
  c5: 523.25,
  d5: 587.33,
  e5: 659.25,
  g5: 783.99,
  a5: 880,
};

const musicPhrase = [
  ["c5", 0, 0.28],
  ["e5", 0.45, 0.24],
  ["g5", 0.9, 0.3],
  ["e5", 1.35, 0.24],
  ["d5", 1.8, 0.26],
  ["c5", 2.25, 0.34],
  ["a4", 2.85, 0.26],
  ["c5", 3.3, 0.42],
  ["g4", 4.05, 0.24],
  ["c5", 4.5, 0.28],
  ["e5", 4.95, 0.26],
  ["g5", 5.4, 0.32],
  ["a5", 5.85, 0.26],
  ["g5", 6.3, 0.3],
  ["e5", 6.75, 0.28],
  ["c5", 7.2, 0.54],
];

const musicBass = [
  ["c3", 0, 0.62],
  ["g3", 1.8, 0.56],
  ["a3", 3.6, 0.56],
  ["g3", 5.4, 0.62],
];

const MUSIC_LOOP_MS = 7800;

function makeAudio(src) {
  const audio = new Audio(src);
  audio.preload = "auto";
  return audio;
}

function renderDots() {
  elements.carrotDots.innerHTML = "";

  for (let index = 0; index < CARROTS_TO_FILL_HORSE; index += 1) {
    const dot = document.createElement("span");
    dot.className = index < state.carrotsFed ? "dot filled" : "dot";
    elements.carrotDots.append(dot);
  }
}

function setMessage(message) {
  elements.message.textContent = message;
}

function setDiggerPosition(position) {
  elements.digger.style.setProperty("--x", position);
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function ensureAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  if (!state.audioContext) {
    state.audioContext = new AudioContextClass();
  }

  if (state.audioContext.state === "suspended") {
    state.audioContext.resume();
  }

  return state.audioContext;
}

function playTone({ frequency, duration = 0.12, type = "sine", gain = 0.08, delay = 0 }) {
  const context = ensureAudioContext();

  if (!context) {
    return;
  }

  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const volume = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(volume);
  volume.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

function playMusicNote({ frequency, delay = 0, duration = 0.28, gain = 0.022, type = "triangle" }) {
  const context = ensureAudioContext();

  if (!context) {
    return;
  }

  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const overtone = context.createOscillator();
  const filter = context.createBiquadFilter();
  const volume = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  overtone.type = "sine";
  overtone.frequency.setValueAtTime(frequency * 2, start);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1700, start);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.025);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(filter);
  overtone.connect(filter);
  filter.connect(volume);
  volume.connect(context.destination);
  oscillator.start(start);
  overtone.start(start);
  oscillator.stop(start + duration + 0.04);
  overtone.stop(start + duration + 0.04);
}

function playSlidingTone({
  frequency,
  endFrequency,
  duration = 0.18,
  type = "sine",
  gain = 0.06,
  delay = 0,
}) {
  const context = ensureAudioContext();

  if (!context) {
    return;
  }

  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const volume = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(volume);
  volume.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.04);
}

function playNoiseBurst({
  duration = 0.12,
  frequency = 700,
  filterType = "bandpass",
  gain = 0.05,
  delay = 0,
  q = 0.8,
}) {
  const context = ensureAudioContext();

  if (!context) {
    return;
  }

  const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / sampleCount;
    data[index] = (Math.random() * 2 - 1) * (1 - progress);
  }

  const start = context.currentTime + delay;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const volume = context.createGain();

  source.buffer = buffer;
  filter.type = filterType;
  filter.frequency.setValueAtTime(frequency, start);
  filter.Q.setValueAtTime(q, start);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  source.connect(filter);
  filter.connect(volume);
  volume.connect(context.destination);
  source.start(start);
  source.stop(start + duration + 0.02);
}

function playClip(clip, { volume = 0.45, playbackRate = 1, fallback } = {}) {
  if (!clip) {
    fallback?.();
    return;
  }

  const sound = clip.cloneNode(true);
  sound.volume = volume;
  sound.playbackRate = playbackRate;

  if ("preservesPitch" in sound) {
    sound.preservesPitch = true;
  }

  state.activeSounds.add(sound);

  sound.addEventListener(
    "ended",
    () => {
      state.activeSounds.delete(sound);
    },
    { once: true },
  );

  sound.play().catch(() => {
    state.activeSounds.delete(sound);
    fallback?.();
  });
}

function choose(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function scheduleBackgroundMusicPhrase() {
  musicPhrase.forEach(([note, delay, duration], index) => {
    playMusicNote({
      frequency: musicNotes[note],
      delay,
      duration,
      gain: index % 4 === 0 ? 0.023 : 0.018,
      type: "triangle",
    });
  });

  musicBass.forEach(([note, delay, duration]) => {
    playMusicNote({
      frequency: musicNotes[note],
      delay,
      duration,
      gain: 0.012,
      type: "sine",
    });
  });
}

function startBackgroundMusic() {
  if (state.musicStarted) {
    return;
  }

  state.musicStarted = true;
  scheduleBackgroundMusicPhrase();
  state.musicTimer = window.setInterval(scheduleBackgroundMusicPhrase, MUSIC_LOOP_MS);
}

function playDigSound() {
  playClip(soundFiles.shovel, {
    volume: 0.42,
    playbackRate: 0.96 + Math.random() * 0.08,
    fallback: playSynthDigSound,
  });
  playNoiseBurst({ duration: 0.1, frequency: 220, filterType: "lowpass", gain: 0.035, delay: 0.06 });
}

function playSynthDigSound() {
  playNoiseBurst({ duration: 0.11, frequency: 300, filterType: "lowpass", gain: 0.06 });
  playTone({ frequency: 96, duration: 0.08, type: "triangle", gain: 0.045, delay: 0.05 });
}

function playMoveSound(durationMs = 500) {
  const duration = Math.max(0.18, durationMs / 1000);
  const treadSteps = Math.max(2, Math.floor(durationMs / 95));

  playSlidingTone({
    frequency: 70,
    endFrequency: 92,
    duration,
    type: "sawtooth",
    gain: 0.022,
  });
  playNoiseBurst({
    duration,
    frequency: 170,
    filterType: "lowpass",
    gain: 0.018,
    q: 0.7,
  });

  for (let index = 0; index < treadSteps; index += 1) {
    playTone({
      frequency: index % 2 === 0 ? 118 : 92,
      duration: 0.035,
      type: "square",
      gain: 0.018,
      delay: index * 0.09,
    });
  }
}

function playPopSound() {
  playSlidingTone({ frequency: 270, endFrequency: 610, duration: 0.09, type: "triangle", gain: 0.055 });
  playTone({ frequency: 820, duration: 0.09, type: "sine", gain: 0.045, delay: 0.07 });
  playNoiseBurst({ duration: 0.06, frequency: 1200, filterType: "highpass", gain: 0.018, delay: 0.03 });
}

function playMunchSound() {
  playClip(choose(soundFiles.crunches), {
    volume: 0.46,
    playbackRate: 0.92 + Math.random() * 0.18,
    fallback: playSynthMunchSound,
  });
  playTone({ frequency: 260, duration: 0.08, type: "triangle", gain: 0.025, delay: 0.08 });
}

function playSynthMunchSound() {
  playNoiseBurst({ duration: 0.055, frequency: 1900, filterType: "bandpass", gain: 0.05, q: 1.8 });
  playNoiseBurst({ duration: 0.07, frequency: 1400, filterType: "bandpass", gain: 0.04, q: 1.4, delay: 0.08 });
}

function playHappyHorseSound() {
  playClip(soundFiles.horseNeigh, {
    volume: 0.42,
    playbackRate: 1.08,
    fallback: playSynthHorseWhinny,
  });

  const notes = [392, 523, 659, 784, 659, 880];

  notes.forEach((frequency, index) => {
    playTone({
      frequency,
      duration: 0.11,
      type: index % 2 === 0 ? "triangle" : "sine",
      gain: 0.055,
      delay: 0.18 + index * 0.085,
    });
  });
}

function playSynthHorseWhinny() {
  playSlidingTone({ frequency: 340, endFrequency: 680, duration: 0.22, type: "sawtooth", gain: 0.035 });
  playSlidingTone({
    frequency: 700,
    endFrequency: 390,
    duration: 0.42,
    type: "triangle",
    gain: 0.04,
    delay: 0.18,
  });
  playNoiseBurst({ duration: 0.2, frequency: 2100, filterType: "bandpass", gain: 0.018, delay: 0.22 });
}

function addTroughCarrot() {
  const carrot = document.createElement("span");
  carrot.className = "mini-carrot";
  carrot.style.setProperty("--tilt", `${-22 + state.carrotsFed * 11}deg`);
  elements.troughCarrots.append(carrot);
}

function resetRound() {
  state.carrotsFed = 0;
  state.holdingCarrot = false;
  state.nextPatch = 0;
  elements.troughCarrots.innerHTML = "";
  elements.carriedCarrot.classList.remove("visible");
  elements.horse.classList.remove("full", "happy");
  elements.world.classList.remove("celebration");
  elements.patches.forEach((patch) => patch.classList.remove("dug"));
  setDiggerPosition(diggerStops.home);
  setMessage("Ready to dig");
  render();
}

function render() {
  elements.carrotCount.textContent = `${state.carrotsFed}/${CARROTS_TO_FILL_HORSE}`;
  elements.carriedCarrot.classList.toggle("visible", state.holdingCarrot);
  elements.horse.classList.toggle("full", state.carrotsFed >= CARROTS_TO_FILL_HORSE);
  renderDots();
}

async function moveDiggerTo(position, durationMs) {
  playMoveSound(durationMs);
  setDiggerPosition(position);
  await sleep(durationMs);
}

async function digCarrot() {
  const patchIndex = Math.min(state.nextPatch, elements.patches.length - 1);
  const patch = elements.patches[patchIndex];

  setMessage("Dig dig dig");
  await moveDiggerTo(diggerStops.patch[patchIndex] || diggerStops.patch.at(-1), 520);

  elements.digger.classList.add("digging");
  playDigSound();
  await sleep(320);
  elements.digger.classList.remove("digging");

  patch.classList.add("dug");
  state.holdingCarrot = true;
  state.nextPatch += 1;
  playPopSound();
  setMessage("Carrot found");
  render();
}

async function feedHorse() {
  setMessage("To the horse");
  await moveDiggerTo(diggerStops.horse, 540);

  elements.digger.classList.add("feeding");
  state.holdingCarrot = false;
  state.carrotsFed += 1;
  addTroughCarrot();
  playMunchSound();
  setMessage("Crunch crunch");
  render();
  await sleep(420);
  elements.digger.classList.remove("feeding");

  if (state.carrotsFed >= CARROTS_TO_FILL_HORSE) {
    setMessage("Happy full horse");
    elements.horse.classList.add("happy", "full");
    elements.world.classList.add("celebration");
    playHappyHorseSound();
    await sleep(2500);
    resetRound();
  } else {
    await moveDiggerTo(diggerStops.home, 340);
    setMessage("Ready to dig");
  }
}

async function processActions() {
  if (state.busy) {
    return;
  }

  state.busy = true;

  try {
    while (state.pendingActions > 0) {
      state.pendingActions -= 1;

      if (state.holdingCarrot) {
        await feedHorse();
      } else {
        await digCarrot();
      }
    }
  } finally {
    state.busy = false;
  }
}

function requestAction() {
  startBackgroundMusic();
  state.pendingActions = Math.min(state.pendingActions + 1, 20);
  processActions();
}

function handleKeydown(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  event.preventDefault();
  requestAction();
}

window.addEventListener("keydown", handleKeydown);
elements.actionButton.addEventListener("click", requestAction);

render();
