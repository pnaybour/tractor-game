import * as THREE from "three";
import {
  TAU, BRANCH_START, BRANCH_END, BRANCH_STATION_ANGLE,
  BRANCH_LENGTH, BRANCH_SPEED_FACTOR, WAGON_OFFSETS,
  bridgeLift, getTrackPose, isOnBranchSection, normaliseAngle,
  crossesAngle, getWagonAngle, routeForCar, turnoutsForTrain,
} from "./train3d-track.mjs";
import { loadStorybookTrain } from "./train3d-gltf.mjs";
import { createToyRailway } from "./train3d-world.mjs";

// Three.js WebGL and locally hosted glTF 2.0 train assets form the primary
// experience. The little 2D canvas is only a secondary route diagram.
const MAX_SPEED = 1.25;
const BOOST = 0.34;
const DRAG = 0.11;
const CAMERA_MODES = ["follow", "driver", "overview"];
const canvas = document.getElementById("train3d-canvas");
const map = document.getElementById("train3d-map");
const mapContext = map.getContext("2d");
const speedEl = document.querySelector("[data-testid='train3d-speed']");
const messageEl = document.querySelector("[data-testid='train3d-message']");
const routeEl = document.querySelector("[data-testid='train3d-route']");
const branchEl = document.getElementById("train3d-branch");
const viewEl = document.getElementById("train3d-view");
const failureEl = document.getElementById("train3d-error");

const state = {
  angle: -Math.PI / 2,
  speed: 0,
  boostCount: 0,
  branchSelected: false,
  branchTrip: false,
  cameraMode: 0,
  lastFrame: 0,
  audioContext: null,
  chuffProgress: 0,
  smokeTimer: 0,
  smoke: [],
  noticeUntil: 0,
  blinkTimer: 3.7,
  blinkRemaining: 0,
  modelFormat: "loading",
  frameCount: 0,
  renderCount: 0,
};

function showNotice(message, seconds = 2) {
  messageEl.textContent = message;
  state.noticeUntil = performance.now() / 1000 + seconds;
}

function makeTone(frequency, duration, gain = 0.025, type = "sine", delay = 0) {
  if (!state.audioContext) return;
  const audio = state.audioContext;
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const volume = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.035);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(volume).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function enableAudio() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  if (!state.audioContext) state.audioContext = new Audio();
  if (state.audioContext.state === "suspended") state.audioContext.resume();
}

function whistle() {
  enableAudio();
  [440, 523.25, 659.25].forEach((frequency, index) =>
    makeTone(frequency, 1.15, 0.028, "sawtooth", index * 0.025));
  showNotice("Whoo whoo! 🚂", 1.4);
}

function boost() {
  enableAudio();
  state.boostCount += 1;
  state.speed = Math.min(MAX_SPEED, state.speed + BOOST);
  showNotice("Choo choo!", 0.8);
  makeTone(390, 0.10, 0.007, "triangle");
}

function chooseBranch() {
  state.branchSelected = !state.branchSelected;
  branchEl.setAttribute("aria-pressed", String(state.branchSelected));
  branchEl.textContent = state.branchSelected ? "↗ BRANCH: ON" : "↗ BRANCH: OFF";
  railway.setBranchSelected(state.branchSelected);
  showNotice(state.branchSelected ? "Branch at the next junction!" : "Main line at the next junction!");
}

function changeCamera() {
  state.cameraMode = (state.cameraMode + 1) % CAMERA_MODES.length;
  const names = ["👀 FOLLOW VIEW", "🚂 DRIVER VIEW", "🗺️ OVERVIEW"];
  viewEl.textContent = names[state.cameraMode];
  // Make view changes immediate, including on slower mobile devices.
  followCamera(getTrackPose(state.angle, routeForCar(state.angle, state.branchTrip)), 2);
  showNotice(["Following the train!", "Driving the train!", "The whole railway!"][state.cameraMode]);
}

function handleKeyDown(event) {
  // Preserve browser/system shortcuts, editable fields and key-repeat protection.
  if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
  if (event.target.closest?.("input, textarea, select, [contenteditable]")) return;
  // Tab and function keys belong to the browser, not the train controls.
  if (event.key === "Tab" || /^F\d{1,2}$/.test(event.key)) return;

  // Enter/Space on a focused button or link must activate that control normally.
  const focusedControl = event.target.closest?.("button, a");
  if (focusedControl && (event.key === "Enter" || event.key === " " || event.code === "Space")) {
    return;
  }

  event.preventDefault();
  const key = event.key.toLowerCase();
  if (key === " " || event.code === "Space") {
    whistle();
  } else if (key === "b") {
    chooseBranch();
  } else if (key === "v") {
    changeCamera();
  } else {
    // Every other unassigned key, including arrows and editing keys, means GO.
    boost();
  }
}

