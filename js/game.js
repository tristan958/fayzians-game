// ============================================================
// SCUDDERFING DRIFT — game.js
// State machine · drift physics · scoring · fx · audio · HUD
// ============================================================
import * as THREE from 'three';
import { CARS, buildCarMesh, getGlowTexture } from './cars.js';
import { buildWorld, buildSky, drawMinimapBase, isOnRoad, WORLD_R } from './world.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------
// Renderer
// ------------------------------------------------------------
const canvas = $('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.28;

// ------------------------------------------------------------
// Scenes
// ------------------------------------------------------------
const worldScene = new THREE.Scene();
worldScene.fog = new THREE.FogExp2(0x140b26, 0.00115);

const garageScene = new THREE.Scene();
garageScene.background = new THREE.Color(0x060510);

const worldCam = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 4000);
const garageCam = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 200);
garageCam.position.set(5.4, 2.2, 6.6);
garageCam.lookAt(0, 0.75, 0);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  for (const c of [worldCam, garageCam]) {
    c.aspect = innerWidth / innerHeight;
    c.updateProjectionMatrix();
  }
});

// ------------------------------------------------------------
// Garage scene dressing
// ------------------------------------------------------------
{
  garageScene.add(new THREE.HemisphereLight(0x8a8aff, 0x0a0714, 0.5));
  const key = new THREE.SpotLight(0xffffff, 260, 40, 0.7, 0.6, 1.6);
  key.position.set(4, 8, 6);
  garageScene.add(key, key.target);
  const cyan = new THREE.PointLight(0x34e5ff, 120, 30, 1.8);
  cyan.position.set(-6, 2.4, 4);
  garageScene.add(cyan);
  const mag = new THREE.PointLight(0xff3d9a, 120, 30, 1.8);
  mag.position.set(6, 2.6, -4);
  garageScene.add(mag);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(30, 48).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x0b0c14, metalness: 0.55, roughness: 0.3 })
  );
  garageScene.add(floor);
  const podium = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.6, 0.16, 48),
    new THREE.MeshStandardMaterial({ color: 0x11131e, metalness: 0.5, roughness: 0.4 })
  );
  podium.position.y = 0.08;
  garageScene.add(podium);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.55, 0.05, 10, 64).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x34e5ff, emissive: 0x34e5ff, emissiveIntensity: 3 })
  );
  ring.position.y = 0.14;
  garageScene.add(ring);
  // faint grid lines on the floor
  const grid = new THREE.GridHelper(42, 21, 0x1c2f4a, 0x131b2c);
  grid.position.y = 0.01;
  garageScene.add(grid);
}

// ------------------------------------------------------------
// Garage car display
// ------------------------------------------------------------
const garageMeshes = CARS.map((spec) => buildCarMesh(spec));
const carDisplay = new THREE.Group();
carDisplay.position.y = 0.17;
garageScene.add(carDisplay);

let carIdx = parseInt(localStorage.getItem('scud_car') || '1', 10) % CARS.length;

const dotsBox = $('car-dots');
CARS.forEach(() => dotsBox.appendChild(document.createElement('i')));

function showCar(idx) {
  carIdx = (idx + CARS.length) % CARS.length;
  localStorage.setItem('scud_car', String(carIdx));
  const spec = CARS[carIdx];
  carDisplay.clear();
  carDisplay.add(garageMeshes[carIdx]);
  carDisplay.rotation.y = -0.6;
  carDisplay.scale.setScalar(0.92);

  $('car-name').textContent = spec.name;
  $('car-sub').textContent = spec.sub;
  $('car-story').textContent = spec.story;
  const st = spec.stats;
  $('st-power').style.width = st.power * 100 + '%';
  $('st-grip').style.width = st.grip * 100 + '%';
  $('st-drift').style.width = st.drift * 100 + '%';
  $('st-weight').style.width = st.weight * 100 + '%';
  [...dotsBox.children].forEach((d, i) => d.classList.toggle('on', i === carIdx));
}
showCar(carIdx);

