// pr1v intro: a night walk up to a white neoclassical house, into an oval office, a laptop wakes up, and the camera dives into its terminal.
// no text overlays. click, tap or press any key to skip.
import * as THREE from './vendor/three.module.min.js';
import { EffectComposer } from './vendor/EffectComposer.js';
import { RenderPass } from './vendor/RenderPass.js';
import { UnrealBloomPass } from './vendor/UnrealBloomPass.js';
import { OutputPass } from './vendor/OutputPass.js';
import { ShaderPass } from './vendor/ShaderPass.js';

const Q = new URLSearchParams(location.search);
const AT = Q.has('introAt') ? +Q.get('introAt') : null;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const seen = (() => { try { return sessionStorage.getItem('pr1vIntro') === '1'; } catch { return false; } })();
const canvas = document.getElementById('intro'), fadeEl = document.getElementById('fade'), skipBtn = document.getElementById('skip');
const END = 16.6, CUT = 6.7;

function done() {
  try { sessionStorage.setItem('pr1vIntro', '1'); } catch { }
  window.__pr1vIntroRunning = false;
  document.dispatchEvent(new Event('pr1v:ready'));
}
function webglOK() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }
if (AT == null && (Q.has('nointro') || seen || reduced || !webglOK())) { done(); }
else { window.__pr1vIntroRunning = true; try { start(); } catch (e) { console.error(e); done(); } }

function start() {
// ------------------------------------------------------------------ helpers
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ss = (a, b, t) => { const x = clamp((t - a) / (b - a)); return x * x * (3 - 2 * x); };
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const M = (color, rough = .85, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const tex = (w, h, draw, rep) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
const bez = (p0, p1, p2, p3, t) => { const u = 1 - t; return p0.clone().multiplyScalar(u * u * u).add(p1.clone().multiplyScalar(3 * u * u * t)).add(p2.clone().multiplyScalar(3 * u * t * t)).add(p3.clone().multiplyScalar(t * t * t)); };

// ------------------------------------------------------------------ renderer
const mobile = innerWidth < 760;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.75));
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .02, 900);
const OUT = new THREE.Scene(), IN = new THREE.Scene();
const composer = new EffectComposer(renderer);
const rp = new RenderPass(OUT, camera); composer.addPass(rp);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .6, .45, .94); composer.addPass(bloom);
composer.addPass(new OutputPass());
// film finish: a soft vignette and a little grain, gone by the time the screen fills the view
const film = new ShaderPass({ uniforms: { tDiffuse: { value: null }, t: { value: 0 }, amt: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float t, amt; varying vec2 vUv; float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); } void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = (vUv - .5) * vec2(1.15, 1.); float v = smoothstep(.9, .2, length(d)); c.rgb *= mix(1., v, .6 * amt); c.rgb += (h(vUv * 900. + fract(t) * 37.) - .5) * .03 * amt; gl_FragColor = c; }' });
composer.addPass(film);
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.fov = w / h < .8 ? 64 : w / h < 1.2 ? 52 : 42; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

// ------------------------------------------------------------------ the anon
function makeAnon() {
  const hoodie = M('#24242a', .9), pants = M('#2b2b31', .88), shoe = M('#e8e8ea', .55), voidM = new THREE.MeshBasicMaterial({ color: '#000000' });
  const root = new THREE.Group(), pelvis = new THREE.Group(); pelvis.position.y = .95; root.add(pelvis);
  const hips = new THREE.Mesh(new THREE.CapsuleGeometry(.14, .14, 4, 12), pants); hips.rotation.z = Math.PI / 2; hips.scale.set(1, 1.05, .85); pelvis.add(hips);
  const spine = new THREE.Group(); spine.position.y = .05; pelvis.add(spine);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.19, .34, 6, 18), hoodie); torso.position.y = .32; torso.scale.set(1.12, 1, .74); spine.add(torso);
  const pocket = new THREE.Mesh(new THREE.BoxGeometry(.26, .1, .02), M('#18181c', .95)); pocket.position.set(0, .2, .16); spine.add(pocket);
  const head = new THREE.Group(); head.position.y = .8; spine.add(head);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(.16, 28, 20, Math.PI / 2 + .62, Math.PI * 2 - 1.24, 0, Math.PI * .86), hoodie); hood.material = hoodie.clone(); hood.material.side = THREE.DoubleSide; hood.scale.set(1, 1.12, 1.1); head.add(hood);
  const face = new THREE.Mesh(new THREE.SphereGeometry(.122, 20, 16), voidM); face.position.set(0, -.012, .035); face.scale.set(.92, 1.08, .9); head.add(face);
  const drape = new THREE.Mesh(new THREE.CylinderGeometry(.13, .17, .14, 18, 1, true), hoodie); drape.position.y = -.14; head.add(drape);
  const arm = s => { const sh = new THREE.Group(); sh.position.set(s * .27, .55, 0); spine.add(sh);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(.064, .22, 4, 12), hoodie); up.position.y = -.15; sh.add(up);
    const el = new THREE.Group(); el.position.y = -.31; sh.add(el);
    const lo = new THREE.Mesh(new THREE.CapsuleGeometry(.058, .19, 4, 12), hoodie); lo.position.y = -.13; el.add(lo);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.052, 12, 10), M('#2a2a30', .8)); hand.position.y = -.27; hand.scale.set(.9, 1.1, .8); el.add(hand);
    return { sh, el }; };
  const leg = s => { const hp = new THREE.Group(); hp.position.set(s * .1, -.02, 0); pelvis.add(hp);
    const th = new THREE.Mesh(new THREE.CapsuleGeometry(.078, .3, 4, 12), pants); th.position.y = -.22; hp.add(th);
    const kn = new THREE.Group(); kn.position.y = -.44; hp.add(kn);
    const sn = new THREE.Mesh(new THREE.CapsuleGeometry(.064, .3, 4, 12), pants); sn.position.y = -.21; kn.add(sn);
    const ft = new THREE.Group(); ft.position.y = -.43; kn.add(ft);
    const sb = new THREE.Mesh(new THREE.CapsuleGeometry(.055, .16, 4, 10), shoe); sb.rotation.x = Math.PI / 2; sb.position.set(0, -.035, .06); sb.scale.set(1.05, 1, .8); ft.add(sb);
    return { hp, kn, ft }; };
  const A = { root, pelvis, spine, head, L: { ...arm(-1), ...leg(-1) }, R: { ...arm(1), ...leg(1) } };
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return A;
}
function pose(A, ph, sit = 0, type = 0) {
  const s = Math.sin(ph), c = Math.cos(ph), k = 1 - sit;
  const W = { pel: .95 - .025 + .025 * Math.abs(c), hpL: -s * .48, hpR: s * .48, knL: .12 + .75 * Math.max(0, c), knR: .12 + .75 * Math.max(0, -c), ftL: -.15 * Math.max(0, -c), ftR: -.15 * Math.max(0, c),
    shL: s * .42, shR: -s * .42, elL: -.25 - .25 * Math.max(0, s), elR: -.25 - .25 * Math.max(0, -s), sp: .06, tw: s * .07, hd: -.04 };
  const S = { pel: .52, hpL: -1.55, hpR: -1.5, knL: 1.5, knR: 1.45, ftL: 0, ftR: 0, shL: -.78 + Math.sin(type * 21) * .05 * (type > 0), shR: -.78 + Math.sin(type * 23 + 1) * .05 * (type > 0), elL: -.82, elR: -.82, sp: .14, tw: 0, hd: .32 };
  const b = key => W[key] * k + S[key] * sit;
  A.pelvis.position.y = b('pel'); A.L.hp.rotation.x = b('hpL'); A.R.hp.rotation.x = b('hpR'); A.L.kn.rotation.x = b('knL'); A.R.kn.rotation.x = b('knR'); A.L.ft.rotation.x = b('ftL'); A.R.ft.rotation.x = b('ftR');
  A.L.sh.rotation.x = b('shL'); A.R.sh.rotation.x = b('shR'); A.L.el.rotation.x = b('elL'); A.R.el.rotation.x = b('elR'); A.spine.rotation.x = b('sp'); A.spine.rotation.y = b('tw'); A.head.rotation.x = b('hd');
  A.L.sh.rotation.z = -.08 * k + .12 * sit; A.R.sh.rotation.z = .08 * k - .12 * sit;
}

