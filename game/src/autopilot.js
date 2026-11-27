// autopilot.js — the demo pilot: steers the aeroplane towards its current
// objective (the next ring, then the runway) so the game can be tested and
// photographed headlessly with ?demo=1. A two-loop pilot: it picks a gentle
// target bank from the heading error, then drives the bank towards it, and
// pitches towards the target height — slower near a ring, so the turn fits
// through it. It flies each ring on its approach line, then the landing
// circuit, so the whole sortie completes on its own.
import { RING_COURSE } from './terrain.js';

/** The gate sits this far before a ring on its approach line. */
const GATE_DIST = 180;

/** A 2D direction (x, z) normalised to length 1. */
function norm2D(x, z) {
  const len = Math.hypot(x, z) || 1;
  return { x: x / len, z: z / len };
}

// The approach mode is the pilot's own memory: once it commits to the lead
// point it stays committed, so the target cannot flip-flop at the boundary
// and make the aeroplane orbit the gate.
let approachRing = -1;
let approachMode = 'gate';

/** Returns the input for this frame: { pitch, bank, throttleUp, throttleDown, flaps }. */
export function autopilotInput(state, missions) {
  const input = { pitch: 0, bank: 0, throttleUp: false, throttleDown: false, flaps: false };
  let target;
  let wantSpeed = 52;

  if (missions.phase === 'rings') {
    if (missions.ringIndex !== approachRing) {
      approachRing = missions.ringIndex;
      approachMode = 'gate';
    }
    const ring = RING_COURSE[missions.ringIndex];
    const prev = missions.ringIndex === 0 ? { x: -470, z: 0 } : RING_COURSE[missions.ringIndex - 1];
    // The approach line runs from the previous ring through this one, so the
    // aeroplane arrives already flying along it: first the gate 180 m
    // before the ring, then the ring itself. The turn to the next ring
    // happens in open air after the ring, never in a hairpin before it.
    // The commitment sticks until the ring is far behind, so the target
    // cannot flip-flop at the gate boundary; and if the plane flies past
    // the ring without clearing it, the pass is blown and it goes around
    // to the gate for another try.
    const approach = norm2D(ring.x - prev.x, ring.z - prev.z);
    const gate = { x: ring.x - approach.x * GATE_DIST, y: ring.y, z: ring.z - approach.z * GATE_DIST };
    const distToGate = Math.hypot(gate.x - state.x, gate.y - state.y, gate.z - state.z);
    const distToRing = Math.hypot(ring.x - state.x, ring.y - state.y, ring.z - state.z);
    const pastRing = (state.x - ring.x) * approach.x + (state.z - ring.z) * approach.z;
    if (approachMode === 'gate' && distToGate < 100) approachMode = 'ring';
    if (approachMode === 'ring' && distToRing > 300) approachMode = 'gate';
    if (approachMode === 'ring' && pastRing > 0 && distToRing < 150) approachMode = 'gate';
    target = approachMode === 'gate' ? gate : ring;
    if (distToRing < 250) wantSpeed = 36;
  } else {
    // Landing: fly the circuit — climb out south, downwind east along the
    // harbour, base turn, then final westbound down the runway. The final
    // follows a glide path whose target is always 200 m ahead, so the
    // aeroplane can never orbit it — it just rides the slope down and
    // touches down where it gets there.
    if (missions.landingLeg === undefined) missions.landingLeg = 0;
    const legTargets = [
      { x: -300, y: 60, z: 150, speed: 45, capture: 80 },
      { x: 550, y: 45, z: 180, speed: 45, capture: 100 },
      { x: 650, y: 30, z: 40, speed: 40, capture: 80 },
    ];
    if (missions.landingLeg < 3) {
      const leg = legTargets[missions.landingLeg];
      target = { x: leg.x, y: leg.y, z: leg.z };
      wantSpeed = leg.speed;
      const d = Math.hypot(leg.x - state.x, leg.y - state.y, leg.z - state.z);
      if (d < leg.capture) missions.landingLeg += 1;
    } else {
      // Final, westbound: never descend until lined up on the centreline —
      // hold a safe height and steer onto it first, then ride the glide
      // path down. The path sits below the touchdown height so the
      // aeroplane keeps descending through it and lands.
      let headingToWest = -Math.PI / 2 - state.heading;
      while (headingToWest > Math.PI) headingToWest -= Math.PI * 2;
      while (headingToWest < -Math.PI) headingToWest += Math.PI * 2;
      const linedUp = Math.abs(headingToWest) < 0.35 && Math.abs(state.z) < 20;
      if (linedUp) {
        const aheadX = state.x - 200;
        const pathY = 1 + Math.max(0, aheadX - 200) * 0.05;
        target = { x: aheadX, y: pathY, z: 0 };
      } else {
        target = { x: state.x - 200, y: Math.max(state.y, 25), z: 0 };
      }
      wantSpeed = 36;
    }
  }

  if (state.onGround) {
    if (missions.phase === 'landing') {
      // Rolling out after touchdown: stay down, ease off the throttle, let
      // the speed bleed away so the landing can be judged.
      input.pitch = -0.2;
      input.throttleDown = true;
      input.flaps = true;
      return input;
    }
    // Takeoff roll: full throttle, rotate once past rotation speed.
    input.throttleUp = true;
    input.pitch = state.speed > 28 ? 1 : 0;
    return input;
  }

  const dx = target.x - state.x;
  const dz = target.z - state.z;
  const dy = target.y - state.y;
  const wantHeading = Math.atan2(dx, -dz);
  let headingError = wantHeading - state.heading;
  while (headingError > Math.PI) headingError -= Math.PI * 2;
  while (headingError < -Math.PI) headingError += Math.PI * 2;
  // Two-loop steering: pick a gentle target bank from the heading error,
  // then drive the bank towards it. Commanding full bank straight from the
  // heading error makes the aeroplane slalom — the bank loop damps it.
  // Turning left lowers the heading, so a negative heading error needs
  // positive (left) bank.
  const bankDesired = Math.max(-0.7, Math.min(0.7, -headingError * 0.9));
  input.bank = Math.max(-1, Math.min(1, (bankDesired - state.bank) * 2.0));
  // On the glide path the descent stays gentle so the touchdown is soft.
  const pitchLimit = missions.phase === 'landing' ? 0.18 : 0.22;
  const wantPitch = Math.max(-pitchLimit, Math.min(pitchLimit, dy * 0.012));
  input.pitch = Math.max(-1, Math.min(1, (wantPitch - state.pitch) * 2));

  if (state.speed < wantSpeed - 3) {
    input.throttleUp = true;
  } else if (state.speed > wantSpeed + 3) {
    input.throttleDown = true;
  }
  input.flaps = missions.phase === 'landing' && state.speed > 42;
  return input;
}
