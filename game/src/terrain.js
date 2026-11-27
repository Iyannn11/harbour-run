// terrain.js — builds the golden-hour coastal world of HARBOUR RUN:
// sea, harbour bay, land, skyline, two bridges, islands, runway, clouds and sun.
// Also owns terrainHeightAt(x, z), the runway definition and the ring course.
import * as THREE from 'three';

export const RUNWAY = {
  // Runway 09/27: a flat strip along the X axis at the coast, heading east.
  xMin: -520,
  xMax: 520,
  zCentre: 0,
  halfWidth: 16,
  height: 2,
  headingDeg: 90,
};

export const RING_COURSE = [
  { x: -300, y: 42, z: 110, r: 14, name: 'Harbour Gate' },
  { x: -100, y: 48, z: 320, r: 14, name: 'Bay Turn' },
  { x: 280, y: 52, z: 330, r: 14, name: 'Island Turn' },
  { x: 420, y: 44, z: 80, r: 14, name: 'Coast Bend' },
  { x: 120, y: 62, z: -200, r: 14, name: 'Skyline Pass' },
  { x: -380, y: 34, z: 0, r: 14, name: 'Final Approach' },
];

export const REFUEL_RING = { x: -180, y: 40, z: 60, r: 16 };

const ISLANDS = [
  { x: 150, z: 260, r: 55, h: 9 },
  { x: 300, z: 330, r: 40, h: 7 },
  { x: 40, z: 380, r: 48, h: 8 },
  { x: -420, z: 330, r: 38, h: 6 },
];