// ------------------------------------------------------------
// Input
// ------------------------------------------------------------
const input = { throttle: 0, brake: 0, steerL: 0, steerR: 0, handbrake: false };
let camMode = 0;
let muted = localStorage.getItem('scud_mute') === '1';

const KEYMAP = {
  KeyW: 'throttle', ArrowUp: 'throttle',
  KeyS: 'brake', ArrowDown: 'brake',
  KeyA: 'steerL', ArrowLeft: 'steerL',
  KeyD: 'steerR', ArrowRight: 'steerR',
  Space: 'handbrake', ShiftLeft: 'handbrake'
};

addEventListener('keydown', (e) => {
  if (KEYMAP[e.code] !== undefined) {
    input[KEYMAP[e.code]] = KEYMAP[e.code] === 'handbrake' ? true : 1;
    e.preventDefault();
  }
  if (e.repeat) return;
  if (state === 'title' && (e.code === 'Enter' || e.code === 'Space')) enterGarage();
  else if (state === 'garage') {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') showCar(carIdx - 1);
    if (e.code === 'ArrowRight' || e.code === 'KeyD') showCar(carIdx + 1);
    if (e.code === 'Enter') startDrive();
  } else if (state === 'drive') {
    if (e.code === 'KeyC') camMode = (camMode + 1) % 3;
    if (e.code === 'KeyR') respawn();
    if (e.code === 'KeyM') toggleMute();
    if (e.code === 'KeyG' || e.code === 'Escape') exitToGarage();
  }
});
addEventListener('keyup', (e) => {
  if (KEYMAP[e.code] !== undefined) {
    input[KEYMAP[e.code]] = KEYMAP[e.code] === 'handbrake' ? false : 0;
  }
});

// touch controls
const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
function bindTouch(id, on, off) {
  const el = $(id);
  for (const ev of ['pointerdown']) el.addEventListener(ev, (e) => { e.preventDefault(); on(); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) el.addEventListener(ev, () => off());
}
bindTouch('t-gas', () => input.throttle = 1, () => input.throttle = 0);
bindTouch('t-brake', () => input.brake = 1, () => input.brake = 0);
bindTouch('t-hb', () => input.handbrake = true, () => input.handbrake = false);
bindTouch('t-steer-l', () => input.steerL = 1, () => input.steerL = 0);
bindTouch('t-steer-r', () => input.steerR = 1, () => input.steerR = 0);

// ------------------------------------------------------------
// Audio — synthesized engine, screech, wind
// ------------------------------------------------------------
let audio = null;
class GameAudio {
  constructor() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = muted ? 0 : 0.85;
    this.master.connect(ctx.destination);

    // engine
    this.osc1 = ctx.createOscillator(); this.osc1.type = 'sawtooth';
    this.osc2 = ctx.createOscillator(); this.osc2.type = 'square';
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    const engFilter = ctx.createBiquadFilter();
    engFilter.type = 'lowpass'; engFilter.frequency.value = 820; engFilter.Q.value = 2;
    this.osc1.connect(engFilter); this.osc2.connect(engFilter);
    engFilter.connect(this.engGain); this.engGain.connect(this.master);
    this.osc1.start(); this.osc2.start();

    // noise buffer (screech + wind)
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    const mkNoise = (type, freq, q) => {
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start();
      return g;
    };
    this.screech = mkNoise('bandpass', 1500, 1.4);
    this.wind = mkNoise('lowpass', 420, 0.6);
  }
  update(rpmN, gear, throttle, speed, screechAmt) {
    const t = this.ctx.currentTime;
    const f = 52 + rpmN * 138 + gear * 7;
    this.osc1.frequency.setTargetAtTime(f, t, 0.03);
    this.osc2.frequency.setTargetAtTime(f * 0.5 + 1.5, t, 0.03);
    this.engGain.gain.setTargetAtTime(0.035 + throttle * 0.06 + rpmN * 0.02, t, 0.05);
    this.screech.gain.setTargetAtTime(screechAmt, t, 0.08);
    this.wind.gain.setTargetAtTime(Math.min(0.05, speed * 0.001), t, 0.15);
  }
  thud(strength) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.5, strength * 0.06), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.25);
  }
  idle() {
    const t = this.ctx.currentTime;
    this.engGain.gain.setTargetAtTime(0, t, 0.1);
    this.screech.gain.setTargetAtTime(0, t, 0.1);
    this.wind.gain.setTargetAtTime(0, t, 0.1);
  }
}
function toggleMute() {
  muted = !muted;
  localStorage.setItem('scud_mute', muted ? '1' : '0');
  if (audio) audio.master.gain.value = muted ? 0 : 0.85;
}

