// ============================================================
// SCUDDERFING DRIFT — world.js
// Neo-Kaido City: downtown neon grid, highway ring, dock lot
// ============================================================
import * as THREE from 'three';
import { getGlowTexture } from './cars.js';

// ---- layout constants (shared with minimap + off-road check)
export const GRID = [-300, -200, -100, 0, 100, 200, 300]; // street center lines
export const GRID_EXT = 340;        // streets run to ±340
export const STREET_HW = 8;         // street half-width
export const RING_R = 550, RING_HW = 15;
export const CONN_HW = 10;          // connector half-width
export const LOT = { x1: 380, x2: 548, z1: -95, z2: 95 }; // dockside drift lot
export const WORLD_R = 760;         // soft boundary

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ------------------------------------------------------------
export function isOnRoad(x, z) {
  const r = Math.hypot(x, z);
  if (r >= RING_R - RING_HW && r <= RING_R + RING_HW) return true;
  if (x >= LOT.x1 && x <= LOT.x2 && z >= LOT.z1 && z <= LOT.z2) return true;
  if (Math.abs(x) <= GRID_EXT && Math.abs(z) <= GRID_EXT) {
    for (const c of GRID) {
      if (Math.abs(x - c) <= STREET_HW || Math.abs(z - c) <= STREET_HW) return true;
    }
  }
  // connectors N/S/E/W
  if (Math.abs(x) <= CONN_HW && Math.abs(z) >= 330 && Math.abs(z) <= RING_R + RING_HW) return true;
  if (Math.abs(z) <= CONN_HW && Math.abs(x) >= 330 && Math.abs(x) <= RING_R + RING_HW) return true;
  return false;
}

// ------------------------------------------------------------
// procedural textures
// ------------------------------------------------------------
function windowTexture(tint) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#07080d';
  g.fillRect(0, 0, 128, 256);
  const cols = 10, rows = 26;
  const cw = 128 / cols, ch = 256 / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (Math.random() < 0.42) {
        const bright = 0.35 + Math.random() * 0.65;
        g.fillStyle = tint(bright);
        g.fillRect(i * cw + 2, j * ch + 2, cw - 4, ch - 4);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const TINTS = [
  (b) => `rgba(${140 * b + 60},${220 * b + 30},${255},${b})`,     // cyan
  (b) => `rgba(${255},${150 * b + 40},${220 * b + 20},${b})`,     // pink
  (b) => `rgba(${255},${190 * b + 40},${90 * b + 20},${b})`,      // warm
  (b) => `rgba(${230 * b + 25},${235 * b + 20},${255},${b})`,     // white-blue
];

function noiseTexture(base, spots, alpha) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = pick(spots);
    g.globalAlpha = Math.random() * alpha;
    const s = rand(1, 4);
    g.fillRect(Math.random() * 256, Math.random() * 256, s, s);
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ------------------------------------------------------------
// merged quad builder (lane markings etc.)
// ------------------------------------------------------------
class QuadBatch {
  constructor() { this.pos = []; this.idx = []; this.n = 0; }
  // quad from p1->p2 with given width, at height y
  seg(x1, z1, x2, z2, w, y) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz) || 1;
    const px = (-dz / len) * w / 2, pz = (dx / len) * w / 2;
    this.pos.push(
      x1 + px, y, z1 + pz, x1 - px, y, z1 - pz,
      x2 + px, y, z2 + pz, x2 - px, y, z2 - pz
    );
    const b = this.n * 4;
    this.idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    this.n++;
  }
  mesh(color, opacity = 1) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setIndex(this.idx);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
    return new THREE.Mesh(geo, mat);
  }
}

