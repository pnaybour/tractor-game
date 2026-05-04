const CARROTS_PER_HORSE = 2;
const LEVELS = [
  { horseCount: 1, name: "Level 1" },
  { horseCount: 2, name: "Level 2" },
  { horseCount: 3, name: "Level 3" },
];

const state = {
  carrotsFed: 0,
  holdingCarrot: false,
  levelIndex: 0,
  nextPatch: 0,
  busy: false,
  pendingActions: 0,
  activeSounds: new Set(),
  audioContext: null,
  effectsContext: null,
  effectsDpr: 1,
  effectsFrame: null,
  lastEffectsTime: 0,
  musicStarted: false,
  musicTimer: null,
  particles: [],
};

const elements = {
  actionButton: document.querySelector("[data-testid='action-button']"),
  carrotCount: document.querySelector("[data-testid='carrot-count']"),
  carrotDots: document.querySelector("[data-testid='carrot-dots']"),
  carriedCarrot: document.querySelector("[data-testid='carried-carrot']"),
  digger: document.querySelector("[data-testid='digger']"),
  effectsCanvas: document.querySelector("[data-testid='effects-canvas']"),
  horseCount: document.querySelector("[data-testid='horse-count']"),
  horses: Array.from(document.querySelectorAll("[data-testid='horse']")),
  horseZones: Array.from(document.querySelectorAll("[data-testid='horse-zone']")),
  levelLabel: document.querySelector("[data-testid='level-label']"),
  message: document.querySelector("[data-testid='message']"),
  troughCarrots: Array.from(document.querySelectorAll("[data-testid='trough-carrots']")),
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
  patch: ["11vw", "19vw", "27vw", "35vw", "43vw", "51vw"],
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

function getCurrentLevel() {
  return LEVELS[state.levelIndex];
}

function getLevelCarrotTarget() {
  return getCurrentLevel().horseCount * CARROTS_PER_HORSE;
}

function getActiveHorseIndexes() {
  const horseCount = getCurrentLevel().horseCount;
  const firstHorseIndex = elements.horses.length - horseCount;

  return elements.horses.map((_, index) => index).slice(firstHorseIndex);
}

function getTargetHorseIndex() {
  const activeHorseIndexes = getActiveHorseIndexes();
  const horseOrder = Math.min(
    Math.floor(state.carrotsFed / CARROTS_PER_HORSE),
    activeHorseIndexes.length - 1,
  );

  return activeHorseIndexes[horseOrder];
}

function getFedCountForHorse(horseIndex) {
  const activeHorseIndexes = getActiveHorseIndexes();
  const horseOrder = activeHorseIndexes.indexOf(horseIndex);

  if (horseOrder === -1) {
    return 0;
  }

  const fedBeforeHorse = horseOrder * CARROTS_PER_HORSE;
  return Math.max(0, Math.min(CARROTS_PER_HORSE, state.carrotsFed - fedBeforeHorse));
}

function formatHorseCount(count) {
  return `${count} horse${count === 1 ? "" : "s"}`;
}

function renderDots() {
  const carrotTarget = getLevelCarrotTarget();
  elements.carrotDots.innerHTML = "";

  for (let index = 0; index < carrotTarget; index += 1) {
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

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function setupEffectsCanvas() {
  if (!elements.effectsCanvas) {
    return;
  }

  state.effectsContext = elements.effectsCanvas.getContext("2d");

  if (!state.effectsContext) {
    return;
  }

  const resizeCanvas = () => {
    const rect = elements.world.getBoundingClientRect();
    state.effectsDpr = Math.min(window.devicePixelRatio || 1, 2);
    elements.effectsCanvas.width = Math.max(1, Math.round(rect.width * state.effectsDpr));
    elements.effectsCanvas.height = Math.max(1, Math.round(rect.height * state.effectsDpr));
    elements.effectsCanvas.style.width = `${rect.width}px`;
    elements.effectsCanvas.style.height = `${rect.height}px`;
    state.effectsContext.setTransform(state.effectsDpr, 0, 0, state.effectsDpr, 0, 0);
  };

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  if ("ResizeObserver" in window) {
    new ResizeObserver(resizeCanvas).observe(elements.world);
  }

  state.effectsFrame = window.requestAnimationFrame(drawEffects);
}

function getWorldPoint(element, xRatio = 0.5, yRatio = 0.5) {
  const worldRect = elements.world.getBoundingClientRect();
  const rect = element.getBoundingClientRect();

  return {
    x: rect.left - worldRect.left + rect.width * xRatio,
    y: rect.top - worldRect.top + rect.height * yRatio,
  };
}

function addParticle(particle) {
  if (!state.effectsContext || prefersReducedMotion()) {
    return;
  }

  state.particles.push({
    alpha: 1,
    gravity: 0,
    life: 40,
    maxLife: 40,
    rotation: 0,
    rotationSpeed: 0,
    shape: "circle",
    size: 4,
    vx: 0,
    vy: 0,
    ...particle,
  });
}

function drawEffects(timestamp) {
  const context = state.effectsContext;

  if (!context) {
    return;
  }

  const rect = elements.effectsCanvas.getBoundingClientRect();
  const delta = state.lastEffectsTime ? Math.min(2.5, (timestamp - state.lastEffectsTime) / 16.67) : 1;
  state.lastEffectsTime = timestamp;

  context.clearRect(0, 0, rect.width, rect.height);

  state.particles = state.particles.filter((particle) => {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vy += particle.gravity * delta;
    particle.rotation += particle.rotationSpeed * delta;
    particle.life -= delta;

    if (particle.life <= 0) {
      return false;
    }

    const fade = Math.max(0, particle.life / particle.maxLife);
    context.save();
    context.globalAlpha = particle.alpha * fade;
    context.translate(particle.x, particle.y);
    context.rotate(particle.rotation);
    context.fillStyle = particle.color;

    if (particle.shape === "spark") {
      context.strokeStyle = particle.color;
      context.lineWidth = Math.max(1, particle.size * 0.22);
      context.beginPath();
      context.moveTo(-particle.size, 0);
      context.lineTo(particle.size, 0);
      context.moveTo(0, -particle.size);
      context.lineTo(0, particle.size);
      context.stroke();
    } else if (particle.shape === "smoke") {
      const radius = particle.size * (1.2 - fade * 0.25);
      context.beginPath();
      context.arc(0, 0, radius, 0, Math.PI * 2);
      context.fill();
    } else {
      context.beginPath();
      context.arc(0, 0, particle.size, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();
    return true;
  });

  state.effectsFrame = window.requestAnimationFrame(drawEffects);
}

function spawnDirtBurst(source) {
  const origin = getWorldPoint(source, 0.52, 0.42);
  const colors = ["#6b4327", "#8a5a33", "#a27145", "#50321e"];

  for (let index = 0; index < 24; index += 1) {
    addParticle({
      x: origin.x + (Math.random() - 0.5) * 14,
      y: origin.y + Math.random() * 8,
      vx: (Math.random() - 0.5) * 4.8,
      vy: -2.4 - Math.random() * 4.2,
      gravity: 0.22 + Math.random() * 0.08,
      size: 2 + Math.random() * 3.8,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 32 + Math.random() * 28,
      maxLife: 60,
    });
  }
}

function spawnSparkleBurst(source, options = {}) {
  const origin = getWorldPoint(source, options.xRatio ?? 0.5, options.yRatio ?? 0.42);
  const colors = options.colors ?? ["#fff6a7", "#ffd45a", "#ffffff", "#ffab37"];

  for (let index = 0; index < (options.count ?? 16); index += 1) {
    addParticle({
      x: origin.x + (Math.random() - 0.5) * 12,
      y: origin.y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 3.6,
      vy: -1.2 - Math.random() * 2.4,
      gravity: 0.035 + Math.random() * 0.035,
      size: 3 + Math.random() * 4,
      shape: "spark",
      rotation: Math.random() * Math.PI,
      rotationSpeed: (Math.random() - 0.5) * 0.18,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 28 + Math.random() * 22,
      maxLife: 50,
    });
  }
}

function spawnExhaustPuff() {
  const origin = getWorldPoint(document.querySelector(".exhaust") || elements.digger, 0.5, 0.08);

  addParticle({
    x: origin.x + (Math.random() - 0.5) * 5,
    y: origin.y + (Math.random() - 0.5) * 4,
    vx: -0.55 - Math.random() * 0.45,
    vy: -0.35 - Math.random() * 0.45,
    gravity: -0.012,
    size: 5 + Math.random() * 7,
    shape: "smoke",
    color: "rgba(95, 115, 105, 0.36)",
    life: 38 + Math.random() * 18,
    maxLife: 56,
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

function addTroughCarrot(horseIndex) {
  const carrot = document.createElement("span");
  carrot.className = "mini-carrot";
  carrot.style.setProperty("--tilt", `${-22 + getFedCountForHorse(horseIndex) * 18}deg`);
  elements.troughCarrots[horseIndex]?.append(carrot);
}

function startLevel(levelIndex = state.levelIndex) {
  state.levelIndex = levelIndex;
  state.carrotsFed = 0;
  state.holdingCarrot = false;
  state.nextPatch = 0;
  elements.troughCarrots.forEach((trough) => {
    trough.innerHTML = "";
  });
  elements.carriedCarrot.classList.remove("visible");
  elements.horses.forEach((horse) => horse.classList.remove("full", "happy"));
  elements.world.classList.remove("celebration");
  elements.patches.forEach((patch) => patch.classList.remove("dug"));
  setDiggerPosition(diggerStops.home);
  setMessage(`${getCurrentLevel().name}: ${formatHorseCount(getCurrentLevel().horseCount)}`);
  render();
}

function render() {
  const currentLevel = getCurrentLevel();
  const activeHorseIndexes = getActiveHorseIndexes();
  const targetHorseIndex = getTargetHorseIndex();

  elements.levelLabel.textContent = currentLevel.name;
  elements.horseCount.textContent = formatHorseCount(currentLevel.horseCount);
  elements.carrotCount.textContent = `${state.carrotsFed}/${getLevelCarrotTarget()}`;
  elements.carriedCarrot.classList.toggle("visible", state.holdingCarrot);
  elements.horseZones.forEach((zone, index) => {
    zone.classList.toggle("visible", activeHorseIndexes.includes(index));
    zone.classList.toggle("target", index === targetHorseIndex);
  });
  elements.horses.forEach((horse, index) => {
    const isFull = getFedCountForHorse(index) >= CARROTS_PER_HORSE;
    horse.classList.toggle("full", isFull);
  });
  renderDots();
}

async function moveDiggerTo(position, durationMs) {
  playMoveSound(durationMs);
  elements.digger.classList.add("moving");
  spawnExhaustPuff();

  const exhaustTimer = window.setInterval(spawnExhaustPuff, 105);

  try {
    setDiggerPosition(position);
    await sleep(durationMs);
  } finally {
    window.clearInterval(exhaustTimer);
    elements.digger.classList.remove("moving");
  }
}

async function digCarrot() {
  const patchIndex = Math.min(state.nextPatch, elements.patches.length - 1);
  const patch = elements.patches[patchIndex];

  setMessage("Dig dig dig");
  await moveDiggerTo(diggerStops.patch[patchIndex] || diggerStops.patch.at(-1), 520);

  elements.digger.classList.add("digging");
  spawnDirtBurst(patch);
  playDigSound();
  await sleep(320);
  elements.digger.classList.remove("digging");

  patch.classList.add("dug");
  state.holdingCarrot = true;
  state.nextPatch += 1;
  spawnSparkleBurst(patch);
  playPopSound();
  setMessage("Carrot found");
  render();
}

async function feedHorse() {
  const targetHorseIndex = getTargetHorseIndex();
  const targetHorse = elements.horses[targetHorseIndex];
  const targetTrough = elements.troughCarrots[targetHorseIndex];

  setMessage("To the horse");
  await moveDiggerTo(diggerStops.horse, 540);

  elements.digger.classList.add("feeding");
  state.holdingCarrot = false;
  addTroughCarrot(targetHorseIndex);
  state.carrotsFed += 1;
  spawnSparkleBurst(targetTrough || elements.world, {
    count: 10,
    colors: ["#fff6a7", "#ffab37", "#ffffff"],
    yRatio: 0.1,
  });
  playMunchSound();
  setMessage("Crunch crunch");
  render();
  await sleep(420);
  elements.digger.classList.remove("feeding");

  const horseIsFull = getFedCountForHorse(targetHorseIndex) >= CARROTS_PER_HORSE;
  const levelIsComplete = state.carrotsFed >= getLevelCarrotTarget();

  if (horseIsFull) {
    setMessage(levelIsComplete ? "Happy horses" : "Happy horse");
    targetHorse.classList.add("happy", "full");
    elements.world.classList.add("celebration");
    spawnSparkleBurst(targetHorse, {
      count: levelIsComplete ? 34 : 20,
      colors: ["#fff6a7", "#ffd45a", "#ffffff", "#ff8a22"],
      yRatio: 0.22,
    });
    playHappyHorseSound();
    await sleep(levelIsComplete ? 2200 : 1200);
    targetHorse.classList.remove("happy");
    elements.world.classList.remove("celebration");
  }

  if (levelIsComplete) {
    const nextLevelIndex = (state.levelIndex + 1) % LEVELS.length;
    startLevel(nextLevelIndex);
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
  state.pendingActions = 0;

  if (state.busy) {
    return;
  }

  state.pendingActions = 1;
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

setupEffectsCanvas();
startLevel(0);
