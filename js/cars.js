// ============================================================
// SCUDDERFING DRIFT — cars.js
// Car specs + procedural low-poly car mesh builder
// ============================================================
import * as THREE from 'three';

// ------------------------------------------------------------
// The garage roster — JDM icons + German muscle
// ------------------------------------------------------------
export const CARS = [
  {
    id: 'ae86',
    name: 'AE86 PANDA',
    sub: 'Toyota hachiroku · 4A-GE',
    story: 'The tofu-delivery legend. No power, all balance — it teaches you to drift, then never lets you stop.',
    paint: 0xf2f4f6, accent: 0x101216, glow: 0xbfefff,
    stats: { power: 0.35, grip: 0.55, drift: 0.92, weight: 0.22 },
    phys: { accel: 11.5, top: 39, turn: 2.6, gripHi: 6.6, gripDrift: 1.9, gripHb: 0.62, driftSteer: 1.35 },
    body: { L: 4.2, W: 1.72, H: 0.58, cabin: { l: 0.42, w: 0.82, h: 0.46, z: -0.06, tx: 0.78, tz: 0.62 },
            spoiler: 'lip', popup: true, twoTone: true, wheelR: 0.32, wb: 2.4, track: 1.42 }
  },
  {
    id: 's15',
    name: 'SILVIA S15',
    sub: 'Nissan spec-R · SR20DET',
    story: 'Drift royalty. The S-chassis that turned every touge and dockside into a stage.',
    paint: 0x2b7fe8, accent: 0xcfd6de, glow: 0x34e5ff,
    stats: { power: 0.62, grip: 0.6, drift: 0.98, weight: 0.45 },
    phys: { accel: 15.5, top: 45, turn: 2.4, gripHi: 6.9, gripDrift: 1.8, gripHb: 0.58, driftSteer: 1.3 },
    body: { L: 4.45, W: 1.78, H: 0.58, cabin: { l: 0.44, w: 0.8, h: 0.42, z: -0.1, tx: 0.72, tz: 0.5 },
            spoiler: 'duck', popup: false, wheelR: 0.34, wb: 2.55, track: 1.5 }
  },
  {
    id: 'fd',
    name: 'RX-7 FD',
    sub: 'Mazda rotary · 13B-REW',
    story: 'A screaming twin-rotor sculpture. Featherweight, razor sharp, and absolutely gorgeous sideways.',
    paint: 0xffc820, accent: 0x14161a, glow: 0xffd34d,
    stats: { power: 0.72, grip: 0.66, drift: 0.85, weight: 0.4 },
    phys: { accel: 16.5, top: 47, turn: 2.45, gripHi: 7.3, gripDrift: 1.95, gripHb: 0.62, driftSteer: 1.28 },
    body: { L: 4.3, W: 1.76, H: 0.55, cabin: { l: 0.46, w: 0.78, h: 0.44, z: -0.08, tx: 0.66, tz: 0.42 },
            spoiler: 'duck', popup: true, wheelR: 0.33, wb: 2.45, track: 1.5 }
  },
  {
    id: 'a80',
    name: 'SUPRA A80',
    sub: 'Toyota legend · 2JZ-GTE',
    story: 'The 2JZ freight train. Monster power, monster presence — light the rears in any gear.',
    paint: 0xff5a1f, accent: 0x1a1c20, glow: 0xff7b3d,
    stats: { power: 0.96, grip: 0.62, drift: 0.75, weight: 0.7 },
    phys: { accel: 19.5, top: 54, turn: 2.05, gripHi: 7.0, gripDrift: 1.7, gripHb: 0.6, driftSteer: 1.18 },
    body: { L: 4.55, W: 1.82, H: 0.62, cabin: { l: 0.5, w: 0.82, h: 0.44, z: -0.02, tx: 0.68, tz: 0.46 },
            spoiler: 'wing', popup: false, wheelR: 0.35, wb: 2.55, track: 1.54 }
  },
  {
    id: 'm3',
    name: 'M3 E46',
    sub: 'BMW motorsport · S54 straight-six',
    story: 'Bavarian precision. Planted, surgical, endlessly fast through the city grid — grip when you want it, smoke when you don\'t.',
    paint: 0x3f8fd2, accent: 0x14161a, glow: 0x6db9ff,
    stats: { power: 0.8, grip: 0.88, drift: 0.6, weight: 0.6 },
    phys: { accel: 17.5, top: 50, turn: 2.25, gripHi: 8.6, gripDrift: 2.25, gripHb: 0.75, driftSteer: 1.12 },
    body: { L: 4.5, W: 1.8, H: 0.62, cabin: { l: 0.46, w: 0.84, h: 0.44, z: 0.0, tx: 0.76, tz: 0.6 },
            spoiler: 'lip', popup: false, kidney: true, wheelR: 0.34, wb: 2.6, track: 1.52 }
  },
  {
    id: 'evo2',
    name: '190E EVO II',
    sub: 'Mercedes-Benz · DTM homologation',
    story: 'The Stuttgart box-flare battleship. Heavy artillery with a PhD — stable at full send, brutal on the banks.',
    paint: 0x14161f, accent: 0x2b2f3a, glow: 0x9aa8ff,
    stats: { power: 0.66, grip: 0.78, drift: 0.68, weight: 0.78 },
    phys: { accel: 15.8, top: 46, turn: 2.1, gripHi: 8.0, gripDrift: 2.1, gripHb: 0.7, driftSteer: 1.15 },
    body: { L: 4.5, W: 1.84, H: 0.66, cabin: { l: 0.5, w: 0.86, h: 0.48, z: 0.04, tx: 0.8, tz: 0.66 },
            spoiler: 'evo', popup: false, wheelR: 0.33, wb: 2.65, track: 1.56 }
  }
];

