const TAU = Math.PI * 2;
const MAX_SPEED = 3.2;
const BOOST_AMOUNT = 0.46;
const SPEED_DECAY = 0.22;

const state = {
  angle: -Math.PI / 2,
  audioContext: null,
  boostGlow: 0,
  chuffProgress: 0,
  driverContext: null,
  lastFrame: 0,
  mapContext: null,
  speed: 0,
};

const elements = {
  actionButton: document.querySelector("[data-testid='train-action']"),
  driverCanvas: document.querySelector("[data-testid='driver-canvas']"),
  mapCanvas: document.querySelector("[data-testid='map-canvas']"),
  message: document.querySelector("[data-testid='train-message']"),
  speed: document.querySelector("[data-testid='train-speed']"),
  stage: document.querySelector(".train-stage"),
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

function getAudioContext() {
  if (!("AudioContext" in window || "webkitAudioContext" in window)) {
    return null;
  }

  if (!state.audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    state.audioContext = new AudioContextClass();
  }

  if (state.audioContext.state === "suspended") {
    state.audioContext.resume();
  }

  return state.audioContext;
}

function playTone({ frequency, duration, gain = 0.04, type = "triangle", delay = 0 }) {
  const audioContext = getAudioContext();

  if (!audioContext) {
    return;
  }

  const startTime = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(gain, startTime + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gainNode).connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.03);
}

function playBoostSound() {
  playTone({ frequency: 392, duration: 0.09, gain: 0.03, type: "sine" });
  playTone({ frequency: 523.25, duration: 0.12, gain: 0.025, type: "triangle", delay: 0.07 });
}

function playChuffSound() {
  const audioContext = getAudioContext();

  if (!audioContext) {
    return;
  }

  const startTime = audioContext.currentTime;
  const buffer = audioContext.createBuffer(1, Math.floor(audioContext.sampleRate * 0.045), audioContext.sampleRate);
  const data = buffer.getChannelData(0);

  for (let index = 0; index < data.length; index += 1) {
    const fade = 1 - index / data.length;
    data[index] = (Math.random() * 2 - 1) * fade;
  }

  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gainNode = audioContext.createGain();

  filter.type = "bandpass";
  filter.frequency.setValueAtTime(650 + state.speed * 90, startTime);
  gainNode.gain.setValueAtTime(0.018, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.05);

  source.buffer = buffer;
  source.connect(filter).connect(gainNode).connect(audioContext.destination);
  source.start(startTime);
  source.stop(startTime + 0.055);
}

function roundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function fillRoundedRect(context, x, y, width, height, radius, fillStyle) {
  context.fillStyle = fillStyle;
  roundedRect(context, x, y, width, height, radius);
  context.fill();
}

function strokePath(context, points, width, color, lineCap = "round") {
  context.save();
  context.lineWidth = width;
  context.lineCap = lineCap;
  context.lineJoin = "round";
  context.strokeStyle = color;
  context.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.stroke();
  context.restore();
}

function resizeCanvas(canvas) {
  const context = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  return context;
}

function resizeCanvases() {
  state.driverContext = resizeCanvas(elements.driverCanvas);
  state.mapContext = resizeCanvas(elements.mapCanvas);
}

function getDriverTrackPoint(width, height, progress) {
  const horizon = height * 0.42;
  const depth = progress ** 1.55;
  const bend = Math.sin(state.angle + progress * 1.65) * width * 0.16 * (0.35 + progress * 0.65);
  const wobble = Math.sin(state.angle * 2 + progress * 3.4) * width * 0.018 * progress;
  const centerX = width * 0.5 + bend + wobble;
  const y = horizon + depth * height * 0.5;
  const railGap = lerp(width * 0.08, width * 0.43, progress);

  return {
    centerX,
    leftX: centerX - railGap / 2,
    rightX: centerX + railGap / 2,
    railGap,
    y,
  };
}

