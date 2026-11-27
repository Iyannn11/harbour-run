// main.js — HARBOUR RUN bootstrap: renderer, chase camera, keyboard + mouse
// input, the game loop, screens, and a demo autopilot (?demo=1) that flies the
// sortie itself so the game can be tested and photographed headlessly.
import * as THREE from 'three';
import { buildTerrain, animateTerrain } from './terrain.js';
import { buildAircraft, updateAircraftVisual } from './aircraft.js';
import { createFlightState, placeAirborne, updateFlight } from './flight.js';
import { createMissions, buildRings, updateMissions } from './missions.js';
import { createHud, updateHud, showScreen, fillEndScreen } from './hud.js';
import { createAudio } from './audio.js';
import { autopilotInput } from './autopilot.js';

const params = new URLSearchParams(location.search);
const DEMO = params.get('demo') === '1';
const SHOT = params.get('shot') || '';
const LOW_QUALITY = params.get('quality') === 'low';

const renderer = new THREE.WebGLRenderer({ antialias: !LOW_QUALITY, canvas: document.getElementById('scene') });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(-490, 30, 40);

const terrainBits = buildTerrain(scene);
const plane = buildAircraft();
scene.add(plane);
let ringSet = buildRings(scene);

const hud = createHud();
const state = createFlightState();
const missions = createMissions();
let audio = null;

let gameState = 'menu'; // menu | flying | crashed | done
let endShownAt = 0;
let lastRingCount = 0;
let crashThudded = false;

// --- input ---------------------------------------------------------------
const keys = new Set();
const input = { pitch: 0, bank: 0, throttleUp: false, throttleDown: false, flaps: false };
let mouseOrbit = { yaw: 0, pitch: 0 };
let dragging = false;
let lastMouse = { x: 0, y: 0 };

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  keys.add(e.key.toLowerCase());
  if (e.key === ' ' && gameState === 'menu') startFlying();
  if (e.key.toLowerCase() === 'r' && (gameState === 'crashed' || gameState === 'done')) restart();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

