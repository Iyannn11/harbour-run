// hud.js — the instrument panel: altitude, airspeed, heading, throttle, fuel,
// score, timer and mission line, plus the attitude ball and the compass strip.
import { speedKnots, altitudeFeet, headingDegrees } from './flight.js';
import { missionText, formatTime } from './missions.js';

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Grabs the HUD elements by id; call once after the page loads. */
export function createHud() {
  const byId = (id) => document.getElementById(id);
  return {
    alt: byId('hud-alt'),
    speed: byId('hud-speed'),
    heading: byId('hud-heading'),
    compass: byId('hud-compass'),
    throttle: byId('hud-throttle'),
    throttleBar: byId('hud-throttle-bar'),
    fuel: byId('hud-fuel'),
    fuelBar: byId('hud-fuel-bar'),
    score: byId('hud-score'),
    best: byId('hud-best'),
    timer: byId('hud-timer'),
    mission: byId('hud-mission'),
    flash: byId('hud-flash'),
    horizon: byId('hud-horizon'),
    horizonBall: byId('hud-horizon-ball'),
    stall: byId('hud-stall'),
    fuelWarn: byId('hud-fuel-warn'),
  };
}

/** Refreshes every instrument from the flight and mission state. */
export function updateHud(hud, state, m, now) {
  const kt = speedKnots(state);
  const alt = altitudeFeet(state);
  const hdg = headingDegrees(state);
  hud.alt.textContent = `${alt.toLocaleString('en-US')} ft`;
  hud.speed.textContent = `${kt} kt`;
  const point = COMPASS_POINTS[Math.round(hdg / 45) % 8];
  hud.heading.textContent = `${String(hdg).padStart(3, '0')}° ${point}`;
  hud.compass.textContent = `— ${String((hdg + 315) % 360).padStart(3, '0')} · ${String(hdg).padStart(3, '0')} · ${String((hdg + 45) % 360).padStart(3, '0')} —`;
  hud.throttle.textContent = `${Math.round(state.throttle * 100)}%`;
  hud.throttleBar.style.width = `${Math.round(state.throttle * 100)}%`;
  hud.fuel.textContent = `${Math.round(state.fuel)}%`;
  hud.fuelBar.style.width = `${Math.round(state.fuel)}%`;
  hud.fuelBar.classList.toggle('low', state.fuel < 25);
  hud.score.textContent = String(m.score);
  hud.best.textContent = String(m.bestScore);
  hud.timer.textContent = formatTime(m.timeSeconds);
  hud.mission.textContent = missionText(m);
  if (m.message && now < m.messageUntil) {
    hud.flash.textContent = m.message;
    hud.flash.classList.add('show');
  } else {
    hud.flash.classList.remove('show');
  }
  // Attitude ball: rolls with bank (left bank tilts the horizon's left side up),
  // slides down with pitch. The frame around it stays fixed to the aeroplane.
  hud.horizonBall.style.transform = `rotate(${state.bank}rad) translateY(${state.pitch * 90}px)`;
  hud.stall.classList.toggle('show', !state.onGround && state.speed < 26);
  hud.fuelWarn.classList.toggle('show', state.fuel < 20 && !m.finished);
}

/** Shows the start screen, crash screen or sortie-complete screen. */
export function showScreen(id) {
  for (const screen of document.querySelectorAll('.screen')) screen.classList.remove('show');
  const el = document.getElementById(id);
  if (el) el.classList.add('show');
}

/** Fills the end screens with the sortie's numbers. */
export function fillEndScreen(prefix, state, m) {
  const set = (id, text) => {
    const el = document.getElementById(`${prefix}-${id}`);
    if (el) el.textContent = text;
  };
  set('score', String(m.score));
  set('rings', `${m.ringsPassed}/6`);
  set('time', formatTime(m.timeSeconds));
  set('best', String(m.bestScore));
  const reason = document.getElementById(`${prefix}-reason`);
  if (reason) reason.textContent = state.crashReason || m.landingQuality || '';
}