// ------------------------------------------------------------
// SKY
// ------------------------------------------------------------
export function buildSky(scene) {
  const skyGeo = new THREE.SphereGeometry(1450, 24, 14);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {},
    vertexShader: `
      varying vec3 vPos;
      void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 top = vec3(0.012, 0.008, 0.05);
        vec3 mid = vec3(0.10, 0.05, 0.23);
        vec3 low = vec3(0.34, 0.10, 0.32);
        vec3 hor = vec3(0.95, 0.36, 0.22);
        vec3 col = mix(mid, top, smoothstep(0.12, 0.65, h));
        col = mix(low, col, smoothstep(0.02, 0.14, h));
        col = mix(hor, col, smoothstep(-0.01, 0.05, h));
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // stars
  const starPos = [];
  for (let i = 0; i < 900; i++) {
    const t = Math.random() * Math.PI * 2;
    const p = Math.acos(rand(0.12, 0.98));
    const r = 1380;
    starPos.push(r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t));
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xcfe4ff, size: 2.2, sizeAttenuation: false, fog: false,
    transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  scene.add(stars);

  // moon
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getGlowTexture(), color: 0xdfe9ff, fog: false,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95
  }));
  moon.scale.setScalar(260);
  moon.position.set(-700, 620, -1000);
  scene.add(moon);
}

// ------------------------------------------------------------
// WORLD
// ------------------------------------------------------------
export function buildWorld(scene) {
  const colliders = [];
  const blinkers = [];

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0x8577ff, 0x1c1230, 0.85));
  const moonlight = new THREE.DirectionalLight(0xa8c4ff, 0.85);
  moonlight.position.set(-300, 500, -400);
  scene.add(moonlight);
  const rim = new THREE.DirectionalLight(0xff3d9a, 0.3);
  rim.position.set(400, 120, 600);
  scene.add(rim);

  // ---------- ground ----------
  const grassTex = noiseTexture('#0b1010', ['#0e1a12', '#131f16', '#0a0d14'], 0.7);
  grassTex.repeat.set(60, 60);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1200, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: grassTex, color: 0x8fa78f, roughness: 1 })
  );
  scene.add(ground);

  // ---------- roads ----------
  const asphaltTex = noiseTexture('#20222a', ['#2a2c35', '#181a20', '#30323c'], 0.55);
  asphaltTex.repeat.set(8, 8);
  const roadMat = new THREE.MeshStandardMaterial({ map: asphaltTex, color: 0xd5d9e4, roughness: 0.9 });
  const roadY = 0.02;

  const addRoadRect = (cx, cz, w, d) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), roadMat);
    m.position.set(cx, roadY, cz);
    scene.add(m);
  };
  // grid streets
  for (const c of GRID) {
    addRoadRect(c, 0, STREET_HW * 2, GRID_EXT * 2);   // north-south
    addRoadRect(0, c, GRID_EXT * 2, STREET_HW * 2);   // east-west
  }
  // connectors
  addRoadRect(0, 450, CONN_HW * 2, 240);
  addRoadRect(0, -450, CONN_HW * 2, 240);
  addRoadRect(450, 0, 240, CONN_HW * 2);
  addRoadRect(-450, 0, 240, CONN_HW * 2);
  // highway ring
  const ringMesh = new THREE.Mesh(
    new THREE.RingGeometry(RING_R - RING_HW, RING_R + RING_HW, 110).rotateX(-Math.PI / 2),
    roadMat
  );
  ringMesh.position.y = roadY;
  scene.add(ringMesh);
  // dock lot (concrete)
  const lotMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(LOT.x2 - LOT.x1, LOT.z2 - LOT.z1).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: asphaltTex, color: 0xc4c8d4, roughness: 0.85 })
  );
  lotMesh.position.set((LOT.x1 + LOT.x2) / 2, 0.015, (LOT.z1 + LOT.z2) / 2);
  scene.add(lotMesh);

  // ---------- lane markings (single merged mesh) ----------
  const dashes = new QuadBatch();
  const y = 0.045;
  for (const c of GRID) {
    for (let z = -GRID_EXT + 6; z < GRID_EXT - 6; z += 10) dashes.seg(c, z, c, z + 4, 0.28, y);
    for (let x = -GRID_EXT + 6; x < GRID_EXT - 6; x += 10) dashes.seg(x, c, x + 4, c, 0.28, y);
  }
  for (const s of [1, -1]) {
    for (let z = 350; z < 545; z += 10) dashes.seg(0, s * z, 0, s * (z + 4), 0.3, y);
    for (let x = 350; x < 545; x += 10) dashes.seg(s * x, 0, s * (x + 4), 0, 0.3, y);
  }
  // ring center dashes
  for (let i = 0; i < 100; i++) {
    const a1 = (i / 100) * Math.PI * 2, a2 = a1 + 0.026;
    dashes.seg(Math.cos(a1) * RING_R, Math.sin(a1) * RING_R, Math.cos(a2) * RING_R, Math.sin(a2) * RING_R, 0.32, y);
  }
  // drift circle in the lot
  const dc = { x: (LOT.x1 + LOT.x2) / 2, z: 0, r: 34 };
  for (let i = 0; i < 60; i++) {
    const a1 = (i / 60) * Math.PI * 2, a2 = a1 + 0.075;
    dashes.seg(dc.x + Math.cos(a1) * dc.r, dc.z + Math.sin(a1) * dc.r,
               dc.x + Math.cos(a2) * dc.r, dc.z + Math.sin(a2) * dc.r, 0.4, y);
  }
  const dashMesh = dashes.mesh(0xd8e6f2, 0.85);
  scene.add(dashMesh);

  // ---------- buildings ----------
  const winMats = [];
  for (let i = 0; i < 8; i++) {
    const tex = windowTexture(TINTS[i % TINTS.length]);
    winMats.push(new THREE.MeshStandardMaterial({
      map: tex, color: 0xa2a2b8,
      emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.9,
      roughness: 0.9
    }));
  }
  const crownMats = [0x34e5ff, 0xff3d9a, 0xffb02e, 0x9d5cff].map(c =>
    new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.4 }));
  const redSprite = () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getGlowTexture(), color: 0xff2233, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    s.scale.setScalar(6);
    return s;
  };

  const blockCenters = [-250, -150, -50, 50, 150, 250];
  for (const bx of blockCenters) for (const bz of blockCenters) {
    for (const qx of [-1, 1]) for (const qz of [-1, 1]) {
      if (Math.random() < 0.3) continue;
      const cx = bx + qx * 21, cz = bz + qz * 21;
      const w = rand(22, 33), d = rand(22, 33);
      const distC = Math.hypot(cx, cz);
      const h = rand(14, 34) + Math.max(0, (1 - distC / 480)) * rand(30, 62);
      const bld = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pick(winMats));
      bld.position.set(cx, h / 2, cz);
      scene.add(bld);
      colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });

      if (h > 40 && Math.random() < 0.6) {  // neon crown
        const crown = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.9, d + 0.6), pick(crownMats));
        crown.position.set(cx, h + 0.45, cz);
        scene.add(crown);
      }
      if (h > 62) {                          // antenna + beacon
        const ant = new THREE.Mesh(
          new THREE.CylinderGeometry(0.25, 0.4, 9, 6),
          new THREE.MeshStandardMaterial({ color: 0x30323a })
        );
        ant.position.set(cx, h + 4.5, cz);
        scene.add(ant);
        const bea = redSprite();
        bea.position.set(cx, h + 9.5, cz);
        bea.userData.phase = Math.random() * Math.PI * 2;
        scene.add(bea);
        blinkers.push(bea);
      }
    }
  }

  // ---------- street lamps ----------
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.6, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2d36 });
  const headGeo = new THREE.BoxGeometry(0.5, 0.14, 0.24);
  const headGlowMat = new THREE.MeshStandardMaterial({ color: 0xffc887, emissive: 0xffb35c, emissiveIntensity: 3 });
  const addLamp = (x, z) => {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, 2.8, z);
    const head = new THREE.Mesh(headGeo, headGlowMat);
    head.position.set(x, 5.65, z);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getGlowTexture(), color: 0xffb46e, blending: THREE.AdditiveBlending,
      depthWrite: false, opacity: 0.6
    }));
    glow.scale.setScalar(7);
    glow.position.set(x, 5.6, z);
    scene.add(pole, head, glow);
  };
  for (const cx of GRID) for (const cz of GRID) {
    if ((cx + cz) % 200 === 0) addLamp(cx + STREET_HW + 1.2, cz + STREET_HW + 1.2);
  }
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    addLamp(Math.cos(a) * (RING_R + RING_HW + 2.5), Math.sin(a) * (RING_R + RING_HW + 2.5));
  }

  // ---------- trees ----------
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.22, 2.4, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2a2118 });
  const leafGeo = new THREE.ConeGeometry(1.7, 3.6, 6);
  const leafMats = [0x0e2416, 0x123020, 0x0c1f2a].map(c => new THREE.MeshStandardMaterial({ color: c }));
  const addTree = (x, z, s = 1) => {
    const t = new THREE.Mesh(trunkGeo, trunkMat);
    t.position.set(x, 1.2 * s, z); t.scale.setScalar(s);
    const l = new THREE.Mesh(leafGeo, pick(leafMats));
    l.position.set(x, (2.4 + 1.6) * s, z); l.scale.setScalar(s);
    scene.add(t, l);
  };
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = rand(RING_R + 40, WORLD_R - 20);
    addTree(Math.cos(a) * r, Math.sin(a) * r, rand(0.8, 1.6));
  }
  for (let i = 0; i < 26; i++) {  // between grid and ring
    const a = Math.random() * Math.PI * 2;
    const r = rand(400, RING_R - 40);
    const x = Math.cos(a) * r, zz = Math.sin(a) * r;
    if (!isOnRoad(x, zz) && !(x > LOT.x1 - 12 && x < LOT.x2 + 12 && zz > LOT.z1 - 12 && zz < LOT.z2 + 12)) {
      addTree(x, zz, rand(0.9, 1.5));
    }
  }

  // ---------- dock containers ----------
  const contGeo = new THREE.BoxGeometry(6.2, 2.7, 2.6);
  const contMats = [0x7c2230, 0x1e5c6e, 0x8a5a1c, 0x35406e, 0x2c6e3f].map(c =>
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0.3 }));
  const addContainer = (x, z, stacked) => {
    const m = new THREE.Mesh(contGeo, pick(contMats));
    m.position.set(x, 1.35, z);
    scene.add(m);
    colliders.push({ minX: x - 3.1, maxX: x + 3.1, minZ: z - 1.3, maxZ: z + 1.3 });
    if (stacked) {
      const m2 = new THREE.Mesh(contGeo, pick(contMats));
      m2.position.set(x + rand(-0.3, 0.3), 4.05, z);
      scene.add(m2);
    }
  };
  for (let i = 0; i < 7; i++) addContainer(LOT.x1 + 14 + i * 22, LOT.z1 + 8, Math.random() < 0.5);
  for (let i = 0; i < 7; i++) addContainer(LOT.x1 + 20 + i * 22, LOT.z2 - 8, Math.random() < 0.5);

  // ---------- harbor cranes (silhouettes past the lot) ----------
  const craneMat = new THREE.MeshStandardMaterial({ color: 0x1c2026 });
  for (let i = 0; i < 3; i++) {
    const gx = 640 + i * 45, gz = -60 + i * 55;
    const legs = new THREE.Mesh(new THREE.BoxGeometry(4, 38, 4), craneMat);
    legs.position.set(gx, 19, gz);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(34, 3, 3), craneMat);
    arm.position.set(gx - 8, 38, gz);
    scene.add(legs, arm);
    const bea = redSprite();
    bea.position.set(gx, 41, gz);
    bea.userData.phase = i * 1.7;
    scene.add(bea);
    blinkers.push(bea);
  }

  // ---------- distant mountains ----------
  const mtnMat = new THREE.MeshBasicMaterial({ color: 0x0d0918, fog: false });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rand(-0.1, 0.1);
    const r = rand(1050, 1250);
    const h = rand(120, 330);
    const m = new THREE.Mesh(new THREE.ConeGeometry(rand(160, 300), h, 5), mtnMat);
    m.position.set(Math.cos(a) * r, h / 2 - 6, Math.sin(a) * r);
    scene.add(m);
  }

  return {
    colliders,
    blinkers,
    spawn: { x: 0, z: 316, heading: Math.PI }
  };
}

// ------------------------------------------------------------
// MINIMAP base layer
// ------------------------------------------------------------
export function drawMinimapBase(ctx, size) {
  const s = size / (WORLD_R * 2);   // world → px
  const T = (v) => size / 2 + v * s;
  ctx.clearRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(52,229,255,0.55)';
  ctx.lineWidth = Math.max(1, STREET_HW * 2 * s);
  ctx.lineCap = 'round';
  for (const c of GRID) {
    ctx.beginPath(); ctx.moveTo(T(c), T(-GRID_EXT)); ctx.lineTo(T(c), T(GRID_EXT)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(T(-GRID_EXT), T(c)); ctx.lineTo(T(GRID_EXT), T(c)); ctx.stroke();
  }
  ctx.lineWidth = Math.max(1.2, CONN_HW * 2 * s);
  for (const sg of [[0, 330, 0, 560], [0, -330, 0, -560], [330, 0, 560, 0], [-330, 0, -560, 0]]) {
    ctx.beginPath(); ctx.moveTo(T(sg[0]), T(sg[1])); ctx.lineTo(T(sg[2]), T(sg[3])); ctx.stroke();
  }
  ctx.lineWidth = Math.max(1.4, RING_HW * 2 * s);
  ctx.strokeStyle = 'rgba(52,229,255,0.5)';
  ctx.beginPath(); ctx.arc(size / 2, size / 2, RING_R * s, 0, Math.PI * 2); ctx.stroke();

  ctx.fillStyle = 'rgba(255,176,46,0.3)';
  ctx.fillRect(T(LOT.x1), T(LOT.z1), (LOT.x2 - LOT.x1) * s, (LOT.z2 - LOT.z1) * s);
  ctx.strokeStyle = 'rgba(255,176,46,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(T((LOT.x1 + LOT.x2) / 2), T(0), 34 * s, 0, Math.PI * 2);
  ctx.stroke();
}