// ------------------------------------------------------------------ textures
const flagTex = tex(380, 200, (x, w, h) => { for (let i = 0; i < 13; i++) { x.fillStyle = i % 2 ? '#f4f1ea' : '#a51f2f'; x.fillRect(0, i * h / 13, w, h / 13 + 1); } const cw = w * .4, ch = h * 7 / 13; x.fillStyle = '#28305e'; x.fillRect(0, 0, cw, ch); x.fillStyle = '#f4f1ea';
  for (let r = 0; r < 9; r++) { const n = r % 2 ? 5 : 6; for (let i = 0; i < n; i++) { const px = cw / 12 * (r % 2 ? 2 + i * 2 : 1 + i * 2), py = ch / 10 * (r + 1); x.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 2.2 : 5.2; x.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); } x.fill(); } } });
const winTex = tex(128, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffe2ad'); g.addColorStop(1, '#f7a952'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(120,70,30,.35)'; x.fillRect(0, h * .55, w, h * .45);
  x.fillStyle = '#4b3b2c'; x.fillRect(0, 0, w, 8); x.fillRect(0, h - 8, w, 8); x.fillRect(0, 0, 8, h); x.fillRect(w - 8, 0, 8, h); for (let i = 1; i < 3; i++) x.fillRect(i * w / 3 - 2, 0, 4, h); for (let i = 1; i < 6; i++) x.fillRect(0, i * h / 6 - 2, w, 4); });
const nightWin = tex(256, 600, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0a1430'); g.addColorStop(.75, '#1b2c55'); g.addColorStop(1, '#2b3c62'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = '#0b1220'; for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(i * 34 + 10, h * .86, 40 + (i % 3) * 12, 0, 7); x.fill(); } x.fillRect(0, h * .88, w, h);
  x.fillStyle = '#f1ead9'; x.fillRect(0, 0, w, 10); x.fillRect(0, h - 10, w, 10); x.fillRect(0, 0, 10, h); x.fillRect(w - 10, 0, 10, h); x.fillRect(w / 2 - 3, 0, 6, h); for (let i = 1; i < 6; i++) x.fillRect(0, i * h / 6 - 3, w, 6); });
const woodTex = tex(1024, 1024, (x, w, h) => { const C = ['#7a5232', '#6d4729', '#835a37', '#704a2c']; const s = 64; for (let j = 0; j < h / s; j++) for (let i = 0; i < w / s; i++) { x.fillStyle = C[(i * 3 + j * 5) % 4]; x.fillRect(i * s, j * s, s, s); x.strokeStyle = 'rgba(30,15,5,.35)'; x.lineWidth = 2; x.strokeRect(i * s, j * s, s, s);
    x.strokeStyle = 'rgba(255,220,170,.06)'; for (let k = 0; k < 4; k++) { x.beginPath(); if ((i + j) % 2) { x.moveTo(i * s + 6 + k * 15, j * s); x.lineTo(i * s + 6 + k * 15, j * s + s); } else { x.moveTo(i * s, j * s + 6 + k * 15); x.lineTo(i * s + s, j * s + 6 + k * 15); } x.stroke(); } } }, [3, 3]);
const rugTex = tex(1024, 1024, (x, w, h) => { const c = w / 2; x.fillStyle = '#23305a'; x.fillRect(0, 0, w, h);
  const ring = (r, wd, col) => { x.strokeStyle = col; x.lineWidth = wd; x.beginPath(); x.arc(c, c, r, 0, 7); x.stroke(); };
  for (let i = 0; i < 72; i++) { const a = i / 72 * Math.PI * 2; x.fillStyle = i % 2 ? 'rgba(236,224,190,.10)' : 'rgba(236,224,190,.04)'; x.beginPath(); x.moveTo(c, c); x.arc(c, c, c * .72, a, a + Math.PI * 2 / 72); x.fill(); }
  ring(c * .97, 18, '#c9a54e'); ring(c * .925, 4, '#c9a54e'); ring(c * .74, 6, '#c9a54e'); ring(c * .2, 10, '#c9a54e'); ring(c * .14, 3, '#e6d6a6');
  x.fillStyle = '#2b3a68'; x.beginPath(); x.arc(c, c, c * .13, 0, 7); x.fill();
  x.fillStyle = '#e8dcb4'; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, px = c + Math.cos(a) * c * .835, py = c + Math.sin(a) * c * .835; x.beginPath(); for (let k = 0; k < 10; k++) { const b = -Math.PI / 2 + k * Math.PI / 5 + a, rr = k % 2 ? 6 : 15; x.lineTo(px + Math.cos(b) * rr, py + Math.sin(b) * rr); } x.fill(); }
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; x.strokeStyle = 'rgba(201,165,78,.55)'; x.lineWidth = 3; x.beginPath(); x.moveTo(c + Math.cos(a) * c * .22, c + Math.sin(a) * c * .22); x.lineTo(c + Math.cos(a) * c * .7, c + Math.sin(a) * c * .7); x.stroke(); } });
const paintTex = (hue) => tex(256, 180, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `hsl(${hue},35%,62%)`); g.addColorStop(.6, `hsl(${hue + 20},30%,78%)`); g.addColorStop(1, `hsl(${hue + 50},25%,45%)`); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = `hsl(${hue + 90},22%,30%)`; x.beginPath(); x.moveTo(0, h * .75); for (let i = 0; i <= 8; i++) x.lineTo(i * w / 8, h * (.62 + Math.sin(i * 1.7 + hue) * .08)); x.lineTo(w, h); x.lineTo(0, h); x.fill(); });