// ------------------------------------------------------------
// Skid marks — one ring-buffered quad batch
// ------------------------------------------------------------
class SkidMarks {
  constructor(scene, max = 2400) {
    this.max = max;
    this.head = 0;
    this.ages = new Float32Array(max).fill(-1);
    const pos = new Float32Array(max * 4 * 3);
    const col = new Float32Array(max * 4 * 4);
    const idx = new Uint32Array(max * 6);
    for (let i = 0; i < max; i++) {
      const b = i * 4;
      idx.set([b, b + 2, b + 1, b + 1, b + 2, b + 3], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    this.geo = geo;
    this.posA = geo.getAttribute('position');
    this.colA = geo.getAttribute('color');
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false
    }));
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    scene.add(mesh);
  }
  add(x1, z1, x2, z2, w, strength) {
    const i = this.head;
    this.head = (this.head + 1) % this.max;
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz) || 1;
    const px = (-dz / len) * w / 2, pz = (dx / len) * w / 2;
    const y = 0.03;
    const p = this.posA.array, c = this.colA.array;
    const pb = i * 12, cb = i * 16;
    p.set([x1 + px, y, z1 + pz, x1 - px, y, z1 - pz, x2 + px, y, z2 + pz, x2 - px, y, z2 - pz], pb);
    const a = clamp(0.4 + strength * 0.35, 0, 0.72);
    for (let v = 0; v < 4; v++) c.set([0.02, 0.02, 0.03, a], cb + v * 4);
    this.ages[i] = 0;
    this.baseA = this.baseA || new Float32Array(this.max);
    this.baseA[i] = a;
    this.posA.needsUpdate = true;
  }
  update(dt) {
    const c = this.colA.array;
    let dirty = false;
    for (let i = 0; i < this.max; i++) {
      if (this.ages[i] < 0) continue;
      this.ages[i] += dt;
      const t = this.ages[i] / 24;
      let a = (this.baseA ? this.baseA[i] : 0.5) * (1 - t);
      if (a <= 0.005) { a = 0; this.ages[i] = -1; }
      const cb = i * 16;
      c[cb + 3] = c[cb + 7] = c[cb + 11] = c[cb + 15] = a;
      dirty = true;
    }
    if (dirty) this.colA.needsUpdate = true;
  }
}

// ------------------------------------------------------------
// Tire smoke — sprite pool
// ------------------------------------------------------------
class Smoke {
  constructor(scene, n = 70) {
    this.pool = [];
    for (let i = 0; i < n; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getGlowTexture(), color: 0xbfc6d4, transparent: true,
        opacity: 0, depthWrite: false
      }));
      sp.visible = false;
      scene.add(sp);
      this.pool.push({ sp, life: -1, max: 1, vx: 0, vy: 0, vz: 0 });
    }
    this.cursor = 0;
  }
  spawn(x, y, z, vx, vz) {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    p.life = 0;
    p.max = 0.8 + Math.random() * 0.6;
    p.sp.position.set(x, y, z);
    p.vx = vx * 0.3 + (Math.random() - 0.5) * 1.6;
    p.vz = vz * 0.3 + (Math.random() - 0.5) * 1.6;
    p.vy = 1 + Math.random() * 1.6;
    p.sp.visible = true;
  }
  update(dt) {
    for (const p of this.pool) {
      if (p.life < 0) continue;
      p.life += dt;
      const t = p.life / p.max;
      if (t >= 1) { p.life = -1; p.sp.visible = false; continue; }
      p.sp.position.x += p.vx * dt;
      p.sp.position.y += p.vy * dt;
      p.sp.position.z += p.vz * dt;
      p.sp.scale.setScalar(0.8 + t * 3.2);
      p.sp.material.opacity = 0.3 * (1 - t);
    }
  }
}