function drawDriverBackground(context, width, height) {
  const sky = context.createLinearGradient(0, 0, 0, height * 0.58);
  sky.addColorStop(0, "#73c8ff");
  sky.addColorStop(0.7, "#bceeff");
  sky.addColorStop(1, "#e9fff5");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#6ecf65";
  context.beginPath();
  context.moveTo(0, height * 0.44);
  context.bezierCurveTo(width * 0.24, height * 0.35, width * 0.35, height * 0.51, width * 0.56, height * 0.42);
  context.bezierCurveTo(width * 0.78, height * 0.33, width * 0.87, height * 0.48, width, height * 0.39);
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
  context.fill();

  const floor = context.createLinearGradient(0, height * 0.48, 0, height);
  floor.addColorStop(0, "#d9aa67");
  floor.addColorStop(1, "#9f6937");
  context.fillStyle = floor;
  context.fillRect(0, height * 0.5, width, height * 0.5);

  context.strokeStyle = "rgba(105, 72, 34, 0.16)";
  context.lineWidth = Math.max(1, width * 0.002);
  for (let index = 0; index < 8; index += 1) {
    const y = height * (0.55 + index * 0.065);
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y + Math.sin(index) * height * 0.015);
    context.stroke();
  }
}

function drawToyScenery(context, width, height) {
  const toys = [
    { angle: 0.3, color: "#e54e3f", shape: "block" },
    { angle: 1.5, color: "#2c9f5a", shape: "tree" },
    { angle: 2.6, color: "#f5bf3f", shape: "block" },
    { angle: 3.8, color: "#4b91e2", shape: "arch" },
    { angle: 5.0, color: "#ff7f35", shape: "block" },
  ];

  toys.forEach((toy) => {
    const offset = Math.sin(toy.angle - state.angle);
    const depth = 0.55 + 0.45 * Math.cos(toy.angle - state.angle);
    const x = width * (0.5 + offset * 0.42);
    const y = height * (0.48 + (1 - depth) * 0.18);
    const size = clamp(width * (0.035 + depth * 0.04), width * 0.025, width * 0.075);

    if (toy.shape === "tree") {
      context.fillStyle = "#7a4c29";
      fillRoundedRect(context, x - size * 0.12, y, size * 0.24, size * 0.72, size * 0.08, "#7a4c29");
      context.fillStyle = toy.color;
      context.beginPath();
      context.arc(x, y - size * 0.1, size * 0.42, 0, TAU);
      context.fill();
      return;
    }

    if (toy.shape === "arch") {
      context.fillStyle = toy.color;
      roundedRect(context, x - size * 0.5, y - size * 0.25, size, size * 0.72, size * 0.16);
      context.fill();
      context.clearRect(x - size * 0.23, y - size * 0.05, size * 0.46, size * 0.52);
      return;
    }

    fillRoundedRect(context, x - size * 0.45, y - size * 0.2, size * 0.9, size * 0.58, size * 0.12, toy.color);
    context.fillStyle = "rgba(255, 255, 255, 0.26)";
    context.fillRect(x - size * 0.28, y - size * 0.12, size * 0.24, size * 0.12);
  });
}