function drawMap() {
  if (!mapContext) return;
  const ctx = mapContext;
  const w = map.width, h = map.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#e6bf86";
  ctx.fillRect(0, 0, w, h);
  // The new branch stretches to x=32; keep all tracks inside the inset map.
  const scaleX = 2.5, scaleZ = 3.4;
  const mapXY = (pose) => [w * 0.48 + pose.x * scaleX, h * 0.5 + pose.z * scaleZ];
  function trace(route, start, end, sampleCount, lineWidth, colour) {
    ctx.beginPath();
    for (let i = 0; i <= sampleCount; i++) {
      const angle = start + (end - start) * i / sampleCount;
      const [x, y] = mapXY(getTrackPose(angle, route));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = colour;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }
  trace("main", 0, TAU, 260, 14, "#a36f43");
  trace("main", 0, TAU, 260, 6, "#f4d29c");
  trace("branch", BRANCH_START, BRANCH_END, 220, 14, state.branchSelected ? "#529b52" : "#a36f43");
  trace("branch", BRANCH_START, BRANCH_END, 220, 6, "#f4d29c");
  // The stop appears beside the long straight section.
  const [haltX, haltY] = mapXY(getTrackPose(BRANCH_STATION_ANGLE, "branch"));
  ctx.fillStyle = "#315d89";
  ctx.fillRect(haltX + 6, haltY - 12, 8, 24);
  ctx.fillStyle = "#253e52";
  ctx.font = "bold 10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("HALT", haltX, haltY - 18);
  trace("main", -0.47, 0.47, 42, 16, "#936035");
  trace("main", -0.47, 0.47, 42, 7, "#ffe1a9");

  const junction = mapXY(getTrackPose(BRANCH_START));
  ctx.fillStyle = state.branchSelected ? "#31a451" : "#e7a830";
  ctx.beginPath(); ctx.arc(junction[0], junction[1], 6.5, 0, TAU); ctx.fill();
  ctx.strokeStyle = "#fff9e5"; ctx.lineWidth = 2; ctx.stroke();

  [...WAGON_OFFSETS].reverse().forEach((offset, index) => {
    const t = getWagonAngle(state.angle, offset, state.branchTrip);
    const p = getTrackPose(t, routeForCar(t, state.branchTrip));
    const [x, y] = mapXY(p);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-p.heading);
    ctx.fillStyle = index === 0 ? "#8a59b3" : "#397fb8";
    ctx.fillRect(-5, -8, 10, 16);
    ctx.restore();
  });
  const enginePose = getTrackPose(state.angle, routeForCar(state.angle, state.branchTrip));
  const [engineX, engineY] = mapXY(enginePose);
  ctx.save();
  ctx.translate(engineX, engineY);
  ctx.rotate(-enginePose.heading);
  ctx.fillStyle = "#e04b33";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7, 7); ctx.lineTo(-7, 7); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function setVehiclePose(vehicle, angle) {
  const pose = getTrackPose(angle, routeForCar(angle, state.branchTrip));
  vehicle.group.position.set(pose.x, pose.y + 0.19, pose.z);
  vehicle.group.rotation.y = pose.heading;
  return pose;
}

function updateNotice() {
  if (performance.now() / 1000 < state.noticeUntil) return;
  if (state.speed < 0.07) {
    messageEl.textContent = "Press GO to start!";
  } else if (state.speed > MAX_SPEED * 0.75) {
    messageEl.textContent = "Zoom! 🚂";
  } else {
    messageEl.textContent = "Choo choo!";
  }
}