// ------------------------------------------------------------
// World / player state
// ------------------------------------------------------------
let state = 'title';
let world = null;          // { colliders, blinkers, spawn }
let skids = null, smoke = null;
let player = null;
const driveMeshCache = {};

function ensureWorld() {
  if (world) return;
  buildSky(worldScene);
  world = buildWorld(worldScene);
  skids = new SkidMarks(worldScene);
  smoke = new Smoke(worldScene);
}

function makePlayer(spec) {
  if (!driveMeshCache[spec.id]) {
    const mesh = buildCarMesh(spec);
    const rig = new THREE.Group();     // rig: position + heading | mesh: roll/pitch
    rig.add(mesh);
    driveMeshCache[spec.id] = { rig, mesh };
  }
  const { rig, mesh } = driveMeshCache[spec.id];
  return {
    spec, rig, mesh, ud: mesh.userData,
    pos: new THREE.Vector3(world.spawn.x, 0, world.spawn.z),
    vel: new THREE.Vector3(),
    heading: world.spawn.heading,
    steerPos: 0,
    drifting: false, slipDeg: 0, vf: 0, vr: 0,
    wheelSpin: 0,
    lastRL: null, lastRR: null,
    smokeAcc: 0
  };
}

function respawn() {
  if (!player) return;
  player.pos.set(world.spawn.x, 0, world.spawn.z);
  player.vel.set(0, 0, 0);
  player.heading = world.spawn.heading;
  player.steerPos = 0;
  score.chain = 0;
  camSnap = true;
}

// ------------------------------------------------------------
// Scoring
// ------------------------------------------------------------
const score = {
  total: 0,
  best: parseInt(localStorage.getItem('scud_best') || '0', 10),
  chain: 0, chainTimer: 0, mult: 1
};
const GRADES = [[12000, 'GODLIKE'], [6000, 'INSANE'], [3000, 'SICK'], [1200, 'GREAT'], [400, 'NICE']];

let bannerTimer = 0;
function showBanner(text, color) {
  const b = $('banner');
  b.textContent = text;
  b.style.color = color || '#fff';
  b.classList.remove('hidden');
  b.style.animation = 'none';
  void b.offsetWidth;               // restart animation
  b.style.animation = '';
  bannerTimer = 1.7;
}

function bankChain() {
  if (score.chain < 1) { score.chain = 0; return; }
  const gained = Math.round(score.chain * score.mult);
  score.total += gained;
  showBanner(`+${gained.toLocaleString()} BANKED`, '#b7ff58');
  if (score.total > score.best) {
    score.best = score.total;
    localStorage.setItem('scud_best', String(score.best));
  }
  score.chain = 0;
  score.mult = 1;
}

function bustChain() {
  if (score.chain > 200) showBanner('DRIFT WASTED', '#ff3d5e');
  score.chain = 0;
  score.mult = 1;
  const box = $('drift-box');
  box.classList.add('bust');
  setTimeout(() => box.classList.remove('bust'), 500);
}

// ------------------------------------------------------------
// Screens / transitions
// ------------------------------------------------------------
function fade(fn) {
  $('fader').classList.add('on');
  setTimeout(() => {
    fn();
    setTimeout(() => $('fader').classList.remove('on'), 60);
  }, 460);
}

function enterGarage() {
  state = 'garage';
  $('title-screen').classList.add('hidden');
  $('garage-screen').classList.remove('hidden');
}

