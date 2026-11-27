// missions.js — the sortie: six target rings in order, a judged runway landing,
// fuel that turns the sortie into decisions, and the score. One mission at a time.
import * as THREE from 'three';
import { RING_COURSE, REFUEL_RING, RUNWAY } from './terrain.js';
import { speedKnots } from './flight.js';

export const RING_POINTS = 100;
export const LANDING_POINTS = 250;
export const REFUEL_POINTS = 25;

/** Fresh mission state for a new sortie. */
export function createMissions() {
  return {
    phase: 'rings', // rings -> landing -> done
    ringIndex: 0,
    ringsPassed: 0,
    score: 0,
    timeSeconds: 0,
    bestScore: Number(localStorage.getItem('harbourRunBest') || 0),
    landed: false,
    landingQuality: '',
    message: '',
    messageUntil: 0,
    finished: false,
    lastRefuelAt: -100,
  };
}

function flashMessage(m, text, seconds, now) {
  m.message = text;
  m.messageUntil = now + seconds;
}

/** Builds the glowing ring meshes (course rings + the green refuel ring). */
export function buildRings(scene) {
  const group = new THREE.Group();
  const ringMeshes = RING_COURSE.map((ring, i) => {
    const geo = new THREE.TorusGeometry(ring.r, 0.9, 12, 40);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(ring.x, ring.y, ring.z);
    // Face each ring along its approach line, so the pilot flies through it
    // square-on: the disc is perpendicular to the direction from the
    // previous ring (or from the runway threshold for the first ring).
    const prev = i === 0 ? { x: -470, y: 3, z: 0 } : RING_COURSE[i - 1];
    const dx = ring.x - prev.x;
    const dz = ring.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    mesh.lookAt(ring.x + (dx / len) * 100, ring.y, ring.z + (dz / len) * 100);
    mesh.userData.courseIndex = i;
    group.add(mesh);
    // A soft halo so the ring reads from far away.
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(ring.r + 2.5, 0.35, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.35 }),
    );
    halo.position.copy(mesh.position);
    halo.quaternion.copy(mesh.quaternion);
    group.add(halo);
    return mesh;
  });
  const refuel = new THREE.Mesh(
    new THREE.TorusGeometry(REFUEL_RING.r, 1.1, 12, 40),
    new THREE.MeshBasicMaterial({ color: 0x37e08a, transparent: true, opacity: 0.95 }),
  );
  refuel.position.set(REFUEL_RING.x, REFUEL_RING.y, REFUEL_RING.z);
  refuel.lookAt(-100, 30, 0);
  refuel.userData.refuel = true;
  group.add(refuel);
  const refuelHalo = new THREE.Mesh(
    new THREE.TorusGeometry(REFUEL_RING.r + 2.5, 0.4, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0x37e08a, transparent: true, opacity: 0.3 }),
  );
  refuelHalo.position.copy(refuel.position);
  refuelHalo.quaternion.copy(refuel.quaternion);
  group.add(refuelHalo);
  scene.add(group);
  return { group, ringMeshes, refuel };
}

/** Marks a ring as passed: hides it and turns the next one bright. */
function markRingPassed(meshes, index) {
  const mesh = meshes[index];
  if (mesh) mesh.visible = false;
  const next = meshes[index + 1];
  if (next) next.material.color.set(0xffd27a);
}

/** Scores a landing: centreline, speed and descent all count. */
export function judgeLanding(state, m, now) {
  const centreError = Math.abs(state.z - RUNWAY.zCentre);
  const kt = speedKnots(state);
  const sink = -state.verticalSpeed;
  let points = LANDING_POINTS;
  let verdict = 'Smooth landing';
  if (centreError > 10) {
    points -= 80;
    verdict = 'Off centreline';
  } else if (centreError > 5) {
    points -= 30;
    verdict = 'Good landing';
  }
  if (kt > 95) {
    points -= 60;
    verdict = 'Too fast on touchdown';
  } else if (kt < 45) {
    points -= 30;
    verdict = 'Slow touchdown';
  }
  if (sink > 5) {
    points -= 70;
    verdict = 'Hard landing';
  }
  points = Math.max(50, points);
  m.score += points;
  m.landed = true;
  m.landingQuality = verdict;
  m.phase = 'done';
  m.finished = true;
  state.fuel = 100;
  if (m.score > m.bestScore) {
    m.bestScore = m.score;
    localStorage.setItem('harbourRunBest', String(m.bestScore));
  }
  flashMessage(m, `${verdict}! +${points} pts — sortie complete`, 6, now);
  return points;
}