// Small deterministic hash noise so the land is gently uneven but stable.
function hashNoise(x, z) {
  const s = Math.sin(x * 0.127 + z * 0.311) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(x, z) {
  const xi = Math.floor(x / 60);
  const zi = Math.floor(z / 60);
  const xf = x / 60 - xi;
  const zf = z / 60 - zi;
  const s = (a, b) => a + (b - a) * (xf * xf * (3 - 2 * xf));
  const top = s(hashNoise(xi, zi), hashNoise(xi + 1, zi));
  const bot = s(hashNoise(xi, zi + 1), hashNoise(xi + 1, zi + 1));
  return top + (bot - top) * (zf * zf * (3 - 2 * zf));
}

/** Ground height at (x, z): sea 0, runway flat, land gently rolling, islands raised. */
export function terrainHeightAt(x, z) {
  for (const isl of ISLANDS) {
    const d = Math.hypot(x - isl.x, z - isl.z);
    if (d < isl.r) return 1 + isl.h * (1 - (d / isl.r) * (d / isl.r));
  }
  if (x >= RUNWAY.xMin && x <= RUNWAY.xMax && Math.abs(z - RUNWAY.zCentre) < RUNWAY.halfWidth + 6) {
    return RUNWAY.height;
  }
  if (z >= 40 || x < -380) return 0; // sea and harbour bay
  // City land: flat-ish pad with gentle undulation, rising away from the coast.
  const base = 4 + smoothNoise(x, z) * 2.5 + Math.max(0, -z - 60) * 0.012;
  return base;
}

function makeSkyDome(scene) {
  const geo = new THREE.SphereGeometry(2400, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2e4a7a) },
      mid: { value: new THREE.Color(0xe8905a) },
      low: { value: new THREE.Color(0xffc98a) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main(){ float h = normalize(vP).y; vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.75, h)) : mix(low, mid, smoothstep(-0.08, 0.25, h)); gl_FragColor = vec4(c, 1.0); }`,
  });
  const dome = new THREE.Mesh(geo, mat);
  scene.add(dome);
  return dome;
}

function makeSea(scene) {
  const geo = new THREE.PlaneGeometry(5200, 5200, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a6b8f, roughness: 0.32, metalness: 0.08 });
  const sea = new THREE.Mesh(geo, mat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.4, 0);
  scene.add(sea);
  // A second, slightly higher translucent sheet catches the sun as a glitter path.
  const glitter = new THREE.Mesh(
    new THREE.PlaneGeometry(2600, 900, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffb36b, roughness: 0.15, metalness: 0.15, transparent: true, opacity: 0.28 }),
  );
  glitter.rotation.x = -Math.PI / 2;
  glitter.position.set(-700, 0.55, 420);
  scene.add(glitter);
}

function makeLand(scene) {
  // One big land slab north of the coast (z < 40), with a beach strip at the waterline.
  const land = new THREE.Mesh(
    new THREE.BoxGeometry(5200, 8, 2600),
    new THREE.MeshStandardMaterial({ color: 0x4a6b46, roughness: 0.95 }),
  );
  land.position.set(0, 0, 40 - 1300);
  scene.add(land);
  const beach = new THREE.Mesh(
    new THREE.BoxGeometry(5200, 1.2, 26),
    new THREE.MeshStandardMaterial({ color: 0xd9c08a, roughness: 0.9 }),
  );
  beach.position.set(0, 3.6, 28);
  scene.add(beach);
  for (const isl of ISLANDS) {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(isl.r, isl.h + 4, 24),
      new THREE.MeshStandardMaterial({ color: 0x3f6b4a, roughness: 0.95 }),
    );
    cone.position.set(isl.x, (isl.h + 4) / 2 - 1.5, isl.z);
    scene.add(cone);
    const sand = new THREE.Mesh(
      new THREE.CylinderGeometry(isl.r * 0.98, isl.r * 1.06, 1.4, 24),
      new THREE.MeshStandardMaterial({ color: 0xd9c08a, roughness: 0.9 }),
    );
    sand.position.set(isl.x, 0.4, isl.z);
    scene.add(sand);
  }
}

function makeRunway(scene) {
  const group = new THREE.Group();
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(RUNWAY.xMax - RUNWAY.xMin, 0.6, RUNWAY.halfWidth * 2),
    new THREE.MeshStandardMaterial({ color: 0x4a505c, roughness: 0.85 }),
  );
  strip.position.set(0, RUNWAY.height, RUNWAY.zCentre);
  group.add(strip);
  // Centreline dashes and threshold bars, slightly above the strip so they never z-fight.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f2e8 });
  for (let x = RUNWAY.xMin + 40; x < RUNWAY.xMax - 20; x += 60) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(30, 2.2), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(x, RUNWAY.height + 0.35, RUNWAY.zCentre);
    group.add(dash);
  }
  for (const sx of [-1, 1]) {
    for (let i = -2; i <= 2; i++) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6), dashMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(sx * (RUNWAY.xMax - 34), RUNWAY.height + 0.35, RUNWAY.zCentre + i * 5.4);
      group.add(bar);
    }
  }
  // Edge lights: warm dots along both edges.
  const lightGeo = new THREE.SphereGeometry(0.55, 8, 6);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  for (let x = RUNWAY.xMin + 10; x <= RUNWAY.xMax - 10; x += 40) {
    for (const z of [RUNWAY.zCentre - RUNWAY.halfWidth, RUNWAY.zCentre + RUNWAY.halfWidth]) {
      const lamp = new THREE.Mesh(lightGeo, lightMat);
      lamp.position.set(x, RUNWAY.height + 0.8, z);
      group.add(lamp);
    }
  }
  // Small terminal + tower beside the runway, and a windsock.
  const terminal = new THREE.Mesh(
    new THREE.BoxGeometry(90, 10, 26),
    new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.7 }),
  );
  terminal.position.set(60, RUNWAY.height + 5, -42);
  group.add(terminal);
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 4, 26, 10),
    new THREE.MeshStandardMaterial({ color: 0xdde3e8, roughness: 0.6 }),
  );
  tower.position.set(120, RUNWAY.height + 13, -42);
  group.add(tower);
  const cab = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 5, 5, 10),
    new THREE.MeshStandardMaterial({ color: 0x2e4a6b, roughness: 0.3, metalness: 0.4 }),
  );
  cab.position.set(120, RUNWAY.height + 28, -42);
  group.add(cab);
  scene.add(group);
}

function makeCity(scene) {
  const group = new THREE.Group();
  const palette = [0x8a7f74, 0x6b7d8c, 0x9a8a6a, 0x5d6b7a, 0xb08a5a, 0x7a6a8a];
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x2a2f3a, roughness: 0.4, metalness: 0.3,
    emissive: 0xffb45e, emissiveIntensity: 0.55,
  });
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let gx = -560; gx <= 560; gx += 46) {
    for (let gz = -320; gz <= -70; gz += 46) {
      if (Math.abs(gx) < 90 && gz > -110) continue; // keep the terminal apron clear
      if (rnd() < 0.22) continue; // streets and gaps
      const h = 14 + rnd() * rnd() * 62;
      const w = 20 + rnd() * 14;
      const d = 20 + rnd() * 14;
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: palette[Math.floor(rnd() * palette.length)], roughness: 0.8 }),
      );
      tower.position.set(gx + (rnd() - 0.5) * 10, 4 + h / 2, gz + (rnd() - 0.5) * 10);
      group.add(tower);
      // Lit window band near the top so the skyline glows at golden hour.
      const band = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, Math.min(6, h * 0.22), d * 0.92), windowMat);
      band.position.set(tower.position.x, 4 + h - Math.min(6, h * 0.22) / 2 - 2, tower.position.z);
      group.add(band);
      if (h > 52) {
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.9, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0xff4444 }),
        );
        beacon.position.set(tower.position.x, 4 + h + 1, tower.position.z);
        group.add(beacon);
      }
    }
  }
  scene.add(group);
}

function makeBridges(scene) {
  // Suspension bridge across the harbour mouth (z = 170), deck at y = 26.
  const group = new THREE.Group();
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(420, 2.4, 12),
    new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 0.7 }),
  );
  deck.position.set(-280, 26, 170);
  group.add(deck);
  const cableMat = new THREE.MeshBasicMaterial({ color: 0x3a3f46 });
  for (const tx of [-420, -140]) {
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(6, 62, 8),
      new THREE.MeshStandardMaterial({ color: 0xc8542e, roughness: 0.6 }),
    );
    tower.position.set(tx, 26 + 28, 170);
    group.add(tower);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 300, 6), cableMat);
    cable.rotation.z = Math.PI / 2;
    cable.rotation.y = 0;
    cable.position.set(-280, 58, 170);
    group.add(cable);
  }
  // Low causeway bridge near the city, over the harbour's inner channel.
  const causeway = new THREE.Mesh(
    new THREE.BoxGeometry(16, 2, 190),
    new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.8 }),
  );
  causeway.position.set(-120, 8, 120);
  group.add(causeway);
  scene.add(group);
}

function makeHarbour(scene) {
  const group = new THREE.Group();
  // Piers jutting into the bay from the city edge.
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x6b5a44, roughness: 0.9 });
  for (const [px, pz, len] of [[-260, 70, 60], [-180, 90, 80], [-330, 60, 44]]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 2, len), pierMat);
    pier.position.set(px, 1.6, pz + len / 2 - 10);
    group.add(pier);
  }
  // Moored boats: hull + cabin + mast, bobbing gently (animated in main loop via userData).
  const boats = [];
  let seed = 31;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 9; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(5, 2.2, 14),
      new THREE.MeshStandardMaterial({ color: [0xe8e2d4, 0x2e5a7a, 0xc8542e][i % 3], roughness: 0.6 }),
    );
    hull.position.y = 1.2;
    boat.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 2, 5),
      new THREE.MeshStandardMaterial({ color: 0xf5f2e8, roughness: 0.6 }),
    );
    cabin.position.set(0, 3, -1);
    boat.add(cabin);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 9, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a8478 }),
    );
    mast.position.set(0, 7, 1);
    boat.add(mast);
    boat.position.set(-360 + rnd() * 260, 0.4, 60 + rnd() * 160);
    boat.rotation.y = rnd() * Math.PI;
    boat.userData.phase = rnd() * Math.PI * 2;
    group.add(boat);
    boats.push(boat);
  }
  scene.add(group);
  return boats;
}

function makeClouds(scene) {
  const clouds = [];
  const mat = new THREE.MeshStandardMaterial({ color: 0xffe8d0, roughness: 1, transparent: true, opacity: 0.92 });
  let seed = 101;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 16; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rnd() * 3);
    for (let p = 0; p < puffs; p++) {
      const r = 14 + rnd() * 18;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat);
      puff.scale.y = 0.42;
      puff.position.set((rnd() - 0.5) * 60, (rnd() - 0.5) * 6, (rnd() - 0.5) * 24);
      cloud.add(puff);
    }
    cloud.position.set(-900 + rnd() * 1800, 130 + rnd() * 130, -700 + rnd() * 1100);
    cloud.userData.speed = 1.2 + rnd() * 1.6;
    scene.add(cloud);
    clouds.push(cloud);
  }
  return clouds;
}

function makeSun(scene) {
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(90, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.95, fog: false }),
  );
  sun.position.set(-1900, 190, 700);
  sun.lookAt(0, 60, 0);
  scene.add(sun);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(190, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9a4d, transparent: true, opacity: 0.28, fog: false }),
  );
  glow.position.set(-1905, 190, 705);
  glow.lookAt(0, 60, 0);
  scene.add(glow);
}

/** Builds the whole world; returns animated bits the main loop should tick. */
export function buildTerrain(scene) {
  scene.fog = new THREE.Fog(0xe8a06a, 700, 2600);
  // A tiny gradient environment so standard materials reflect the golden-hour
  // sky instead of rendering black: warm horizon, blue above, dark below.
  const envCanvas = document.createElement('canvas');
  envCanvas.width = 64;
  envCanvas.height = 32;
  const envCtx = envCanvas.getContext('2d');
  const grad = envCtx.createLinearGradient(0, 0, 0, 32);
  grad.addColorStop(0, '#2e4a7a');
  grad.addColorStop(0.45, '#e8905a');
  grad.addColorStop(0.55, '#ffc98a');
  grad.addColorStop(1, '#3a3230');
  envCtx.fillStyle = grad;
  envCtx.fillRect(0, 0, 64, 32);
  const envTex = new THREE.CanvasTexture(envCanvas);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.colorSpace = THREE.SRGBColorSpace;
  scene.environment = envTex;
  makeSkyDome(scene);
  makeSea(scene);
  makeLand(scene);
  makeRunway(scene);
  makeCity(scene);
  makeBridges(scene);
  const boats = makeHarbour(scene);
  const clouds = makeClouds(scene);
  makeSun(scene);

  // Lights: low warm sun from the west, cool sky fill from above.
  const sunLight = new THREE.DirectionalLight(0xffc27d, 3.0);
  sunLight.position.set(-900, 260, 500);
  scene.add(sunLight);
  const skyLight = new THREE.HemisphereLight(0x8aa5cc, 0x5a4a3a, 1.1);
  scene.add(skyLight);
  return { boats, clouds };
}

/** Advances the bobbing boats and drifting clouds by dt seconds. */
export function animateTerrain(bits, t, dt) {
  for (const boat of bits.boats) {
    boat.position.y = 0.4 + Math.sin(t * 0.9 + boat.userData.phase) * 0.25;
    boat.rotation.z = Math.sin(t * 0.7 + boat.userData.phase) * 0.02;
  }
  for (const cloud of bits.clouds) {
    cloud.position.x += cloud.userData.speed * dt;
    if (cloud.position.x > 1000) cloud.position.x = -1000;
  }
}