function startDrive() {
  if (!audio) { try { audio = new GameAudio(); } catch (e) { console.warn('audio unavailable', e); } }
  if (audio && audio.ctx.state === 'suspended') audio.ctx.resume();
  fade(() => {
    ensureWorld();
    if (player) worldScene.remove(player.rig);
    player = makePlayer(CARS[carIdx]);
    worldScene.add(player.rig);
    for (const h of player.ud.headlights) h.intensity = 85;
    score.chain = 0; score.mult = 1;
    camSnap = true;
    state = 'drive';
    $('garage-screen').classList.add('hidden');
    $('hud').classList.remove('hidden');
    if (hasTouch) $('touch-ui').classList.remove('hidden');
    mmStatic = null; // force minimap re-render at current CSS size
  });
}

function exitToGarage() {
  bankChain();
  fade(() => {
    state = 'garage';
    if (audio) audio.idle();
    $('hud').classList.add('hidden');
    $('touch-ui').classList.add('hidden');
    $('garage-screen').classList.remove('hidden');
    showCar(carIdx);
  });
}

$('btn-start').addEventListener('click', enterGarage);
$('btn-drive').addEventListener('click', startDrive);
$('car-prev').addEventListener('click', () => showCar(carIdx - 1));
$('car-next').addEventListener('click', () => showCar(carIdx + 1));

// ------------------------------------------------------------
// Physics
// ------------------------------------------------------------
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _tmp = new THREE.Vector3();

function updatePhysics(dt) {
  const p = player, ph = p.spec.phys;

  const steerTarget = input.steerR - input.steerL;
  const steerRate = Math.abs(steerTarget) > 0.01 ? 6.5 : 9;
  p.steerPos = lerp(p.steerPos, steerTarget, clamp(steerRate * dt, 0, 1));

  _fwd.set(Math.sin(p.heading), 0, Math.cos(p.heading));
  _right.set(Math.cos(p.heading), 0, -Math.sin(p.heading));

  let vf = p.vel.dot(_fwd);
  let vr = p.vel.dot(_right);
  const speed = p.vel.length();

  // ---- engine / brakes
  if (input.throttle) vf += ph.accel * (1 - clamp(Math.max(vf, 0) / ph.top, 0, 1)) * dt;
  if (input.brake) {
    if (vf > 0.6) vf -= 30 * dt;
    else vf = Math.max(vf - 9 * dt, -13);
  }
  if (input.handbrake) vf *= 1 - clamp(0.9 * dt, 0, 0.6);
  vf *= 1 - clamp(0.055 * dt, 0, 0.1);            // rolling resistance

  // ---- off-road drag
  const onRoad = isOnRoad(p.pos.x, p.pos.z);
  if (!onRoad) vf *= 1 - clamp(0.9 * dt, 0, 0.6);

  // ---- lateral grip
  const slipDeg = Math.abs(Math.atan2(vr, Math.abs(vf) + 0.4)) * 57.3;
  const drifting = speed > 6 && (input.handbrake || slipDeg > 10);
  const grip = input.handbrake ? ph.gripHb : (drifting ? ph.gripDrift : ph.gripHi);
  vr *= Math.max(0, 1 - grip * dt);

  // ---- steering → heading
  const sf = clamp(speed / 8, 0, 1) / (1 + speed * 0.02);
  const dir = vf >= -0.3 ? 1 : -1;
  p.heading += p.steerPos * ph.turn * sf * dir * (drifting ? ph.driftSteer : 1) * dt;

  // ---- reassemble velocity in the pre-update frame basis
  p.vel.copy(_fwd).multiplyScalar(vf).addScaledVector(_right, vr);
  p.pos.addScaledVector(p.vel, dt);

  p.vf = vf; p.vr = vr; p.slipDeg = slipDeg; p.drifting = drifting;

  // ---- soft world boundary
  const r = Math.hypot(p.pos.x, p.pos.z);
  if (r > WORLD_R) {
    const nx = p.pos.x / r, nz = p.pos.z / r;
    const vn = p.vel.x * nx + p.vel.z * nz;
    if (vn > 0) { p.vel.x -= nx * vn * 1.6; p.vel.z -= nz * vn * 1.6; }
    p.pos.x = nx * WORLD_R; p.pos.z = nz * WORLD_R;
  }

  // ---- collisions (car ≈ circle, buildings/props = AABBs)
  const R = 1.15;
  for (const c of world.colliders) {
    if (p.pos.x < c.minX - R || p.pos.x > c.maxX + R || p.pos.z < c.minZ - R || p.pos.z > c.maxZ + R) continue;
    const cx = clamp(p.pos.x, c.minX, c.maxX);
    const cz = clamp(p.pos.z, c.minZ, c.maxZ);
    let dx = p.pos.x - cx, dz = p.pos.z - cz;
    let d = Math.hypot(dx, dz);
    if (d >= R) continue;
    if (d < 1e-4) {   // center inside the box — push along smallest overlap
      const pushL = p.pos.x - (c.minX - R), pushR = (c.maxX + R) - p.pos.x;
      const pushU = p.pos.z - (c.minZ - R), pushD = (c.maxZ + R) - p.pos.z;
      const m = Math.min(pushL, pushR, pushU, pushD);
      if (m === pushL) { dx = -1; dz = 0; } else if (m === pushR) { dx = 1; dz = 0; }
      else if (m === pushU) { dx = 0; dz = -1; } else { dx = 0; dz = 1; }
      d = 0;
    } else { dx /= d; dz /= d; }
    p.pos.x += dx * (R - d);
    p.pos.z += dz * (R - d);
    const vn = p.vel.x * dx + p.vel.z * dz;
    if (vn < 0) {
      p.vel.x -= dx * vn * 1.45;
      p.vel.z -= dz * vn * 1.45;
      const impact = -vn;
      if (impact > 5) {
        bustChain();
        shakeT = Math.min(0.5, impact * 0.02);
        if (audio) audio.thud(impact);
      }
    }
  }
}