// screen: what the laptop shows
const SC = document.createElement('canvas'); SC.width = 640; SC.height = 400; const sx = SC.getContext('2d'); const screenTex = new THREE.CanvasTexture(SC); screenTex.colorSpace = THREE.SRGBColorSpace;
const PX = { p: ['.....', '####.', '#...#', '#...#', '####.', '#....', '#....'], r: ['.....', '#.##.', '##..#', '#....', '#....', '.....', '.....'], 1: ['..#..', '.##..', '..#..', '..#..', '.###.', '.....', '.....'], v: ['.....', '#...#', '#...#', '.#.#.', '..#..', '.....', '.....'] };
let lastScreen = '';
const LIME = '#c6ff3d', LDIM = '#5f7d22';
function pixWord(x, ox, oy, u, cur) { ['p', 'r', 1, 'v'].forEach((ch, i) => PX[ch].forEach((row, r) => [...row].forEach((v, c) => { if (v === '#') x.fillRect(ox + (i * 6 + c) * u, oy + r * u, u - 1, u - 1); }))); if (cur) x.fillRect(ox + 24 * u + 3, oy + u, 3 * u, 4 * u); }
function drawScreen(state, tt) {
  const key = state + ':' + (state === 'seq' ? Math.floor(tt * 30) : 0); if (key === lastScreen) return; lastScreen = key;
  const x = sx, w = 640, h = 400; x.textBaseline = 'alphabetic';
  if (state === 'off') { x.fillStyle = '#060707'; x.fillRect(0, 0, w, h); }
  if (state === 'seq') {
    x.fillStyle = '#0b0e0b'; x.fillRect(0, 0, w, h);
    if (tt < .95) { // firmware: checks scroll by, then a bar
      const L = [['pr1v bios 1.0 · secure boot', ''], ['cpu', 'ok'], ['memory', '16384 MB ok'], ['tpm', 'sealed'], ['disk', 'encrypted · aes-256'], ['network', '3 hops · no logs'], ['loading pr1v os', '']];
      x.font = '600 19px monospace'; const n = Math.min(L.length, Math.floor(tt / .1) + 1);
      for (let i = 0; i < n; i++) { const [k, v] = L[i]; x.fillStyle = i === 0 ? LIME : '#9fbf6a'; x.fillText(v ? (k + ' ').padEnd(15, '.') + ' ' + v : k, 34, 52 + i * 34); }
      if (tt > .6) { const p = clamp((tt - .6) / .32); x.strokeStyle = LDIM; x.lineWidth = 2; x.strokeRect(34, 318, 572, 22); x.fillStyle = LIME; x.fillRect(38, 322, 564 * p, 14); }
    } else if (tt < 1.55) { // the mark
      const k = clamp((tt - .95) / .25); x.globalAlpha = k; x.fillStyle = LIME; pixWord(x, (w - 27 * 15) / 2, 110, 15, Math.floor(tt * 4) % 2 === 0);
      x.font = '600 20px monospace'; x.textAlign = 'center'; x.fillStyle = '#9fbf6a'; x.fillText('public chain. pr1v you.', w / 2, 300); x.textAlign = 'left'; x.globalAlpha = 1;
      const sy = ((tt - .95) / .6) * h; x.fillStyle = 'rgba(198,255,61,.10)'; x.fillRect(0, sy - 30, w, 30);
    } else if (tt < 2.95) { // login: user, password, checks
      x.fillStyle = LIME; pixWord(x, 34, 30, 6, false); x.font = '600 15px monospace'; x.fillStyle = '#7d9a4a'; x.fillText('pr1v os · tty1 · ' + new Date().toISOString().slice(0, 10), 220, 52);
      x.strokeStyle = LDIM; x.lineWidth = 2; x.strokeRect(34, 84, 572, 290);
      x.font = '600 22px monospace'; const u = 'anon'.slice(0, Math.floor(clamp((tt - 1.6) / .3) * 4)), pw = Math.floor(clamp((tt - 1.95) / .5) * 8);
      x.fillStyle = '#9fbf6a'; x.fillText('login', 60, 130); x.fillText('password', 60, 172); x.fillStyle = '#e8ffd0'; x.fillText(u, 200, 130);
      x.fillStyle = LIME; for (let i = 0; i < pw; i++) { x.beginPath(); x.arc(208 + i * 24, 165, 7, 0, 7); x.fill(); }
      const cx = tt < 1.95 ? 200 + u.length * 13.4 : 200 + pw * 24; if (Math.floor(tt * 6) % 2 === 0 && tt < 2.45) x.fillRect(cx + 2, tt < 1.95 ? 112 : 154, 11, 22);
      if (tt > 2.45) { const p = clamp((tt - 2.45) / .3); x.fillStyle = '#9fbf6a'; x.fillText('verifying', 60, 222); x.strokeStyle = LDIM; x.strokeRect(200, 205, 300, 20); x.fillStyle = LIME; x.fillRect(203, 208, 294 * p, 14); }
      const C = [['key', 'ok'], ['fingerprint', 'masked'], ['route', '3 hops'], ['session', 'sealed']];
      x.font = '600 18px monospace'; C.forEach(([k, v], i) => { if (tt > 2.55 + i * .08) { x.fillStyle = LIME; x.fillText('✓', 60, 262 + i * 27); x.fillStyle = '#9fbf6a'; x.fillText(k.padEnd(13, ' ') + v, 90, 262 + i * 27); } });
    } else { // access granted
      const f = Math.floor(tt * 14) % 2; x.fillStyle = f ? LIME : '#b4ea36'; x.fillRect(70, 140, 500, 120); x.fillStyle = '#0b0e0b'; x.font = '800 40px monospace'; x.textAlign = 'center'; x.fillText('ACCESS GRANTED', w / 2, 212); x.font = '600 16px monospace'; x.fillText('welcome back, anon', w / 2, 244); x.textAlign = 'left';
    }
    for (let y = 0; y < h; y += 3) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, y, w, 1); }
  }
  if (state === 'term') { x.fillStyle = '#e7e7ea'; x.fillRect(0, 0, w, h); x.fillStyle = '#f5f5f7'; x.fillRect(14, 30, w - 28, h - 44); x.fillStyle = '#e1e1e5'; x.fillRect(14, 30, w - 28, 22); x.fillStyle = '#e1e1e5'; x.fillRect(0, 0, w, 20);
    x.fillStyle = '#26262b'; x.font = '700 11px monospace'; x.fillText('pr1v', 10, 14); x.fillStyle = '#85858f'; x.font = '10px monospace'; x.fillText('pr1v — anon — 160×24', 36, 45);
    x.fillStyle = '#85858f'; x.font = '12px monospace'; x.fillText('last login on ttys001', 30, 76); x.fillStyle = '#4f8d14'; x.font = '700 22px monospace'; x.fillText('pr1v', 30, 110); x.fillStyle = '#26262b'; x.font = '12px monospace'; x.fillText('public chain. pr1v you.', 30, 132);
    x.fillStyle = '#85858f'; x.fillText('anon@laptop ~ %', 30, h - 30); x.fillStyle = '#c6ff3d'; x.fillRect(150, h - 42, 8, 15); }
  screenTex.needsUpdate = true;
}
drawScreen('off', 0);

