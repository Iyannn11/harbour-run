// flight.js — the aeroplane's flight model: arcade physics with real feel.
// Speed follows throttle, pitch trades speed for climb, bank turns the plane,
// controls soften near stall and sharpen at speed, and a slow plane sinks.
import { terrainHeightAt, RUNWAY } from './terrain.js';

export const FLIGHT_TUNING = {
  maxSpeed: 72, // m/s at full throttle (~140 kt)
  minSpeed: 12, // m/s at idle
  stallSpeed: 24, // below this the wing stops flying and the nose drops
  maxBank: 1.05, // radians (~60 deg)
  maxPitch: 0.42, // radians (~24 deg)
  bankRate: 1.9, // rad/s at full stick
  pitchRate: 0.9, // rad/s at full stick
  accel: 7, // m/s^2 towards target speed
  fuelBurnFull: 0.34, // % per second at full throttle
  fuelBurnIdle: 0.10, // % per second at idle
};

/** A fresh aeroplane on the runway threshold, ready for takeoff. */
export function createFlightState() {
  return {
    x: -470,
    y: RUNWAY.height + 1.6,
    z: RUNWAY.zCentre,
    heading: Math.PI / 2, // east, down runway 09
    pitch: 0,
    bank: 0,
    speed: 0,
    throttle: 0,
    fuel: 100,
    verticalSpeed: 0,
    onGround: true,
    crashed: false,
    crashReason: '',
  };
}

/** Sets a flight state airborne at a chosen spot (used by the demo/screenshot modes). */
export function placeAirborne(state, { x, y, z, headingDeg, speed, throttle }) {
  state.x = x;
  state.y = y;
  state.z = z;
  state.heading = (headingDeg * Math.PI) / 180;
  state.pitch = 0;
  state.bank = 0;
  state.speed = speed;
  state.throttle = throttle;
  state.onGround = false;
  state.verticalSpeed = 0;
}

/** One physics step. `input` is { pitch, bank, throttleUp, throttleDown, flaps }. */
export function updateFlight(state, input, dt) {
  if (state.crashed) return;
  const t = FLIGHT_TUNING;

  // Throttle lever.
  if (input.throttleUp) state.throttle = Math.min(1, state.throttle + dt * 0.55);
  if (input.throttleDown) state.throttle = Math.max(0, state.throttle - dt * 0.55);

  // Speed chases the throttle, slower when climbing, quicker when diving.
  let target = t.minSpeed + state.throttle * (t.maxSpeed - t.minSpeed);
  target -= Math.sin(state.pitch) * 14;
  if (input.flaps) target *= 0.82;
  const rate = target > state.speed ? t.accel : t.accel * 1.4;
  state.speed += Math.max(-rate * dt, Math.min(rate * dt, target - state.speed));

  // Controls: authority grows with speed, fades near stall.
  const authority = Math.min(1, Math.max(0.25, state.speed / 45));
  if (!state.onGround) {
    state.bank += input.bank * t.bankRate * authority * dt;
    state.bank = Math.max(-t.maxBank, Math.min(t.maxBank, state.bank));
    state.pitch += input.pitch * t.pitchRate * authority * dt;
    state.pitch = Math.max(-t.maxPitch, Math.min(t.maxPitch, state.pitch));
    // Hands off the stick: wings level themselves gently, pitch eases to level.
    if (input.bank === 0) state.bank *= Math.max(0, 1 - dt * 0.8);
    if (input.pitch === 0) state.pitch *= Math.max(0, 1 - dt * 0.5);
    // Bank turns the aeroplane: heading follows bank. The turn rate has a
    // fixed bite plus a speed term, so the turn stays tight enough to thread
    // a ring even when slow.
    state.heading += -state.bank * (0.3 + state.speed / 48) * dt;
  } else {
    // On the ground the plane rolls straight down the runway; it lifts off at rotation speed.
    state.bank = 0;
    state.pitch = 0;
    if (state.speed > 30 && input.pitch > 0) {
      state.onGround = false;
      state.pitch = 0.12;
    }
  }

  // Vertical motion: pitch climbs, gravity sinks a slow aeroplane.
  const climb = Math.sin(state.pitch) * state.speed;
  const sink = state.speed < t.stallSpeed && !state.onGround ? (t.stallSpeed - state.speed) * 0.35 : 0;
  state.verticalSpeed = climb - sink;
  const forwardX = Math.sin(state.heading);
  const forwardZ = -Math.cos(state.heading);
  state.x += forwardX * Math.cos(state.pitch) * state.speed * dt;
  state.z += forwardZ * Math.cos(state.pitch) * state.speed * dt;
  state.y += state.verticalSpeed * dt;

  // Fuel burns with throttle; an empty tank means the engine is out.
  const burn = t.fuelBurnIdle + state.throttle * (t.fuelBurnFull - t.fuelBurnIdle);
  state.fuel = Math.max(0, state.fuel - burn * dt);
  if (state.fuel <= 0 && state.throttle > 0) state.throttle = 0;

  // World bounds: the bay is big, but turn back before the edge of the map.
  state.x = Math.max(-1100, Math.min(1100, state.x));
  state.z = Math.max(-900, Math.min(900, state.z));
  state.y = Math.min(420, state.y);

  // Ground and sea contact.
  const ground = terrainHeightAt(state.x, state.z);
  if (state.y <= ground + 1.5) {
    state.y = ground + 1.5;
    const overRunway =
      state.x >= RUNWAY.xMin && state.x <= RUNWAY.xMax && Math.abs(state.z - RUNWAY.zCentre) < RUNWAY.halfWidth;
    if (overRunway && !state.onGround) {
      // Touchdown is judged by the mission module, not here; mark ground contact.
      state.onGround = true;
    } else if (!state.onGround) {
      state.crashed = true;
      state.crashReason = ground <= 0.6 ? 'Ditched in the sea' : 'Hit the terrain';
    } else {
      state.onGround = true;
    }
  }
}

/** Airspeed in knots for the HUD. */
export function speedKnots(state) {
  return Math.round(state.speed * 1.944);
}

/** Altitude above the ground in feet for the HUD. */
export function altitudeFeet(state) {
  return Math.round(Math.max(0, state.y - terrainHeightAt(state.x, state.z)) * 3.281);
}

/** Compass heading in degrees (0 = north, 90 = east). */
export function headingDegrees(state) {
  let deg = (state.heading * 180) / Math.PI;
  deg = ((deg % 360) + 360) % 360;
  return Math.round(deg);
}