// ------------------------------------------------------------
// Effects while driving
// ------------------------------------------------------------
function updateEffects(dt) {
  const p = player;
  const strength = clamp((p.slipDeg - 8) / 40, 0, 1);

  // rear wheel ground positions
  const hw = p.ud.track / 2, rz = -p.ud.wb / 2;
  const sinH = Math.sin(p.heading), cosH = Math.cos(p.heading);
  const wx = (lx, lz) => ({ x: p.pos.x + cosH * lx + sinH * lz, z: p.pos.z - sinH * lx + cosH * lz });
  const rl = wx(-hw, rz), rr = wx(hw, rz);

  if (p.drifting && p.vel.length() > 6) {
    if (p.lastRL) {
      const dL = Math.hypot(rl.x - p.lastRL.x, rl.z - p.lastRL.z);
      if (dL > 0.35 && dL < 6) {
        skids.add(p.lastRL.x, p.lastRL.z, rl.x, rl.z, 0.3, strength);
        skids.add(p.lastRR.x, p.lastRR.z, rr.x, rr.z, 0.3, strength);
        p.lastRL = rl; p.lastRR = rr;
      } else if (dL >= 6) { p.lastRL = rl; p.lastRR = rr; }
    } else { p.lastRL = rl; p.lastRR = rr; }

    p.smokeAcc += dt * (0.6 + strength * 2.2);
    if (p.smokeAcc > 0.06) {
      p.smokeAcc = 0;
      smoke.spawn(rl.x, 0.25, rl.z, p.vel.x, p.vel.z);
      smoke.spawn(rr.x, 0.25, rr.z, p.vel.x, p.vel.z);
    }
  } else {
    p.lastRL = p.lastRR = null;
  }

  skids.update(dt);
  smoke.update(dt);
}

// ------------------------------------------------------------
// Car visuals
// ------------------------------------------------------------
function updateCarVisuals(dt) {
  const p = player;
  p.rig.position.copy(p.pos);
  p.rig.rotation.y = p.heading;

  // roll & pitch flavor
  const roll = clamp(-p.vr * 0.014 - p.steerPos * 0.02, -0.09, 0.09);
  const pitch = clamp((input.throttle ? -0.022 : 0) + (input.brake ? 0.028 : 0) * clamp(p.vf / 10, 0, 1), -0.05, 0.05);
  p.mesh.rotation.z = lerp(p.mesh.rotation.z, roll, clamp(8 * dt, 0, 1));
  p.mesh.rotation.x = lerp(p.mesh.rotation.x, pitch, clamp(6 * dt, 0, 1));

  // wheels
  p.wheelSpin += (p.vf / p.ud.wheelR) * dt;
  for (const w of p.ud.wheels) w.rotation.x = p.wheelSpin;
  for (const g of p.ud.steerGroups) g.rotation.y = p.steerPos * 0.42;

  // brake lights
  p.ud.tailMat.emissiveIntensity = input.brake || input.handbrake ? 5 : 1.4;
}