function followCamera(enginePose, deltaSeconds) {
  const mode = CAMERA_MODES[state.cameraMode];
  const dir = new THREE.Vector3(enginePose.tx, 0, enginePose.tz);
  const at = new THREE.Vector3(enginePose.x, enginePose.y, enginePose.z);
  let wanted;
  let looking;
  if (mode === "driver") {
    // Raise the driver's eyeline by 0.85 units for more track visibility.
    wanted = at.clone().addScaledVector(dir, 1.78).add(new THREE.Vector3(0, 3.45, 0));
    looking = at.clone().addScaledVector(dir, 13).add(new THREE.Vector3(0, 1.6, 0));
  } else if (mode === "overview") {
    wanted = new THREE.Vector3(42, 52, 54);
    looking = new THREE.Vector3(7, 0, 0);
  } else {
    // Three-quarter view from the front, so the friendly engine's face is
    // visible while it pulls its colourful carriages around the line.
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    wanted = at.clone().addScaledVector(dir, 8.0).addScaledVector(side, 4.6)
      .add(new THREE.Vector3(0, 4.25, 0));
    looking = at.clone().addScaledVector(dir, -0.5).add(new THREE.Vector3(0, 1.68, 0));
  }
  const alpha = 1 - Math.exp(-deltaSeconds * (mode === "driver" ? 9 : 4.8));
  camera.position.lerp(wanted, alpha);
  cameraTarget.lerp(looking, alpha);
  camera.lookAt(cameraTarget);
}

let renderer, railway, camera, scene, engine, wagons, smokeGeometry;
const cameraTarget = new THREE.Vector3();

function spawnSmoke() {
  if (state.smoke.length >= 22) return;
  const smokeMaterial = new THREE.MeshStandardMaterial({
    color: 0xf4f6f0, roughness: 1, transparent: true, opacity: 0.65,
    depthWrite: false,
  });
  const puff = new THREE.Mesh(smokeGeometry, smokeMaterial);
  const position = engine.group.localToWorld(engine.smokePoint.clone());
  puff.position.copy(position);
  puff.scale.setScalar(0.28);
  puff.castShadow = false;
  scene.add(puff);
  state.smoke.push({
    mesh: puff, age: 0, maxAge: 1.8,
    driftX: (Math.random() - 0.5) * 0.65,
    driftZ: (Math.random() - 0.5) * 0.65,
  });
}

function moveSmoke(dt) {
  for (let i = state.smoke.length - 1; i >= 0; i--) {
    const item = state.smoke[i];
    item.age += dt;
    if (item.age >= item.maxAge) {
      scene.remove(item.mesh);
      item.mesh.material.dispose();
      state.smoke.splice(i, 1);
      continue;
    }
    item.mesh.position.y += dt * 1.65;
    item.mesh.position.x += dt * item.driftX;
    item.mesh.position.z += dt * item.driftZ;
    item.mesh.scale.setScalar(0.28 + item.age * 0.62);
    item.mesh.material.opacity = Math.max(0, 0.60 * (1 - item.age / item.maxAge));
  }
}

function tick(dt) {
  const before = state.angle;
  const rise = (bridgeLift(state.angle + 0.02) - bridgeLift(state.angle)) / 0.02;
  state.speed = Math.max(0, state.speed - (DRAG + Math.max(0, rise) * 0.015) * dt);
  // Match the physical speed on the longer branch. It now takes more time
  // to complete than the direct loop instead of rushing past the station.
  const travelFactor = state.branchTrip && isOnBranchSection(before)
    ? BRANCH_SPEED_FACTOR : 1;
  state.angle = normaliseAngle(state.angle + state.speed * travelFactor * dt);

  const junctions = turnoutsForTrain(state, before, state.angle);
  state.branchTrip = junctions.branchTrip;
  if (junctions.entered) showNotice("Taking the branch line! 🚂");
  if (state.branchTrip && crossesAngle(before, state.angle, BRANCH_STATION_ANGLE)) {
    showNotice("Welcome to Bluebell Halt! 🚉", 2.5);
    makeTone(783.99, 0.24, 0.018, "sine");
    makeTone(1046.50, 0.33, 0.018, "sine", 0.24);
  }

  const enginePose = setVehiclePose(engine, state.angle);
  wagons.forEach((wagon, index) => {
    setVehiclePose(wagon, getWagonAngle(state.angle, WAGON_OFFSETS[index], state.branchTrip));
  });
  [engine, ...wagons].forEach((vehicle) => vehicle.wheels.forEach((wheel) => {
    wheel.rotation.x += state.speed * dt * 15;
  }));
  engine.group.updateMatrixWorld(true);

  if (state.speed > 0.08) {
    state.chuffProgress += state.speed * dt * 4.2;
    if (state.chuffProgress >= 1) {
      state.chuffProgress %= 1;
      makeTone(96, 0.12, 0.014, "triangle");
    }
    state.smokeTimer -= dt;
    if (state.smokeTimer <= 0) {
      spawnSmoke();
      state.smokeTimer = 0.30;
    }
  } else {
    state.smokeTimer = 0;
  }
  moveSmoke(dt);
  if (engine.eyes?.length) {
    state.blinkTimer -= dt;
    if (state.blinkTimer <= 0) {
      state.blinkRemaining = 0.13;
      state.blinkTimer = 3.5 + Math.random() * 3.3;
    }
    state.blinkRemaining = Math.max(0, state.blinkRemaining - dt);
    const eyeHeight = state.blinkRemaining > 0 ? 0.12 : 1;
    engine.eyes.forEach((eye) => { eye.scale.y = eyeHeight; });
  }
  followCamera(enginePose, dt);
  const currentRoute = routeForCar(state.angle, state.branchTrip);
  routeEl.textContent = currentRoute === "branch" ? "↗ Branch line" : "↝ Main line";
  speedEl.textContent = String(Math.round(state.speed / MAX_SPEED * 9));
  updateNotice();
  drawMap();
}