// ------------------------------------------------------------------ exterior
const OUTS = {};
(function buildOutside() {
  OUT.fog = new THREE.FogExp2('#0a1122', .0065);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: {},
    vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'varying vec3 v; void main(){ float h = clamp(v.y,0.,1.); vec3 c = mix(vec3(.018,.028,.06), vec3(.002,.003,.008), pow(h,.5)); c += vec3(.02,.025,.045) * exp(-h*8.); gl_FragColor = vec4(c,1.); }' }));
  OUT.add(sky);
  const sg = new THREE.BufferGeometry(), sp = []; for (let i = 0; i < 1800; i++) { const t = Math.random() * Math.PI * 2, y = .12 + Math.random() * .88, r = Math.sqrt(1 - y * y); sp.push(Math.cos(t) * r * 400, y * 400, Math.sin(t) * r * 400); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); OUT.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#dfe6ff', size: 1.3, sizeAttenuation: false, transparent: true, opacity: .8, fog: false })));
  const moonT = tex(128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,250,1)'); g.addColorStop(.22, 'rgba(240,240,230,1)'); g.addColorStop(.28, 'rgba(200,210,255,.28)'); g.addColorStop(1, 'rgba(160,180,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonT, fog: false, depthWrite: false, toneMapped: false })); moon.position.set(-150, 150, -330); moon.scale.set(60, 60, 1); OUT.add(moon);

  OUT.add(new THREE.HemisphereLight('#3b4e86', '#0a0f0a', .55));
  const moonL = new THREE.DirectionalLight('#b6c6ff', .55); moonL.position.set(-60, 80, 40); OUT.add(moonL);
  const facadeL = new THREE.SpotLight('#eef2ff', 900, 120, .42, .8, 2); facadeL.position.set(0, 2, -14); facadeL.target.position.set(0, 9, -39); OUT.add(facadeL, facadeL.target);
  for (const s of [-1, 1]) { const u = new THREE.SpotLight('#fff3e0', 260, 40, .5, .9, 2); u.position.set(s * 16, .5, -30); u.target.position.set(s * 16, 10, -39); OUT.add(u, u.target); }

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), M('#0d1810', 1)); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; OUT.add(ground);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 60), M('#4a4a4f', .95)); path.rotation.x = -Math.PI / 2; path.position.set(0, .012, -3); path.receiveShadow = true; OUT.add(path);
  const drive = new THREE.Mesh(new THREE.RingGeometry(14, 18, 64, 1, Math.PI, Math.PI), M('#3c3c41', .95)); drive.rotation.x = -Math.PI / 2; drive.position.set(0, .01, -24); OUT.add(drive);

  const white = M('#dcd8cf', .86), whiteD = M('#c9c4ba', .88);
  const main = new THREE.Mesh(new THREE.BoxGeometry(58, 14, 16), white); main.position.set(0, 7, -47); main.castShadow = main.receiveShadow = true; OUT.add(main);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(58.6, 1.4, 16.6), whiteD); plinth.position.set(0, .7, -47); OUT.add(plinth);
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(59.2, .7, 17.2), white); cornice.position.set(0, 13.9, -47); OUT.add(cornice);
  const band = new THREE.Mesh(new THREE.BoxGeometry(58.4, .35, 16.4), whiteD); band.position.set(0, 7.1, -47); OUT.add(band);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(59, .25, .5), white); rail.position.set(0, 15.25, -39.1); OUT.add(rail);
  const postG = new THREE.CylinderGeometry(.09, .12, .9, 8), posts = new THREE.InstancedMesh(postG, white, 90); const m4 = new THREE.Matrix4(); for (let i = 0; i < 90; i++) { m4.makeTranslation(-29 + i * (58 / 89), 14.7, -39.1); posts.setMatrixAt(i, m4); } OUT.add(posts);
  // windows: warm, a few dimmer
  const wins = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.5, 2.7), new THREE.MeshBasicMaterial({ map: winTex, toneMapped: false }), 48); let wi = 0; const col = new THREE.Color();
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(2.1, .32, .4), white, 48);
  for (const y of [3.6, 10.2]) for (let i = -6; i <= 6; i++) { const x = i * 4.3; if (Math.abs(x) < 1 && y < 5) continue; if (wi >= 48) break; m4.makeTranslation(x, y, -38.96); wins.setMatrixAt(wi, m4); const b = .45 + Math.random() * .55; wins.setColorAt(wi, col.setRGB(b, b, b)); m4.makeTranslation(x, y + 1.62, -38.8); caps.setMatrixAt(wi, m4); wi++; }
  wins.count = caps.count = wi; OUT.add(wins, caps);
  // portico
  const prof = [[0, 0], [.66, 0], [.66, .2], [.56, .3], [.5, .42], [.45, .6], [.42, 9.5], [.48, 9.62], [.58, 9.82], [.66, 10], [.66, 10.2], [0, 10.2]].map(([a, b]) => new THREE.Vector2(a, b));
  const colG = new THREE.LatheGeometry(prof, 28), cols = new THREE.InstancedMesh(colG, white, 8); for (let i = 0; i < 8; i++) { m4.makeTranslation(-8.4 + i * 2.4, .9, -33.6); cols.setMatrixAt(i, m4); } cols.castShadow = true; OUT.add(cols);
  const back = new THREE.InstancedMesh(colG, white, 4); [-8.4, -6, 6, 8.4].forEach((x, i) => { m4.makeTranslation(x, .9, -37.4); back.setMatrixAt(i, m4); }); OUT.add(back);
  const stylo = new THREE.Mesh(new THREE.BoxGeometry(20.4, .9, 6.8), whiteD); stylo.position.set(0, .45, -35.9); stylo.receiveShadow = true; OUT.add(stylo);
  for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(9 - i * .3, .3, .45), whiteD); st.position.set(0, .15 + i * .3 - .3 * 0, -32.2 - i * .45); st.position.y = .15 + i * .3; OUT.add(st); }
  const ent = new THREE.Mesh(new THREE.BoxGeometry(20.6, 1.5, 7.2), white); ent.position.set(0, 11.85, -35.8); OUT.add(ent);
  const tri = new THREE.Shape(); tri.moveTo(-10.6, 0); tri.lineTo(10.6, 0); tri.lineTo(0, 3); tri.closePath();
  const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 7.2, bevelEnabled: false }), white); ped.position.set(0, 12.6, -39.4); OUT.add(ped);
  const tym = new THREE.Shape(); tym.moveTo(-9.2, 0); tym.lineTo(9.2, 0); tym.lineTo(0, 2.3); tym.closePath(); const tymM = new THREE.Mesh(new THREE.ShapeGeometry(tym), whiteD); tymM.position.set(0, 12.85, -32.15); OUT.add(tymM);
  // lantern under the portico
  const lant = new THREE.Mesh(new THREE.CylinderGeometry(.35, .28, .9, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd59a').multiplyScalar(2.4), toneMapped: false })); lant.position.set(0, 8.6, -36); OUT.add(lant);
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 2.2, 4), M('#222', .6)); chain.position.set(0, 10.1, -36); OUT.add(chain);
  const lantL = new THREE.PointLight('#ffcf8a', 12, 12, 2); lantL.position.set(0, 8, -35.5); OUT.add(lantL);
  // door + fanlight + the warm hall behind it
  const hallT = tex(256, 420, (x, w, h) => { x.fillStyle = '#3a2516'; x.fillRect(0, 0, w, h); const g = x.createRadialGradient(w / 2, h * .32, 4, w / 2, h * .4, h * .7); g.addColorStop(0, '#fff1d2'); g.addColorStop(.35, '#e7b977'); g.addColorStop(1, '#3a2314'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(40,22,12,.55)'; x.fillRect(0, 0, 34, h); x.fillRect(w - 34, 0, 34, h); x.fillStyle = '#7d1f24'; x.beginPath(); x.moveTo(w * .42, h * .62); x.lineTo(w * .58, h * .62); x.lineTo(w * .8, h); x.lineTo(w * .2, h); x.fill();
  x.fillStyle = 'rgba(255,240,200,.9)'; x.beginPath(); x.arc(w / 2, h * .2, 10, 0, 7); x.fill(); });
  const hall = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.3), new THREE.MeshBasicMaterial({ map: hallT, color: '#9a9a9a', toneMapped: false })); hall.position.set(0, 3.05, -39.3); OUT.add(hall);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 5, .3), whiteD); frame.position.set(0, 3.4, -38.98); OUT.add(frame);
  const hole = new THREE.Mesh(new THREE.BoxGeometry(2.6, 4.3, .5), new THREE.MeshBasicMaterial({ color: '#000' })); hole.visible = false;
  const fan = new THREE.Mesh(new THREE.CircleGeometry(1.25, 32, 0, Math.PI), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd28f').multiplyScalar(1.6), toneMapped: false })); fan.position.set(0, 5.25, -38.8); OUT.add(fan);
  const doorM = M('#22303a', .6, .1), doors = [];
  for (const s of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(s * 1.3, .9, -38.75); const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.3, 4.3, .12), doorM); leaf.position.set(-s * .65, 2.15, 0); piv.add(leaf);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 8), M('#c9a54e', .3, .8)); knob.position.set(-s * 1.15, 2.1, .1); piv.add(knob); OUT.add(piv); doors.push({ piv, s }); }
  frame.position.z = -38.9; frame.scale.set(1, 1, 1); frame.material = whiteD;
  const frameHole = new THREE.Object3D(); OUT.add(frameHole);
  const doorLight = new THREE.PointLight('#ffd7a0', 0, 16, 1.5); doorLight.position.set(0, 3, -37.6); OUT.add(doorLight);
  // flag on the roof
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, 7, 8), M('#cfcfcf', .4, .6)); pole.position.set(0, 18.5, -47); OUT.add(pole);
  const flagG = new THREE.PlaneGeometry(4, 2.1, 30, 12); flagG.translate(2, 0, 0);
  const flag = new THREE.Mesh(flagG, new THREE.ShaderMaterial({ uniforms: { map: { value: flagTex }, t: { value: 0 } }, side: THREE.DoubleSide,
    vertexShader: 'uniform float t; varying vec2 vU; varying float vS; void main(){ vU = uv; vec3 p = position; float a = p.x/4.; p.z += sin(p.x*1.6 - t*3.2)*.28*a + sin(p.x*3.1 - t*5.)*.06*a; p.y -= a*a*.18; vS = cos(p.x*1.6 - t*3.2); gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.); }',
    fragmentShader: 'uniform sampler2D map; varying vec2 vU; varying float vS; void main(){ vec3 c = texture2D(map, vU).rgb; c *= .55 + vS*.18; gl_FragColor = vec4(c,1.);\n#include <colorspace_fragment>\n}' }));
  flag.position.set(.06, 21.2, -47); OUT.add(flag);
  const flagL = new THREE.SpotLight('#ffffff', 60, 20, .35, .6, 1.2); flagL.position.set(4, 15, -40); flagL.target = flag; OUT.add(flagL);
  // lamps along the path, with pools of light on the ground
  const poolT = tex(128, 128, (x, w) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,214,150,.28)'); g.addColorStop(1, 'rgba(255,214,150,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const poleM = M('#15161a', .5, .4), headM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe0aa').multiplyScalar(2.6), toneMapped: false });
  for (const z of [-28, -20, -12, -4, 4, 12]) for (const s of [-1, 1]) { const x = s * 3.4; const p = new THREE.Mesh(new THREE.CylinderGeometry(.06, .09, 3.2, 8), poleM); p.position.set(x, 1.6, z); OUT.add(p);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 10), headM); hd.position.set(x, 3.35, z); OUT.add(hd);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5), new THREE.MeshBasicMaterial({ map: poolT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); pool.rotation.x = -Math.PI / 2; pool.position.set(x, .03, z); OUT.add(pool); }
  for (const z of [-28, -20]) { const l = new THREE.PointLight('#ffd49a', 10, 11, 2); l.position.set(0, 3.2, z); OUT.add(l); }
  // hedges and trees
  const hedge = M('#0f1f14', 1);
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.BoxGeometry(17, 1.1, 1.4), hedge); h.position.set(s * 20.5, .55, -37.6); OUT.add(h); const h2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, .8, 26), hedge); h2.position.set(s * 2.9, .4, -15); OUT.add(h2); }
  const treeG = new THREE.IcosahedronGeometry(1, 1), trees = new THREE.InstancedMesh(treeG, M('#0b160f', 1), 60); let ti = 0; const q = new THREE.Quaternion(), sc = new THREE.Vector3();
  for (let i = 0; i < 60; i++) { const s = i % 2 ? 1 : -1, x = s * (24 + Math.random() * 46), z = -20 - Math.random() * 50, r = 2.4 + Math.random() * 3; if (Math.abs(x) < 34 && z < -36) continue; m4.compose(V(x, r * .9, z), q, sc.set(r, r * 1.25, r)); trees.setMatrixAt(ti++, m4); }
  trees.count = ti; OUT.add(trees);
  Object.assign(OUTS, { doors, frameHole, hall, doorLight, flag, facadeL, lantL });
})();