function drawDriverTrack(context, width, height) {
  const leftRail = [];
  const rightRail = [];
  const centerLine = [];

  for (let index = 0; index <= 42; index += 1) {
    const progress = index / 42;
    const point = getDriverTrackPoint(width, height, progress);
    leftRail.push([point.leftX, point.y]);
    rightRail.push([point.rightX, point.y]);
    centerLine.push([point.centerX, point.y]);
  }

  const sleeperPhase = ((state.angle * 7) / TAU) % 1;

  for (let index = 0; index < 24; index += 1) {
    const progress = (index + sleeperPhase + 1) / 25;
    const point = getDriverTrackPoint(width, height, progress);
    const sleeperWidth = point.railGap + lerp(width * 0.06, width * 0.18, progress);
    const sleeperHeight = lerp(height * 0.008, height * 0.035, progress);

    context.save();
    context.translate(point.centerX, point.y);
    context.rotate(Math.sin(state.angle + progress) * 0.08 * progress);
    fillRoundedRect(
      context,
      -sleeperWidth / 2,
      -sleeperHeight / 2,
      sleeperWidth,
      sleeperHeight,
      sleeperHeight * 0.28,
      "#b87941",
    );
    context.fillStyle = "rgba(93, 52, 26, 0.22)";
    context.fillRect(-sleeperWidth * 0.42, -sleeperHeight * 0.35, sleeperWidth * 0.84, sleeperHeight * 0.18);
    context.restore();
  }

  strokePath(context, centerLine, width * 0.09, "rgba(103, 64, 35, 0.12)");
  strokePath(context, leftRail, width * 0.026, "#7b5b3d");
  strokePath(context, rightRail, width * 0.026, "#7b5b3d");
  strokePath(context, leftRail, width * 0.012, "#d2b07b");
  strokePath(context, rightRail, width * 0.012, "#d2b07b");
}

function drawCab(context, width, height) {
  const glow = state.boostGlow;
  const cabY = height * 0.76;
  const cabHeight = height * 0.28;

  context.fillStyle = `rgba(255, 215, 83, ${0.18 * glow})`;
  context.beginPath();
  context.ellipse(width * 0.5, height * 0.8, width * 0.28, height * 0.12, 0, 0, TAU);
  context.fill();

  fillRoundedRect(context, width * 0.18, cabY, width * 0.64, cabHeight, width * 0.035, "#d13d34");
  fillRoundedRect(context, width * 0.22, cabY + height * 0.035, width * 0.56, cabHeight * 0.44, width * 0.025, "#f2cf64");
  fillRoundedRect(context, width * 0.34, cabY + height * 0.1, width * 0.32, cabHeight * 0.36, width * 0.02, "#226d3e");

  context.fillStyle = "#2f1f18";
  context.beginPath();
  context.arc(width * 0.31, cabY + cabHeight * 0.78, width * 0.035, 0, TAU);
  context.arc(width * 0.69, cabY + cabHeight * 0.78, width * 0.035, 0, TAU);
  context.fill();

  context.strokeStyle = "#6d291f";
  context.lineWidth = width * 0.01;
  context.beginPath();
  context.moveTo(width * 0.5, cabY + height * 0.04);
  context.lineTo(width * (0.5 + Math.sin(state.angle * 2) * 0.04), cabY - height * 0.055);
  context.stroke();

  context.fillStyle = "#111d18";
  context.beginPath();
  context.arc(width * (0.5 + Math.sin(state.angle * 2) * 0.04), cabY - height * 0.06, width * 0.018, 0, TAU);
  context.fill();
}

function drawDriverView() {
  const context = state.driverContext;
  const rect = elements.driverCanvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  drawDriverBackground(context, width, height);
  drawToyScenery(context, width, height);
  drawDriverTrack(context, width, height);
  drawCab(context, width, height);
}