// ------------------------------------------------------------
// Camera
// ------------------------------------------------------------
let camSnap = true;
let shakeT = 0;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const _velN = new THREE.Vector3(), _lookDir = new THREE.Vector3();

const CAM_MODES = [
  { dist: 8.8, h: 3.1, fovK: 0.42 },   // chase
  { dist: 13.5, h: 5.2, fovK: 0.3 },   // far chase
  { dist: 0, h: 0, fovK: 0.5 }         // hood
];

function updateCamera(dt) {
  const p = player;
  const speed = p.vel.length();
  const m = CAM_MODES[camMode];

  _fwd.set(Math.sin(p.heading), 0, Math.cos(p.heading));

  if (camMode === 2) {
    camPos.copy(p.pos).addScaledVector(_fwd, 0.6);
    camPos.y = 1.12;
    camLook.copy(p.pos).addScaledVector(_fwd, 40);
    camLook.y = 1.0;
    worldCam.position.copy(camPos);
    worldCam.lookAt(camLook);
  } else {
    if (speed > 2) _velN.copy(p.vel).normalize();
    else _velN.copy(_fwd);
    const vBlend = clamp(speed / 12, 0, 1) * 0.55;
    _lookDir.copy(_fwd).multiplyScalar(1 - vBlend).addScaledVector(_velN, vBlend).normalize();

    _tmp.copy(p.pos).addScaledVector(_lookDir, -m.dist);
    _tmp.y = m.h;
    if (camSnap) { camPos.copy(_tmp); camSnap = false; }
    else camPos.lerp(_tmp, clamp(5.2 * dt, 0, 1));

    camLook.copy(p.pos).addScaledVector(_lookDir, 7);
    camLook.y = 1.4;

    worldCam.position.copy(camPos);
    if (shakeT > 0) {
      shakeT -= dt;
      worldCam.position.x += (Math.random() - 0.5) * shakeT * 1.6;
      worldCam.position.y += (Math.random() - 0.5) * shakeT * 1.2;
    }
    worldCam.lookAt(camLook);
  }

  const targetFov = clamp(60 + speed * m.fovK, 58, 88);
  worldCam.fov = lerp(worldCam.fov, targetFov, clamp(3.5 * dt, 0, 1));
  worldCam.updateProjectionMatrix();
}

// ------------------------------------------------------------
// HUD + minimap
// ------------------------------------------------------------
const mm = $('minimap');
const mmCtx = mm.getContext('2d');
let mmStatic = null;