// ------------------------------------------------------------------ interior: an oval office
const INS = {};
(function buildInside() {
  const RX = 5.8, RZ = 4.6, HH = 5.6; const at = (a, s = 1) => V(Math.cos(a) * RX * s, 0, Math.sin(a) * RZ * s);
  IN.background = new THREE.Color('#120d08'); IN.fog = new THREE.Fog('#1b140d', 12, 30);
  const cream = M('#ece2cc', .92), creamD = M('#dfd2b6', .9), gold = M('#c4a04c', .38, .7), walnut = M('#4a2b1a', .5), walnutL = M('#5d3722', .5);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, HH, 160, 1, true), cream); wall.material = cream.clone(); wall.material.side = THREE.BackSide; wall.scale.set(RX, 1, RZ); wall.position.y = HH / 2; wall.receiveShadow = true; IN.add(wall);
  const wains = new THREE.Mesh(new THREE.CylinderGeometry(.992, .992, 1.05, 160, 1, true), creamD); wains.material = creamD.clone(); wains.material.side = THREE.BackSide; wains.scale.set(RX, 1, RZ); wains.position.y = .525; IN.add(wains);
  const rimG = new THREE.TorusGeometry(1, .012, 6, 160); for (const [y, s] of [[1.07, .99], [HH - .2, .985], [HH - .45, .985]]) { const r = new THREE.Mesh(rimG, creamD); r.rotation.x = Math.PI / 2; r.scale.set(RX * s, RZ * s, 1.4); r.position.y = y; IN.add(r); }
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 96), M('#ffffff', .55, 0, { map: woodTex })); floor.rotation.x = -Math.PI / 2; floor.scale.set(RX, RZ, 1); floor.receiveShadow = true; IN.add(floor);
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1, 96), M('#ffffff', .95, 0, { map: rugTex })); rug.rotation.x = -Math.PI / 2; rug.scale.set(4.4, 3.45, 1); rug.position.y = .008; rug.receiveShadow = true; IN.add(rug);
  const ceil = new THREE.Mesh(new THREE.CircleGeometry(1, 96), creamD); ceil.rotation.x = Math.PI / 2; ceil.scale.set(RX, RZ, 1); ceil.position.y = HH; IN.add(ceil);
  const lightRing = new THREE.Mesh(new THREE.TorusGeometry(1, .03, 6, 96), new THREE.MeshBasicMaterial({ color: '#fff0d0', toneMapped: false })); lightRing.rotation.x = Math.PI / 2; lightRing.scale.set(1.3, 1, 1); lightRing.position.y = HH - .02; IN.add(lightRing);
  // pilasters around the oval
  const pil = new THREE.InstancedMesh(new THREE.BoxGeometry(.28, HH - .7, .1), creamD, 16); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = V(1, 1, 1); let pi = 0;
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + Math.PI / 16; const p = at(a, .985); p.y = (HH - .7) / 2 + .2; q.setFromEuler(new THREE.Euler(0, -a + Math.PI / 2, 0)); const sinA = Math.sin(a); if (sinA < -.82 || Math.abs(Math.cos(a)) > .97) continue; m4.compose(p, q, one); pil.setMatrixAt(pi++, m4); } pil.count = pi; IN.add(pil);
  // three tall windows behind the desk, with gold drapes
  const drapeG = new THREE.PlaneGeometry(.62, 3.7, 24, 1); { const p = drapeG.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 28) * .045); drapeG.computeVertexNormals(); }
  const drapeM = M('#c39a3f', .62, .05, { side: THREE.DoubleSide });
  for (const a of [-Math.PI / 2, -Math.PI / 2 - .44, -Math.PI / 2 + .44]) { const p = at(a, .99); const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.lookAt(0, 0, 0); IN.add(g);
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 3.1), new THREE.MeshBasicMaterial({ map: nightWin, toneMapped: false, color: '#b8c4e6' })); w.position.set(0, 2.55, .05); g.add(w);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(1.45, 3.3, .06), creamD); fr.position.set(0, 2.55, -.01); g.add(fr);
    for (const s of [-1, 1]) { const d = new THREE.Mesh(drapeG, drapeM); d.position.set(s * .86, 2.45, .1); d.castShadow = true; g.add(d); }
    const val = new THREE.Mesh(new THREE.BoxGeometry(2.3, .38, .16), drapeM); val.position.set(0, 4.42, .12); g.add(val); }
  const winL = new THREE.PointLight('#4f6bb8', 6, 7, 1.5); winL.position.set(0, 2.4, -3.9); IN.add(winL);
  // fireplace on the far wall
  { const p = at(Math.PI / 2, .99); const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.lookAt(0, 0, 0); IN.add(g);
    const mantel = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.4, .32), M('#f4efe4', .4)); mantel.position.set(0, .7, .1); g.add(mantel);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.3, .1, .45), M('#f4efe4', .4)); shelf.position.set(0, 1.45, .15); g.add(shelf);
    const fire = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .7), new THREE.MeshBasicMaterial({ color: '#ff8a2a', toneMapped: false })); fire.position.set(0, .5, .27); g.add(fire);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .9), new THREE.MeshStandardMaterial({ map: paintTex(205), roughness: .8 })); pic.position.set(0, 2.7, .03); g.add(pic);
    const pf = new THREE.Mesh(new THREE.BoxGeometry(1.36, 1.06, .05), gold); pf.position.set(0, 2.7, 0); g.add(pf);
    INS.fireL = new THREE.PointLight('#ff8c3a', 8, 6, 1.6); INS.fireL.position.set(p.x * .85, .7, p.z * .85); IN.add(INS.fireL); }
  for (const [a, hue] of [[Math.PI * .82, 30], [Math.PI * .18, 160], [Math.PI * 1.13, 260], [-Math.PI * .13, 90]]) { const p = at(a, .985); const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.lookAt(0, 0, 0); IN.add(g);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(.9, .65), new THREE.MeshStandardMaterial({ map: paintTex(hue), roughness: .8 })); pic.position.set(0, 2.5, .04); g.add(pic); const pf = new THREE.Mesh(new THREE.BoxGeometry(1.04, .79, .05), gold); pf.position.set(0, 2.5, .01); g.add(pf); }
  // side door the anon comes through
  { const p = at(Math.PI, .99); const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.lookAt(0, 0, 0); IN.add(g);
    const lit = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.5), new THREE.MeshBasicMaterial({ color: '#ffe6bd', toneMapped: false })); lit.position.set(0, 1.25, -.02); g.add(lit);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.85, .08), creamD); fr.position.set(0, 1.42, -.04); g.add(fr);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.08, 2.46, .06), M('#f1ebdd', .6)); leaf.position.set(-.9, 1.24, .45); leaf.rotation.y = -1.25; g.add(leaf);
    const dl = new THREE.PointLight('#ffd9a8', 5, 5, 1.6); dl.position.set(p.x * .85, 1.6, p.z); IN.add(dl); }
  // the desk
  const desk = new THREE.Group(); desk.position.set(0, 0, -2.7); IN.add(desk);
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, .74, 1.0), walnut); body.position.y = .37; body.castShadow = body.receiveShadow = true; desk.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.32, .05, 1.1), walnutL); top.position.y = .765; top.castShadow = top.receiveShadow = true; desk.add(top);
  const inlay = new THREE.Mesh(new THREE.PlaneGeometry(2.0, .86), M('#2c3a2c', .8)); inlay.rotation.x = -Math.PI / 2; inlay.position.set(0, .791, 0); desk.add(inlay);
  for (const [x, w] of [[-.72, .6], [0, .62], [.72, .6]]) { const pnl = new THREE.Mesh(new THREE.BoxGeometry(w, .5, .03), walnutL); pnl.position.set(x, .38, .51); desk.add(pnl); const rim = new THREE.Mesh(new THREE.BoxGeometry(w - .12, .38, .02), walnut); rim.position.set(x, .38, .53); desk.add(rim); }
  const kick = new THREE.Mesh(new THREE.BoxGeometry(2.24, .06, 1.04), M('#2f1b10', .5)); kick.position.y = .03; desk.add(kick);
  const papers = new THREE.Mesh(new THREE.BoxGeometry(.24, .02, .32), M('#cfcac0', .95)); papers.position.set(.62, .8, -.05); papers.rotation.y = .2; desk.add(papers);
  const pens = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .12, 12), M('#1e1e22', .4, .5)); pens.position.set(-.7, .85, .1); desk.add(pens);
  const lampB = new THREE.Mesh(new THREE.CylinderGeometry(.07, .1, .38, 12), gold); lampB.position.set(-.86, .98, -.2); desk.add(lampB);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(.11, .2, .2, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#f3e1b8', emissive: '#ffd9a0', emissiveIntensity: 1.1, side: THREE.DoubleSide })); shade.position.set(-.86, 1.24, -.2); desk.add(shade);
  const lampL = new THREE.PointLight('#ffd49a', 3.5, 4, 1.6); lampL.position.set(-.86, 1.2, -2.9); IN.add(lampL);
  // chair
  const leather = M('#3b2219', .55);
  const chair = new THREE.Group(); chair.position.set(0, 0, -3.76); IN.add(chair);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(.66, .12, .6), leather); seat.position.y = .44; chair.add(seat);
  const cback = new THREE.Mesh(new THREE.BoxGeometry(.7, 1.05, .14), leather); cback.position.set(0, 1.02, -.3); cback.rotation.x = -.08; chair.add(cback);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(.08, .1, .5), leather); arm.position.set(s * .36, .68, -.02); chair.add(arm); const ap = new THREE.Mesh(new THREE.BoxGeometry(.05, .24, .05), M('#1f1f22', .4, .6)); ap.position.set(s * .36, .55, .1); chair.add(ap); }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .32, 10), M('#1f1f22', .4, .6)); stem.position.y = .22; chair.add(stem);
  for (let i = 0; i < 5; i++) { const lg = new THREE.Mesh(new THREE.BoxGeometry(.04, .04, .34), M('#1f1f22', .4, .6)); lg.position.set(Math.sin(i * 1.2566) * .16, .05, Math.cos(i * 1.2566) * .16); lg.rotation.y = i * 1.2566; chair.add(lg); }
  chair.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // the laptop: hinge on the far side, screen facing the chair
  const lap = new THREE.Group(); lap.position.set(0, .79, -3.0); IN.add(lap);
  const graphite = M('#2b2b30', .45, .35), graphiteL = M('#37373d', .5, .3);
  const base = new THREE.Mesh(new THREE.BoxGeometry(.34, .016, .235), graphite); base.position.y = .008; base.castShadow = true; lap.add(base);
  const kb = new THREE.Mesh(new THREE.PlaneGeometry(.29, .1), M('#141417', .7)); kb.rotation.x = -Math.PI / 2; kb.position.set(0, .0165, .025); lap.add(kb);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(.1, .055), graphiteL); pad.rotation.x = -Math.PI / 2; pad.position.set(0, .0166, -.075); lap.add(pad);
  const hinge = new THREE.Group(); hinge.position.set(0, .016, .1175); lap.add(hinge);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(.34, .01, .235), graphite); lid.position.set(0, .005, -.1175); lid.castShadow = true; hinge.add(lid);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(.31, .2), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, color: '#e4e4e4' })); scr.rotation.x = Math.PI / 2; scr.rotation.z = Math.PI; scr.position.set(0, -.0006, -.1175); hinge.add(scr);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(.02, .02), new THREE.MeshBasicMaterial({ color: '#c6ff3d', toneMapped: false })); logo.rotation.x = -Math.PI / 2; logo.position.set(0, .0102, -.12); hinge.add(logo);
  const scrL = new THREE.PointLight('#e2f0d0', 0, 1.4, 2); scrL.position.set(0, 1.0, -3.15); IN.add(scrL);
  // flag beside the windows
  { const pole = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, 2.6, 8), gold); pole.position.set(-2.75, 1.3, -3.72); IN.add(pole); const fin = new THREE.Mesh(new THREE.SphereGeometry(.06, 10, 8), gold); fin.position.set(-2.75, 2.65, -3.72); IN.add(fin);
    const fg = new THREE.PlaneGeometry(1.0, 1.55, 16, 1); { const p = fg.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 22) * .04); fg.computeVertexNormals(); }
    const ft = flagTex.clone(); ft.needsUpdate = true; ft.center.set(.5, .5); ft.rotation = -Math.PI / 2;
    const f = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: ft, roughness: .9, side: THREE.DoubleSide })); f.position.set(-2.75 + .52, 1.75, -3.66); f.rotation.y = .5; IN.add(f); }
  // sofas and a coffee table
  const sofaM = M('#d8c9a8', .9);
  for (const s of [-1, 1]) { const g = new THREE.Group(); g.position.set(s * 1.75, 0, 1.25); IN.add(g); const st = new THREE.Mesh(new THREE.BoxGeometry(.85, .42, 2.1), sofaM); st.position.y = .25; g.add(st);
    const bk = new THREE.Mesh(new THREE.BoxGeometry(.24, .5, 2.1), sofaM); bk.position.set(s * .37, .7, 0); g.add(bk); for (const z of [-1, 1]) { const ar = new THREE.Mesh(new THREE.BoxGeometry(.85, .28, .2), sofaM); ar.position.set(0, .58, z * 1.02); g.add(ar); }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); }
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.0, .08, 1.5), walnutL); table.position.set(0, .42, 1.25); table.castShadow = true; IN.add(table);
  for (const [x, z] of [[-.42, -.66], [.42, -.66], [-.42, .66], [.42, .66]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(.06, .4, .06), walnut); l.position.set(x, .2, 1.25 + z); IN.add(l); }
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(.14, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M('#e9e3d4', .3, .1)); bowl.rotation.x = Math.PI; bowl.position.set(0, .6, 1.25); IN.add(bowl);
  // lights
  IN.add(new THREE.HemisphereLight('#fff1d8', '#3a2414', .32));
  const ceilL = new THREE.PointLight('#ffe8c4', 11, 14, 1.5); ceilL.position.set(0, 4.8, 0); IN.add(ceilL);
  const key = new THREE.SpotLight('#ffe2b8', 48, 14, .5, .6, 1.3); key.position.set(1.6, 5.2, .6); key.target.position.set(0, .7, -2.9); key.castShadow = true; key.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024); key.shadow.bias = -.0004; IN.add(key, key.target);
  Object.assign(INS, { hinge, scrL, lap });
})();