function drawMapSleeper(context, centerX, centerY, radius, angle, length, width) {
  context.save();
  context.translate(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
  context.rotate(angle + Math.PI / 2);
  fillRoundedRect(context, -length / 2, -width / 2, length, width, width * 0.25, "#b87941");
  context.restore();
}

function drawTopDownMap() {
  const context = state.mapContext;
  const rect = elements.mapCanvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.34;

  context.clearRect(0, 0, width, height);
  fillRoundedRect(context, 0, 0, width, height, width * 0.08, "#d49d5c");

  context.strokeStyle = "rgba(110, 68, 30, 0.18)";
  context.lineWidth = Math.max(1, width * 0.01);
  for (let index = 1; index < 5; index += 1) {
    context.beginPath();
    context.moveTo(0, height * index * 0.2 + Math.sin(index) * 5);
    context.lineTo(width, height * index * 0.2);
    context.stroke();
  }

  for (let index = 0; index < 36; index += 1) {
    drawMapSleeper(context, centerX, centerY, radius, (index / 36) * TAU, width * 0.13, width * 0.035);
  }

  context.lineCap = "round";
  context.lineWidth = width * 0.09;
  context.strokeStyle = "rgba(85, 53, 31, 0.18)";
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, TAU);
  context.stroke();

  context.lineWidth = width * 0.035;
  context.strokeStyle = "#7b5b3d";
  context.beginPath();
  context.arc(centerX, centerY, radius - width * 0.04, 0, TAU);
  context.stroke();
  context.beginPath();
  context.arc(centerX, centerY, radius + width * 0.04, 0, TAU);
  context.stroke();

  context.lineWidth = width * 0.014;
  context.strokeStyle = "#e0be80";
  context.beginPath();
  context.arc(centerX, centerY, radius - width * 0.04, 0, TAU);
  context.stroke();
  context.beginPath();
  context.arc(centerX, centerY, radius + width * 0.04, 0, TAU);
  context.stroke();

  const trainX = centerX + Math.cos(state.angle) * radius;
  const trainY = centerY + Math.sin(state.angle) * radius;

  context.save();
  context.translate(trainX, trainY);
  context.rotate(state.angle + Math.PI / 2);
  fillRoundedRect(context, -width * 0.045, -width * 0.08, width * 0.09, width * 0.16, width * 0.018, "#d13d34");
  fillRoundedRect(context, -width * 0.035, -width * 0.005, width * 0.07, width * 0.12, width * 0.014, "#226d3e");
  context.fillStyle = "#f4d568";
  context.beginPath();
  context.arc(0, -width * 0.052, width * 0.018, 0, TAU);
  context.fill();
  context.restore();
}

function updateSpeedReadout() {
  const speedValue = Math.round((state.speed / MAX_SPEED) * 9);
  elements.speed.textContent = String(speedValue);

  if (state.speed < 0.08) {
    elements.message.textContent = "Ready";
  } else if (state.speed > MAX_SPEED * 0.72) {
    elements.message.textContent = "Fast train";
  } else {
    elements.message.textContent = "Choo choo";
  }
}

function boostTrain() {
  state.speed = Math.min(MAX_SPEED, state.speed + BOOST_AMOUNT);
  state.boostGlow = 1;
  elements.actionButton.classList.add("pressed");
  window.setTimeout(() => elements.actionButton.classList.remove("pressed"), 90);
  updateSpeedReadout();
  playBoostSound();
}

function stepTrain(deltaSeconds) {
  state.speed = Math.max(0, state.speed - SPEED_DECAY * deltaSeconds);
  state.angle = (state.angle + state.speed * deltaSeconds) % TAU;
  state.boostGlow = Math.max(0, state.boostGlow - deltaSeconds * 2.4);

  if (state.speed > 0.08) {
    state.chuffProgress += state.speed * deltaSeconds * 1.7;

    if (state.chuffProgress >= 1) {
      state.chuffProgress %= 1;
      playChuffSound();
    }
  }

  updateSpeedReadout();
}

function drawFrame(timestamp) {
  const deltaSeconds = state.lastFrame ? Math.min(0.05, (timestamp - state.lastFrame) / 1000) : 0;
  state.lastFrame = timestamp;

  stepTrain(deltaSeconds);
  drawDriverView();
  drawTopDownMap();

  window.requestAnimationFrame(drawFrame);
}

function handleKeydown(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  event.preventDefault();
  boostTrain();
}

function handleStagePointer(event) {
  if (event.target.closest("a, button")) {
    return;
  }

  boostTrain();
}

window.addEventListener("keydown", handleKeydown);
window.addEventListener("resize", resizeCanvases);
elements.actionButton.addEventListener("click", boostTrain);
elements.stage.addEventListener("pointerdown", handleStagePointer);

resizeCanvases();
drawDriverView();
drawTopDownMap();
window.requestAnimationFrame(drawFrame);

window.trainGame = {
  boost: boostTrain,
  getState() {
    return {
      angle: state.angle,
      speed: state.speed,
    };
  },
};