function updateHUD(dt) {
  const p = player;
  const kmh = Math.round(p.vel.length() * 3.6);
  $('speed-num').textContent = kmh;

  const top = p.spec.phys.top;
  const gearSpan = top / 6;
  let gearTxt;
  if (p.vf < -0.5) gearTxt = 'R';
  else if (p.vel.length() < 0.6) gearTxt = 'N';
  else gearTxt = String(1 + Math.min(5, Math.floor(p.vf / gearSpan)));
  $('gear-num').textContent = gearTxt;

  $('score-total').textContent = Math.round(score.total).toLocaleString();
  $('score-best').textContent = 'BEST ' + Math.round(score.best).toLocaleString();

  const box = $('drift-box');
  if (score.chain > 0) {
    box.classList.add('on');
    $('drift-points').textContent = '+' + Math.round(score.chain).toLocaleString();
    $('drift-mult').textContent = '×' + score.mult;
    let grade = '';
    for (const [th, g] of GRADES) if (score.chain >= th) { grade = g; break; }
    $('drift-grade').textContent = grade;
  } else {
    box.classList.remove('on');
  }

  if (bannerTimer > 0) {
    bannerTimer -= dt;
    if (bannerTimer <= 0) $('banner').classList.add('hidden');
  }

  // ---- minimap
  const size = mm.width;
  if (!mmStatic) {
    mmStatic = document.createElement('canvas');
    mmStatic.width = mmStatic.height = size;
    drawMinimapBase(mmStatic.getContext('2d'), size);
  }
  mmCtx.clearRect(0, 0, size, size);
  mmCtx.drawImage(mmStatic, 0, 0);
  const s = size / (WORLD_R * 2);
  const px = size / 2 + p.pos.x * s, py = size / 2 + p.pos.z * s;
  mmCtx.save();
  mmCtx.translate(px, py);
  mmCtx.rotate(Math.atan2(Math.sin(p.heading), -Math.cos(p.heading)));
  mmCtx.fillStyle = '#ffffff';
  mmCtx.shadowColor = '#34e5ff';
  mmCtx.shadowBlur = 6;
  mmCtx.beginPath();
  mmCtx.moveTo(0, -5.5);
  mmCtx.lineTo(4, 4.5);
  mmCtx.lineTo(-4, 4.5);
  mmCtx.closePath();
  mmCtx.fill();
  mmCtx.restore();
}

// ------------------------------------------------------------
// Scoring update
// ------------------------------------------------------------
function updateScore(dt) {
  const p = player;
  const speed = p.vel.length();
  if (p.drifting && speed > 7 && p.slipDeg > 10) {
    score.chain += speed * p.slipDeg * dt * 0.15;
    score.chainTimer = 0;
    score.mult = Math.min(10, 1 + Math.floor(score.chain / 1000));
  } else if (score.chain > 0) {
    score.chainTimer += dt;
    if (score.chainTimer > 1.8) bankChain();
  }
}

// ------------------------------------------------------------
// Main loop
// ------------------------------------------------------------
const clock = new THREE.Clock();
let elapsed = 0;

renderer.setAnimationLoop(() => {
  const dt = clamp(clock.getDelta(), 0, 0.05);
  elapsed += dt;

  if (state === 'title' || state === 'garage') {
    carDisplay.rotation.y += dt * 0.4;
    renderer.render(garageScene, garageCam);
    return;
  }

  // ---- drive
  updatePhysics(dt);
  updateEffects(dt);
  updateCarVisuals(dt);
  updateScore(dt);
  updateCamera(dt);
  updateHUD(dt);

  for (const b of world.blinkers) {
    b.material.opacity = Math.sin(elapsed * 2.4 + b.userData.phase) > 0.1 ? 0.9 : 0.06;
  }

  if (audio) {
    const p = player;
    const top = p.spec.phys.top, gearSpan = top / 6;
    const gear = Math.min(5, Math.floor(Math.max(p.vf, 0) / gearSpan));
    let rpmN = (Math.max(p.vf, 0) - gear * gearSpan) / gearSpan;
    if (p.vel.length() < 1) rpmN = input.throttle * 0.45;
    const screechAmt = p.drifting ? clamp(p.vel.length() * p.slipDeg * 0.00022, 0, 0.2) : 0;
    audio.update(clamp(rpmN, 0, 1), gear, input.throttle, p.vel.length(), screechAmt);
  }

  renderer.render(worldScene, worldCam);
});

// ------------------------------------------------------------
// Debug/test hook (harmless in production; used by smoke tests)
// ------------------------------------------------------------
window.__scud = {
  getState: () => ({
    state,
    speed: player ? player.vel.length() : 0,
    slip: player ? player.slipDeg : 0,
    drifting: player ? player.drifting : false,
    chain: score.chain,
    mult: score.mult,
    total: score.total,
    pos: player ? [player.pos.x, player.pos.z] : null
  }),
  step: (n, dt = 1 / 60) => {
    if (state !== 'drive') return;
    for (let i = 0; i < n; i++) { updatePhysics(dt); updateScore(dt); }
  },
  input
};
