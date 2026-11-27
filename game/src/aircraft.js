// aircraft.js — builds the HARBOUR RUN aeroplane from three.js geometry:
// a small single-prop tourer with a smooth tapered fuselage, swept wings,
// tail, spinning propeller and landing gear. No boxes pretending to be a plane.
import * as THREE from 'three';

/** Builds the aeroplane mesh group. Forward is -Z in local space. */
export function buildAircraft() {
  const plane = new THREE.Group();
  const cream = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.35, metalness: 0.25 });
  const teal = new THREE.MeshStandardMaterial({ color: 0x1f7a6d, roughness: 0.35, metalness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.5, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd4e8, roughness: 0.08, metalness: 0.7, transparent: true, opacity: 0.85 });

  // Fuselage: a tapered cylinder (wide at the cabin, narrow at the tail) plus a rounded nose.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.05, 5.6, 20), cream);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, 0, 0.4);
  plane.add(fuselage);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.56, 20, 14), cream);
  nose.scale.set(1, 1, 1.5);
  nose.position.set(0, 0, -2.4);
  plane.add(nose);
  // Teal cheatline stripe along the fuselage.
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 1.06, 5.4, 20, 1, true, 0, Math.PI * 0.5), teal);
  stripe.rotation.x = Math.PI / 2;
  stripe.rotation.y = Math.PI / 2;
  stripe.position.set(0, -0.05, 0.4);
  plane.add(stripe);

  // Canopy: a smooth glass bubble over the cabin.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 14), glass);
  canopy.scale.set(0.85, 0.62, 1.7);
  canopy.position.set(0, 0.62, -0.5);
  plane.add(canopy);

  // Main wing: a gently tapered, slightly swept wing made from a shaped extrusion.
  const wingShape = new THREE.Shape();
  wingShape.moveTo(-0.9, 0);
  wingShape.lineTo(0.9, 0);
  wingShape.lineTo(0.62, 5.4);
  wingShape.lineTo(-0.62, 5.4);
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
  const wing = new THREE.Mesh(wingGeo, cream);
  wing.rotation.x = -Math.PI / 2;
  wing.rotation.z = Math.PI / 2;
  wing.position.set(0, -0.08, -0.3);
  plane.add(wing);
  // Teal wingtips.
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 1.7), teal);
    tip.position.set(s * 5.15, -0.08, -0.3);
    tip.rotation.y = s * 0.06;
    plane.add(tip);
  }

  // Tail: horizontal stabiliser + vertical fin, both tapered extrusions.
  const tailShape = new THREE.Shape();
  tailShape.moveTo(-0.7, 0);
  tailShape.lineTo(0.7, 0);
  tailShape.lineTo(0.45, 1.9);
  tailShape.lineTo(-0.45, 1.9);
  tailShape.closePath();
  const tailGeo = new THREE.ExtrudeGeometry(tailShape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 });
  const tailplane = new THREE.Mesh(tailGeo, teal);
  tailplane.rotation.x = -Math.PI / 2;
  tailplane.rotation.z = Math.PI / 2;
  tailplane.position.set(0, 0.12, 3.0);
  plane.add(tailplane);
  const finShape = new THREE.Shape();
  finShape.moveTo(-0.9, 0);
  finShape.lineTo(0.9, 0);
  finShape.lineTo(0.55, 1.5);
  finShape.lineTo(-0.2, 1.5);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 });
  const fin = new THREE.Mesh(finGeo, teal);
  fin.rotation.y = Math.PI / 2;
  fin.position.set(0, 0.2, 3.1);
  plane.add(fin);

  // Propeller: spinner cone + two blades, mounted on the nose.
  const prop = new THREE.Group();
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 12), dark);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.set(0, 0, -0.35);
  prop.add(spinner);
  const bladeGeo = new THREE.BoxGeometry(0.16, 2.3, 0.06);
  bladeGeo.translate(0, 1.15, 0);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.4, metalness: 0.5 });
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.rotation.z = a;
    blade.rotation.x = 0.25; // slight pitch on the blades
    prop.add(blade);
  }
  prop.position.set(0, 0, -3.25);
  plane.add(prop);

  // Landing gear: two main legs + nose leg, with small wheels.
  const gearMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.5, metalness: 0.5 });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 8), gearMat);
    leg.position.set(s * 0.8, -0.85, -0.6);
    plane.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.18, 14), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(s * 0.8, -1.28, -0.6);
    plane.add(wheel);
  }
  const noseLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8), gearMat);
  noseLeg.position.set(0, -0.8, -2.2);
  plane.add(noseLeg);
  const noseWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.15, 14), dark);
  noseWheel.rotation.z = Math.PI / 2;
  noseWheel.position.set(0, -1.18, -2.2);
  plane.add(noseWheel);

  // Navigation lights: red left, green right, white tail.
  const navLights = [];
  for (const [x, color] of [[-5.4, 0xff2222], [5.4, 0x22ff66]]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color }));
    lamp.position.set(x, -0.08, -0.3);
    plane.add(lamp);
    navLights.push(lamp);
  }
  const tailLight = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  tailLight.position.set(0, 0.15, 3.35);
  plane.add(tailLight);

  plane.userData.prop = prop;
  plane.userData.wing = wing;
  plane.userData.tailplane = tailplane;
  return plane;
}

/** Spins the propeller with rpm, dips the wings with bank and flexes the tail with pitch. */
export function updateAircraftVisual(plane, { rpm, bank, pitch, dt }) {
  const prop = plane.userData.prop;
  if (prop) prop.rotation.z += rpm * dt * 0.9;
  const wing = plane.userData.wing;
  if (wing) wing.rotation.y = -bank * 0.12;
  const tail = plane.userData.tailplane;
  if (tail) tail.rotation.x = -Math.PI / 2 - pitch * 0.15;
}