// ------------------------------------------------------------------ first person: you are the one walking in
// your hands: dark sleeves and gloves, only once you sit down
const HANDS = (() => { const sleeve = M('#18181c', .95), glove = M('#0e0e10', .75); const mk = () => { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.CapsuleGeometry(.043, 1, 4, 12), sleeve); const cuff = new THREE.Mesh(new THREE.CylinderGeometry(.046, .046, .04, 14), M('#121215', .9));
    const h = new THREE.Mesh(new THREE.SphereGeometry(.05, 14, 12), glove); h.scale.set(1.0, .5, 1.35); g.add(s, cuff, h); IN.add(g); return { g, s, cuff, h }; }; return [mk(), mk()]; })();
const UP = V(0, 1, 0);
function placeArm(A, from, to, vis) {
  A.g.visible = vis; if (!vis) return; const dir = to.clone().sub(from), L = dir.length(); dir.normalize();
  const wrist = to.clone().sub(dir.clone().multiplyScalar(.06));
  const len = Math.max(.05, wrist.distanceTo(from)); A.s.scale.set(1, len, 1); A.s.position.copy(from.clone().add(wrist).multiplyScalar(.5)); A.s.quaternion.setFromUnitVectors(UP, dir);
  A.cuff.position.copy(wrist); A.cuff.quaternion.copy(A.s.quaternion);
  A.h.position.copy(to); A.h.quaternion.setFromUnitVectors(V(0, 0, 1), V(dir.x, 0, dir.z).normalize()); }