function resize() {
  if (!renderer) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

async function start() {
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(57, 1, 0.1, 250);
    camera.position.set(-30, 11, 15);
    cameraTarget.set(0, 1.2, 0);
    railway = createToyRailway(scene);
    showNotice("Loading the friendly 3D train…", 8);
    const models = await loadStorybookTrain();
    engine = models.engine;
    wagons = models.wagons;
    state.modelFormat = models.format;
    scene.add(engine.group, ...wagons.map((wagon) => wagon.group));
    smokeGeometry = new THREE.SphereGeometry(1, 10, 8);
    setVehiclePose(engine, state.angle);
    wagons.forEach((wagon, i) => setVehiclePose(wagon,
      getWagonAngle(state.angle, WAGON_OFFSETS[i], state.branchTrip)));
    followCamera(getTrackPose(state.angle, routeForCar(state.angle, state.branchTrip)), 2);
    resize();
    drawMap();
    showNotice("Press GO to start!", 3);
  } catch (error) {
    console.error("3D train initialisation failed", error);
    failureEl.hidden = false;
    showNotice("3D graphics unavailable");
    return;
  }

  document.getElementById("train3d-go").addEventListener("click", boost);
  document.getElementById("train3d-whistle").addEventListener("click", whistle);
  branchEl.addEventListener("click", chooseBranch);
  viewEl.addEventListener("click", changeCamera);
  canvas.addEventListener("pointerdown", boost);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("resize", resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    failureEl.hidden = false;
    showNotice("3D graphics interrupted");
  });

  function frame(timestamp) {
    state.frameCount += 1;
    const dt = state.lastFrame ? Math.min(0.05, (timestamp - state.lastFrame) / 1000) : 0;
    state.lastFrame = timestamp;
    // Render normally while the fallback/error panel is hidden.
    if (!document.hidden && failureEl.hidden) {
      tick(dt);
      renderer.render(scene, camera);
      state.renderCount += 1;
    }
    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);

  window.train3D = {
    getState() {
      return {
        angle: state.angle,
        speed: state.speed,
        boostCount: state.boostCount,
        branchSelected: state.branchSelected,
        branchTrip: state.branchTrip,
        route: routeForCar(state.angle, state.branchTrip),
        view: CAMERA_MODES[state.cameraMode],
        trackShape: "figure-eight",
        renderer: "three.js",
        modelFormat: state.modelFormat,
      };
    },
    getDebug() {
      const viewDirection = new THREE.Vector3();
      camera.getWorldDirection(viewDirection);
      const track = getTrackPose(state.angle, routeForCar(state.angle, state.branchTrip));
      return {
        frameCount: state.frameCount, renderCount: state.renderCount,
        isHidden: document.hidden, fallbackHidden: failureEl.hidden,
        camera: camera.position.toArray(), direction: viewDirection.toArray(),
        cameraTarget: cameraTarget.toArray(), enginePosition: engine.group.position.toArray(),
        sceneChildren: scene.children.length,
        branchLength: BRANCH_LENGTH,
        stationPresent: Boolean(scene.getObjectByName("Bluebell Halt branch station")),
        track, canvasWidth: canvas.width, canvasHeight: canvas.height,
        sceneBackground: scene.background.getHexString(),
        drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      };
    },
    boost, chooseBranch, changeCamera, whistle,
  };
}
start();