// ------------------------------------------------------------
// Geometry helpers
// ------------------------------------------------------------

// Box whose top face is scaled/shifted — instant wedges & cabins
function taperedBox(w, h, d, tx, tz, shiftZ = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) {
      pos.setX(i, pos.getX(i) * tx);
      pos.setZ(i, pos.getZ(i) * tz + shiftZ);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

let glowTex = null;
function getGlowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
export { getGlowTexture };

// ------------------------------------------------------------
// Car mesh builder — returns a THREE.Group facing +Z,
// origin at ground level under the car's center.
// ------------------------------------------------------------
export function buildCarMesh(spec, { underglow = true } = {}) {
  const b = spec.body;
  const group = new THREE.Group();
  const L = b.L, W = b.W, H = b.H;
  const rideH = b.wheelR * 0.72;          // chassis bottom height

  const paintMat = new THREE.MeshStandardMaterial({ color: spec.paint, metalness: 0.72, roughness: 0.3 });
  const accentMat = new THREE.MeshStandardMaterial({ color: spec.accent, metalness: 0.6, roughness: 0.42 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x0b0c10, metalness: 0.4, roughness: 0.7 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x2c3f58, metalness: 0.65, roughness: 0.16,
    emissive: 0x16283e, emissiveIntensity: 0.55
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.95 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xc9ccd6, metalness: 0.95, roughness: 0.25 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfffbe8, emissive: 0xfff6d0, emissiveIntensity: 2.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x400008, emissive: 0xff1a2a, emissiveIntensity: 1.4 });

  // ---- main body: wedge slab
  const bodyGeo = taperedBox(W, H, L, 0.9, 0.9, -L * 0.02);
  const body = new THREE.Mesh(bodyGeo, paintMat);
  body.position.y = rideH + H / 2;
  group.add(body);

  // ---- cabin (glass) + roof cap
  const cab = b.cabin;
  const cabL = L * cab.l, cabW = W * cab.w, cabH = cab.h;
  const cabinGeo = taperedBox(cabW, cabH, cabL, cab.tx, cab.tz, -cabL * 0.1);
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.position.set(0, rideH + H + cabH / 2 - 0.05, L * cab.z);
  group.add(cabin);

  const roofGeo = new THREE.BoxGeometry(cabW * cab.tx * 1.02, 0.05, cabL * cab.tz * 1.02);
  const roof = new THREE.Mesh(roofGeo, b.twoTone ? accentMat : paintMat);
  roof.position.set(0, cabin.position.y + cabH / 2 - 0.01, L * cab.z - cabL * 0.1);
  group.add(roof);

  // ---- bumpers & skirts
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, H * 0.42, 0.16), trimMat);
  bumperF.position.set(0, rideH + H * 0.22, L / 2 - 0.02);
  group.add(bumperF);
  const bumperR = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, H * 0.46, 0.16), trimMat);
  bumperR.position.set(0, rideH + H * 0.24, -L / 2 + 0.02);
  group.add(bumperR);

  const skirtMat = b.twoTone ? accentMat : trimMat;
  for (const s of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.07, H * 0.22, L * 0.56), skirtMat);
    skirt.position.set(s * (W / 2 - 0.01), rideH + H * 0.1, 0);
    group.add(skirt);
  }

  // ---- box fenders for the EVO II / wide cars
  if (spec.body.spoiler === 'evo') {
    for (const s of [-1, 1]) for (const zz of [b.wb / 2, -b.wb / 2]) {
      const flare = new THREE.Mesh(new THREE.BoxGeometry(0.1, H * 0.5, 0.9), accentMat);
      flare.position.set(s * (W / 2 + 0.02), rideH + H * 0.3, zz);
      group.add(flare);
    }
  }

  // ---- headlights
  if (b.popup) {
    for (const s of [-1, 1]) {
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.24), paintMat);
      housing.position.set(s * W * 0.28, rideH + H + 0.02, L / 2 - L * 0.1);
      housing.rotation.x = -0.5;
      group.add(housing);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.05), headMat);
      lamp.position.set(s * W * 0.28, rideH + H + 0.06, L / 2 - L * 0.088);
      lamp.rotation.x = -0.5;
      group.add(lamp);
    }
  } else {
    for (const s of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.2), headMat);
      lamp.position.set(s * W * 0.3, rideH + H * 0.66, L / 2 - 0.07);
      group.add(lamp);
    }
  }

  // ---- BMW kidney grilles
  if (b.kidney) {
    for (const s of [-1, 1]) {
      const kid = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.2), trimMat);
      kid.position.set(s * 0.14, rideH + H * 0.5, L / 2 - 0.06);
      group.add(kid);
    }
  }

  // ---- taillight bar
  const tail = new THREE.Mesh(new THREE.BoxGeometry(W * 0.78, 0.09, 0.2), tailMat);
  tail.position.set(0, rideH + H * 0.68, -L / 2 + 0.06);
  group.add(tail);

  // ---- spoilers
  const spoilerY = rideH + H;
  if (b.spoiler === 'duck') {
    const duck = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.06, 0.34), paintMat);
    duck.position.set(0, spoilerY + 0.1, -L / 2 + 0.16);
    duck.rotation.x = 0.28;
    group.add(duck);
  } else if (b.spoiler === 'lip') {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.05, 0.16), b.twoTone ? accentMat : paintMat);
    lip.position.set(0, spoilerY + 0.05, -L / 2 + 0.1);
    group.add(lip);
  } else if (b.spoiler === 'wing' || b.spoiler === 'evo') {
    const tall = b.spoiler === 'wing' ? 0.3 : 0.22;
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, tall, 0.16), trimMat);
      post.position.set(s * W * 0.32, spoilerY + tall / 2, -L / 2 + 0.24);
      group.add(post);
    }
    const blade = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 0.05, 0.36), b.spoiler === 'evo' ? accentMat : paintMat);
    blade.position.set(0, spoilerY + tall + 0.025, -L / 2 + 0.22);
    blade.rotation.x = 0.14;
    group.add(blade);
  }

  // ---- mirrors
  for (const s of [-1, 1]) {
    const mir = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.1), b.twoTone ? accentMat : paintMat);
    mir.position.set(s * (W / 2 + 0.06), rideH + H + 0.1, L * cab.z + cabL * 0.42);
    group.add(mir);
  }

  // ---- exhaust
  const exGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.16, 10);
  exGeo.rotateX(Math.PI / 2);
  const exMat = new THREE.MeshStandardMaterial({ color: 0x8a8f99, metalness: 0.9, roughness: 0.35 });
  const nPipes = spec.id === 'a80' || spec.id === 'm3' ? 2 : 1;
  for (let i = 0; i < nPipes; i++) {
    const ex = new THREE.Mesh(exGeo, exMat);
    ex.position.set(-W * 0.28 + i * 0.16, rideH * 0.7, -L / 2 - 0.04);
    group.add(ex);
  }

  // ---- wheels
  const tireGeo = new THREE.CylinderGeometry(b.wheelR, b.wheelR, 0.26, 18);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(b.wheelR * 0.58, b.wheelR * 0.58, 0.27, 8);
  rimGeo.rotateZ(Math.PI / 2);
  const wheels = [];        // spinning meshes
  const steerGroups = [];   // front wheel pivots
  const wheelPos = [
    [ b.track / 2, b.wb / 2, true], [-b.track / 2, b.wb / 2, true],
    [ b.track / 2, -b.wb / 2, false], [-b.track / 2, -b.wb / 2, false]
  ];
  for (const [x, z, front] of wheelPos) {
    const pivot = new THREE.Group();
    pivot.position.set(x, b.wheelR, z);
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, tireMat);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    wheel.add(tire, rim);
    pivot.add(wheel);
    group.add(pivot);
    wheels.push(wheel);
    if (front) steerGroups.push(pivot);
  }

  // ---- blob shadow + underglow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 1.7, L * 1.25),
    new THREE.MeshBasicMaterial({ map: getGlowTexture(), color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  shadow.renderOrder = 1;
  group.add(shadow);

  if (underglow) {
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 2.1, L * 1.35),
      new THREE.MeshBasicMaterial({
        map: getGlowTexture(), color: spec.glow, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.035;
    glow.renderOrder = 2;
    group.add(glow);
  }

  // ---- headlight beams (off by default; game turns them on while driving)
  const lightL = new THREE.SpotLight(0xdfe8ff, 0, 70, 0.55, 0.5, 1.4);
  lightL.position.set(-W * 0.3, rideH + H * 0.7, L / 2);
  const lightR = lightL.clone();
  lightR.position.x = W * 0.3;
  const targetL = new THREE.Object3D(); targetL.position.set(-W * 0.3, 0.2, L / 2 + 26);
  const targetR = new THREE.Object3D(); targetR.position.set(W * 0.3, 0.2, L / 2 + 26);
  lightL.target = targetL; lightR.target = targetR;
  group.add(lightL, lightR, targetL, targetR);

  group.userData = {
    spec, wheels, steerGroups,
    tailMat, headlights: [lightL, lightR],
    wheelR: b.wheelR, track: b.track, wb: b.wb
  };
  return group;
}