const inPath = [V(-5.25, 0, .2), V(-3.9, 0, -.45), V(-2.65, 0, -1.6), V(-1.75, 0, -3.05), V(-.9, 0, -3.5), V(-.35, 0, -3.62)];
const segs = []; let tot = 0; for (let i = 1; i < inPath.length; i++) { const l = inPath[i].distanceTo(inPath[i - 1]); segs.push(l); tot += l; }
const along = d => { d = clamp(d, 0, tot); for (let i = 0; i < segs.length; i++) { if (d <= segs[i] || i === segs.length - 1) { const t = clamp(d / segs[i]); return { p: inPath[i].clone().lerp(inPath[i + 1], t), dir: inPath[i + 1].clone().sub(inPath[i]).normalize() }; } d -= segs[i]; } };
const ramp = (t, t0, v) => v * (Math.sqrt((t - t0) * (t - t0) + .09) + (t - t0)) / 2; // eases from standing into a steady walk
const scrC = V(0, .9195, -2.852), seatEye = V(0, 1.2, -3.66);
const look = new THREE.Vector3(), eye = new THREE.Vector3();

function frame(t) {
  const inside = t >= CUT;
  rp.scene = inside ? IN : OUT;
  OUTS.flag.material.uniforms.t.value = t; film.uniforms.t.value = t;
  let fadeA = 0, fadeC = '#fff2dc', grain = 1;
  if (!inside) {
    // standing on the lawn path: look up at the flag, then walk to the door. it opens. walk into the light.
    const lawn = t < 1.62;
    const d = lawn ? 0 : Math.min(11.4, ramp(t, 1.85, 2.55)), z = lawn ? -5 + t * .9 : -26.5 - d, walk = lawn ? 0 : ss(1.7, 2.4, t) * (1 - ss(6.0, 6.6, t));
    const ph = d * Math.PI / .78, lift = clamp((-32.1 - z) / 1.35) * .9;
    eye.set(Math.sin(ph) * .016 * walk, 1.68 + lift + (Math.abs(Math.sin(ph)) - .5) * .045 * walk, z);
    if (lawn) look.set(Math.sin(t * .8) * 2.2, 9.2 + t * .5, -40);
    else look.set(0, lerp(2.9, 9.5, 1 - ss(1.7, 3.8, t)), -39).lerp(V(0, 2.7, -39.4), ss(4.6, 6.1, t));
    camera.position.copy(eye); camera.up.set(Math.sin(ph) * .008 * walk, 1, 0); camera.lookAt(look);
    const open = ss(4.3, 5.4, t); OUTS.facadeL.intensity = 900 * (1 - ss(2.6, 4.6, t) * .9); OUTS.lantL.intensity = 12 * (1 - ss(3.5, 5, t) * .6); OUTS.doors.forEach(o => o.piv.rotation.y = -o.s * open * 1.45); OUTS.frameHole.visible = open > .02; OUTS.doorLight.intensity = open * 9;
    fadeA = ss(6.2, 6.68, t); if (t < 2.1) { fadeC = '#000'; fadeA = ss(1.38, 1.62, t) * (1 - ss(1.66, 2.05, t)); }
  } else {
    const ti = t - CUT;
    // through the side door of the oval office, along the rug, round the desk
    const d = Math.min(tot, ramp(ti, .15, 2.0)), P = along(d), walk = ss(0, .5, ti) * (1 - ss(3.0, 3.5, ti)), ph = (d + 12) * Math.PI / .78;
    const sit = ss(3.35, 4.25, ti), turn = ss(3.05, 4.0, ti);
    const pos = V(P.p.x + Math.sin(ph) * .014 * walk, 1.66 + (Math.abs(Math.sin(ph)) - .5) * .04 * walk, P.p.z).lerp(seatEye, sit);
    const ahead = P.p.clone().add(P.dir.clone().multiplyScalar(3)); ahead.y = 1.45;
    const deskLook = V(.2, 1.1, -2.6), aim = ahead.lerp(deskLook, .35 + .25 * ss(1.4, 2.8, ti));
    const seated = V(0, .88, -2.95);
    look.copy(aim).lerp(V(.6, 1.2, 1.5), turn * (1 - sit)).lerp(seated, sit);
    // laptop: your hands open it, it wakes, you type the password, it becomes a terminal
    const lidA = ss(4.45, 5.25, ti); INS.hinge.rotation.x = lidA * 1.83; INS.hinge.updateWorldMatrix(true, false);
    INS.scrL.intensity = ss(4.9, 5.3, ti) * 2.2;
    if (ti < 5.0) drawScreen('off', 0); else if (ti < 8.3) drawScreen('seq', ti - 5.0); else drawScreen('term', 0);
    INS.fireL.intensity = 7 + Math.sin(t * 11) * 1.2 + Math.sin(t * 17.3) * .8;
    // the dive
    const dv = ss(8.3, 9.55, ti); const readP = seatEye.clone().lerp(V(0, 1.075, -3.33), ss(4.95, 6.3, ti));
    if (dv > 0) { pos.copy(bez(readP, V(0, 1.05, -3.27), V(0, 1.01, -3.2), V(0, .997, -3.142), dv)); look.copy(scrC); }
    else if (sit > .9) { pos.copy(readP); look.lerp(scrC, ss(4.9, 6.2, ti)); }
    camera.position.copy(pos); camera.up.set(0, 1, 0); camera.lookAt(look);
    // arms, from just below your view
    const hv = ss(4.0, 4.6, ti), rgt = V(1, 0, 0), sh = k => seatEye.clone().add(rgt.clone().multiplyScalar(k * .25)).add(V(0, -.6, -.12));
    const typ = (ss(6.55, 6.65, ti) * (1 - ss(6.9, 6.95, ti))) + (ss(6.95, 7.0, ti) * (1 - ss(7.45, 7.5, ti)));
    const kL = V(-.075, .833 + Math.max(0, Math.sin(ti * 31)) * .012 * typ, -3.03), kR0 = V(.075, .833 + Math.max(0, Math.sin(ti * 27 + 1.3)) * .012 * typ, -3.03);
    const lidEdge = INS.hinge.localToWorld(V(.09, .012, -.225));
    const kR = lidA > 0 && lidA < 1 ? lidEdge : kR0.clone().lerp(lidEdge, 1 - ss(5.25, 5.6, ti)) ;
    const drop = (1 - hv) * .35; kL.y -= drop; kR.y -= drop; kL.z -= drop * .6; kR.z -= drop * .6;
    HANDS[0].g.visible = HANDS[1].g.visible = false; // first person, no body in frame
    fadeA = 1 - ss(0, .45, ti); fadeC = '#fff2dc'; grain = 1 - ss(8.6, 9.5, ti);
    if (ti > 9.4) { fadeC = document.documentElement.dataset.theme === 'dark' ? '#08080a' : '#e7e7ea'; fadeA = ss(9.4, 9.85, ti); }
  }
  film.uniforms.amt.value = grain;
  if (fadeEl) { fadeEl.style.background = fadeC; fadeEl.style.opacity = fadeA.toFixed(3); }
  composer.render();
}

// ------------------------------------------------------------------ run
resize();
if (AT != null) { frame(AT); window.__introAt = t => frame(t); window.__introReady = true; return; }
let t0 = null, T = 0, finished = false, skipTo = null;
function finish() { if (finished) return; finished = true; done(); setTimeout(() => { renderer.dispose(); composer.dispose && composer.dispose(); }, 400); }
function skip() { if (finished) return; if (T < END - .9) skipTo = END - .9; }
skipBtn && skipBtn.addEventListener('click', e => { e.stopPropagation(); skip(); });
canvas.addEventListener('pointerdown', skip); addEventListener('keydown', e => { if (!finished && !e.metaKey && !e.ctrlKey) skip(); });
let last = performance.now();
function loop(now) {
  if (finished) return; requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (t0 == null) t0 = now;
  if (skipTo != null) { T = Math.max(T, skipTo); skipTo = null; } else T += dt;
  frame(Math.min(T, END));
  if (T >= END) finish();
}
requestAnimationFrame(loop);
}