const canvas = document.getElementById('scene');
canvas.addEventListener('mousedown', (e) => {
  dragging = true;
  lastMouse = { x: e.clientX, y: e.clientY };
});
window.addEventListener('mouseup', () => {
  dragging = false;
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  mouseOrbit.yaw -= (e.clientX - lastMouse.x) * 0.003;
  mouseOrbit.pitch = Math.max(-0.5, Math.min(0.5, mouseOrbit.pitch + (e.clientY - lastMouse.y) * 0.003));
  lastMouse = { x: e.clientX, y: e.clientY };
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
document.addEventListener('visibilitychange', () => {
  if (!audio) return;
  if (document.hidden) audio.mute();
  else audio.unmute();
});

function readInput() {
  // W / Up pulls up, S / Down pushes down; A / Left banks left, D / Right banks right.
  input.pitch = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
  input.bank = (keys.has('a') || keys.has('arrowleft') ? 1 : 0) - (keys.has('d') || keys.has('arrowright') ? 1 : 0);
  input.throttleUp = keys.has('r') || keys.has('shift');
  input.throttleDown = keys.has('f') || keys.has('control');
  input.flaps = keys.has(' ');
  if (DEMO) Object.assign(input, autopilotInput(state, missions));
}

// --- screens and flow -----------------------------------------------------
function startFlying() {
  if (audio) audio.resume();
  gameState = 'flying';
  showScreen('');
}

function restart() {
  scene.remove(ringSet.group);
  ringSet = buildRings(scene);
  Object.assign(state, createFlightState());
  Object.assign(missions, createMissions());
  missions.bestScore = Number(localStorage.getItem('harbourRunBest') || 0);
  lastRingCount = 0;
  crashThudded = false;
  plane.position.set(state.x, state.y, state.z);
  plane.rotation.set(0, 0, 0);
  gameState = 'flying';
  showScreen('');
  if (audio) audio.resume();
}

function showCrash() {
  gameState = 'crashed';
  fillEndScreen('crash', state, missions);
  showScreen('screen-crash');
  endShownAt = performance.now();
}

function showDone() {
  gameState = 'done';
  fillEndScreen('done', state, missions);
  showScreen('screen-done');
  endShownAt = performance.now();
}

document.getElementById('btn-start').addEventListener('click', () => {
  if (!audio) audio = createAudio();
  audio.resume();
  startFlying();
});
for (const id of ['btn-restart-crash', 'btn-restart-done']) {
  document.getElementById(id).addEventListener('click', restart);
}
document.getElementById('btn-menu-done').addEventListener('click', () => {
  gameState = 'menu';
  showScreen('screen-start');
});

// --- screenshot start states ----------------------------------------------
function applyShotPreset() {
  if (SHOT === 'cover') {
    placeAirborne(state, { x: -430, y: 48, z: 30, headingDeg: 118, speed: 52, throttle: 0.72 });
  } else if (SHOT === 'rings') {
    placeAirborne(state, { x: -180, y: 70, z: -120, headingDeg: 165, speed: 55, throttle: 0.75 });
    missions.ringIndex = 2;
    missions.ringsPassed = 2;
    missions.score = 200;
    ringSet.ringMeshes[0].visible = false;
    ringSet.ringMeshes[1].visible = false;
  } else if (SHOT === 'skyline') {
    placeAirborne(state, { x: 120, y: 95, z: 320, headingDeg: 345, speed: 50, throttle: 0.7 });
  } else if (SHOT === 'landing') {
    placeAirborne(state, { x: -620, y: 26, z: 4, headingDeg: 90, speed: 46, throttle: 0.35 });
    missions.phase = 'landing';
    missions.ringIndex = 6;
    missions.ringsPassed = 6;
    missions.score = 600;
    for (const mesh of ringSet.ringMeshes) mesh.visible = false;
  } else if (SHOT === 'final') {
    // Test-only start: already on final approach, ~300 m out, lined up on
    // runway 09, so the touchdown + sortie-complete screen can be checked
    // quickly in a slow headless browser.
    placeAirborne(state, { x: 300, y: 20, z: 0, headingDeg: 270, speed: 40, throttle: 0.3 });
    missions.phase = 'landing';
    missions.landingLeg = 3;
    missions.ringIndex = 6;
    missions.ringsPassed = 6;
    missions.score = 600;
    for (const mesh of ringSet.ringMeshes) mesh.visible = false;
  }
}

// --- camera ----------------------------------------------------------------
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3(-490, 30, 40);
function updateCamera(dt) {
  const heading = state.heading;
  const fx = Math.sin(heading);
  const fz = -Math.cos(heading);
  // Chase: behind and above the plane, with the mouse orbit offset.
  const back = 13.5;
  const up = 4.4;
  const orbitYaw = mouseOrbit.yaw;
  const ox = -fx * Math.cos(orbitYaw) - fz * Math.sin(orbitYaw);
  const oz = -fz * Math.cos(orbitYaw) + fx * Math.sin(orbitYaw);
  const desired = new THREE.Vector3(
    state.x + ox * back,
    state.y + up + mouseOrbit.pitch * 6,
    state.z + oz * back,
  );
  const k = 1 - Math.exp(-dt * 5.5);
  // Snap the chase camera into place when it is far from the plane (first
  // frame, preset jumps, restarts) so the view is a proper chase view at
  // once; otherwise ease it in smoothly behind the aircraft.
  if (camPos.distanceTo(desired) > 40) {
    camPos.copy(desired);
  } else {
    camPos.lerp(desired, k);
  }
  camera.position.copy(camPos);
  camTarget.set(state.x + fx * 22, state.y + 1 + Math.sin(state.pitch) * 10, state.z + fz * 22);
  camera.lookAt(camTarget);
}

// --- main loop --------------------------------------------------------------
let lastTime = performance.now();
let elapsed = 0;
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  elapsed += dt;

  animateTerrain(terrainBits, elapsed, dt);

  if (gameState === 'flying') {
    readInput();
    updateFlight(state, input, dt);
    updateMissions(state, missions, ringSet, dt, elapsed);
    if (missions.ringsPassed > lastRingCount) {
      lastRingCount = missions.ringsPassed;
      if (audio) audio.ringChime();
    }
    if (audio) audio.update(state.throttle, state.speed);
    if (state.crashed) {
      if (audio && !crashThudded) {
        audio.thud(true);
        crashThudded = true;
      }
      showCrash();
    } else if (missions.finished) {
      if (audio) audio.thud(false);
      showDone();
    }
  }

  // Pose the aeroplane from the flight state.
  plane.position.set(state.x, state.y, state.z);
  plane.rotation.order = 'YXZ';
  plane.rotation.y = -state.heading;
  plane.rotation.x = state.pitch;
  plane.rotation.z = -state.bank;
  updateAircraftVisual(plane, { rpm: 8 + state.throttle * 26, bank: state.bank, pitch: state.pitch, dt });

  updateCamera(dt);
  updateHud(hud, state, missions, elapsed);
  renderer.render(scene, camera);
}

// --- boot -------------------------------------------------------------------
if (DEMO) {
  if (!audio) audio = createAudio();
  applyShotPreset();
  gameState = 'flying';
  showScreen('');
} else {
  document.getElementById('best-start').textContent = String(missions.bestScore);
  showScreen('screen-start');
}
updateHud(hud, state, missions, 0);
requestAnimationFrame(tick);

// Test hook: headless checks read the live state through this.
window.__harbourRun = { state, missions, get gameState() { return gameState; }, startFlying, restart };