/** One mission step: ring checks, refuel checks, landing checks, timer. */
export function updateMissions(state, m, rings, dt, now) {
  m.timeSeconds += dt;
  if (m.message && now > m.messageUntil) m.message = '';

  // Refuel ring: green, always live — flying through it tops the tank up,
  // but only when the tank is actually low, and at most once every 20 s,
  // so it cannot be farmed for points.
  if (rings.refuel.visible) {
    const d = Math.hypot(state.x - REFUEL_RING.x, state.y - REFUEL_RING.y, state.z - REFUEL_RING.z);
    if (d < REFUEL_RING.r && state.fuel < 85 && now - m.lastRefuelAt > 20) {
      state.fuel = 100;
      m.lastRefuelAt = now;
      m.score += REFUEL_POINTS;
      flashMessage(m, `Refuelled! +${REFUEL_POINTS} pts`, 3, now);
    }
  }

  if (m.phase === 'rings') {
    const ring = RING_COURSE[m.ringIndex];
    const d = Math.hypot(state.x - ring.x, state.y - ring.y, state.z - ring.z);
    if (d < ring.r * 0.95) {
      m.score += RING_POINTS;
      m.ringsPassed += 1;
      markRingPassed(rings.ringMeshes, m.ringIndex);
      if (m.ringIndex >= RING_COURSE.length - 1) {
        m.phase = 'landing';
        flashMessage(m, 'All rings clear! Now land on runway 09', 5, now);
      } else {
        flashMessage(m, `${ring.name} clear! +${RING_POINTS} pts`, 3, now);
      }
      m.ringIndex += 1;
    }
  }

  // Landing: the plane is on the runway, slow and settled.
  if (m.phase === 'landing' && state.onGround && !state.crashed && !m.finished) {
    const overRunway =
      state.x >= RUNWAY.xMin && state.x <= RUNWAY.xMax && Math.abs(state.z - RUNWAY.zCentre) < RUNWAY.halfWidth;
    if (overRunway && state.speed < 40 && state.speed > 8) {
      judgeLanding(state, m, now);
    }
  }

  // Rolling off the runway at speed is a crash, not a taxi.
  if (state.onGround && !state.crashed && !m.finished) {
    const overRunway =
      state.x >= RUNWAY.xMin && state.x <= RUNWAY.xMax && Math.abs(state.z - RUNWAY.zCentre) < RUNWAY.halfWidth;
    if (!overRunway && state.speed > 15) {
      state.crashed = true;
      state.crashReason = 'Ran off the runway';
    }
  }

  // A hard touchdown on the runway is a crash, not a landing.
  if (state.onGround && !state.crashed && !m.finished && m.phase !== 'done') {
    const overRunway =
      state.x >= RUNWAY.xMin && state.x <= RUNWAY.xMax && Math.abs(state.z - RUNWAY.zCentre) < RUNWAY.halfWidth;
    if (overRunway && state.verticalSpeed < -6) {
      state.crashed = true;
      state.crashReason = 'Hard landing — the gear gave way';
    }
  }
}

/** The mission line the HUD shows: what to do next. */
export function missionText(m) {
  if (m.finished) return `Sortie complete — ${m.landingQuality}`;
  if (m.phase === 'landing') return 'Land on runway 09 — slow, centred, gentle';
  const ring = RING_COURSE[Math.min(m.ringIndex, RING_COURSE.length - 1)];
  return `Ring ${m.ringIndex + 1}/6 — ${ring.name}`;
}

/** mm:ss clock for the HUD. */
export function formatTime(seconds) {
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
