/* pr1v terminal. everything here reads public chain data or runs in your browser. */
(() => {
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const short = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const nf = (n, d = 0) => n == null || isNaN(n) ? '—' : (+n).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const usd = v => v == null || isNaN(v) ? '—' : '$' + (v >= 1e6 ? nf(v / 1e6, 2) + 'M' : v >= 1e4 ? nf(v / 1e3, 1) + 'K' : nf(v, v < 10 ? 2 : 0));
const big = v => v == null ? '—' : v >= 1e9 ? nf(v / 1e9, 2) + 'B' : v >= 1e6 ? nf(v / 1e6, 2) + 'M' : v >= 1e4 ? nf(v / 1e3, 1) + 'K' : nf(v, v < 1 ? 4 : 2);
const day = t => t ? new Date(t * 1000).toISOString().slice(0, 10) : '—';
const ago = t => { if (!t) return '—'; const s = Date.now() / 1000 - t; return s < 90 ? 'now' : s < 3600 ? Math.round(s / 60) + 'm' : s < 86400 ? Math.round(s / 3600) + 'h' : Math.round(s / 86400) + 'd'; };
const isAddr = s => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s || '');
const isSig = s => /^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(s || '');
const scan = a => `https://solscan.io/account/${a}`, txl = s => `https://solscan.io/tx/${s}`;
const store = { get(k, d) { try { const v = localStorage.getItem('pr1v.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('pr1v.' + k, JSON.stringify(v)); } catch { } } };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const NET = { ms: 0, ok: true, calls: 0 };
let WALLET = null, BUSY = false, CANCEL = false, LAST = null, KEYS = null, IDX = null;
const HIST = store.get('hist', []); let HI = HIST.length;

// ------------------------------------------------------------ output
const OUT = $('#out');
const atBottom = () => OUT.scrollHeight - OUT.scrollTop - OUT.clientHeight < 80;
function scrollDown(force) { if (force || atBottom()) OUT.scrollTop = OUT.scrollHeight; }
function ln(html = '', cls = '') { const d = document.createElement('div'); d.className = 'ln ' + cls; d.innerHTML = html; const f = atBottom(); OUT.appendChild(d); if (f) OUT.scrollTop = OUT.scrollHeight; return d; }
function pre(text, cls = '') { const d = document.createElement('pre'); d.className = 'bk ' + cls; d.innerHTML = text; const f = atBottom(); OUT.appendChild(d); if (f) OUT.scrollTop = OUT.scrollHeight; return d; }
function html(h) { const d = document.createElement('div'); d.innerHTML = h; const f = atBottom(); OUT.appendChild(d); if (f) OUT.scrollTop = OUT.scrollHeight; return d; }
const hd = t => ln(`<span class="rule">──</span> <b>${t}</b> <span class="rule">${'─'.repeat(Math.max(4, 46 - t.replace(/<[^>]+>/g, '').length))}</span>`, 'hd');
const cmd = (c, label) => `<a class="cmd" data-run="${esc(c)}">${esc(label || c)}</a>`;
const addr = a => `<a class="cmd" data-run="opsec ${a}" title="${a}">${short(a)}</a>`;
function spin(text) {
  const F = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'; let i = 0; const d = ln(`<i>${F[0]}</i>${text}`, 'spin');
  const t = setInterval(() => { const ii = d.querySelector('i'); if (ii) ii.textContent = F[i++ % F.length]; }, 80);
  return { set(h) { d.innerHTML = `<i>${F[i % F.length]}</i>${h}`; }, ok(h) { clearInterval(t); d.className = 'ln ok dim'; d.innerHTML = h || text; }, fail(h) { clearInterval(t); d.className = 'ln fail'; d.innerHTML = `<span class="red">${h}</span>`; } };
}
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 2600); }
const copy = (v, m = 'copied') => { navigator.clipboard && navigator.clipboard.writeText(v).then(() => toast(m), () => toast('copy failed')); };
const spark = (arr, w = 1) => { const B = '▁▂▃▄▅▆▇█', m = Math.max(1, ...arr); return arr.map(v => (v ? B[Math.min(7, Math.round(v / m * 7))] : ' ').repeat(w)).join(''); };
const bar = (v, n = 20) => '█'.repeat(Math.round(v / 100 * n)) + '░'.repeat(n - Math.round(v / 100 * n));

// ------------------------------------------------------------ api + wallet
async function api(a, q = {}, body) {
  const u = '/api/pr1v?a=' + a + (Object.keys(q).length ? '&' + new URLSearchParams(q) : '');
  let r; const t0 = performance.now(); try { r = await fetch(u, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}); } catch { NET.ok = false; throw new Error('no connection to pr1v'); }
  const ms = performance.now() - t0; NET.ms = NET.ms ? NET.ms * .7 + ms * .3 : ms; NET.ok = r.ok || r.status < 500; NET.calls++;
  const j = await r.json().catch(() => ({ error: 'pr1v answered with something unreadable (' + r.status + ')' }));
  if (!r.ok || (j && j.error)) throw new Error(j.error || 'error ' + r.status); return j;
}
const prov = () => (window.phantom && window.phantom.solana) || window.solflare || window.backpack || window.solana || null;
let web3P = null; const web3 = () => web3P || (web3P = new Promise((ok, no) => { if (window.solanaWeb3) return ok(window.solanaWeb3); const s = document.createElement('script'); s.src = '/assets/web3.min.js'; s.onload = () => ok(window.solanaWeb3); s.onerror = () => no(new Error('could not load the signer')); document.head.appendChild(s); }));
async function connect(quiet) {
  const p = prov(); if (!p) { ln('no Solana wallet in this browser. open pr1v inside Phantom, Solflare or Backpack, or install one.', 'red'); return null; }
  try { const r = await p.connect(); WALLET = (r && r.publicKey || p.publicKey).toString(); KEYS = null; walletUI(); if (!quiet) ln(`connected ${addr(WALLET)}. pr1v never sees your keys: you sign everything in your wallet.`, 'ok'); return WALLET; }
  catch { ln('connection cancelled', 'dim'); return null; }
}
function walletUI() { setTimeout(watchW, 0); const b = $('#wallet'); b.textContent = WALLET ? short(WALLET) : 'connect'; b.classList.toggle('on', !!WALLET); $('#ttl').textContent = `pr1v — ${WALLET ? short(WALLET) : 'anon'} — 160×24`; dropW(); }
async function disconnect() { const p = prov(); try { p && p.disconnect && await p.disconnect(); } catch { } WALLET = null; KEYS = null; walletUI(); ln('disconnected', 'dim'); }
const b64u8 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0)), u8b64 = u => { let s = ''; for (const b of u) s += String.fromCharCode(b); return btoa(s); };
async function signSend(b64) { const S = await web3(), tx = S.Transaction.from(b64u8(b64)), p = prov(); const s = await p.signTransaction(tx); return (await api('send', {}, { tx: u8b64(s.serialize()) })).sig; }
async function confirmTx(sig, sp) { for (let i = 0; i < 40; i++) { const s = await api('status', { sig }).catch(() => ({})); if (s.status === 'failed') throw new Error('the transaction failed on-chain'); if (s.status === 'confirmed' || s.status === 'finalized') return sig; sp && sp.set(`confirming <a href="${txl(sig)}" target="_blank" rel="noopener">${short(sig)}</a>…`); await sleep(1500); } throw new Error('not confirmed yet. check your wallet'); }
async function needWallet() { return WALLET || await connect(); }
async function target(arg) { if (!arg || arg === 'me' || arg === 'mine') { if (!WALLET) { ln(`no wallet given. type ${cmd('opsec ', 'opsec <wallet>')} or connect to scan your own.`, 'dim'); const w = await connect(); return w; } return WALLET; } if (!isAddr(arg)) { ln(`<span class="red">“${esc(arg.slice(0, 60))}” is not a Solana address.</span>`); return null; } return arg; }

// ------------------------------------------------------------ the scan
async function readHistory(w, pages, sp) {
  let all = [], before = null, complete = false;
  for (let i = 0; i < pages; i++) { if (CANCEL) throw new Error('cancelled'); const p = await api('sigs', before ? { w, before } : { w }); all = all.concat(p); sp && sp.set(`reading history… ${nf(all.length)} transactions`); if (p.length < 1000) { complete = true; break; } before = p[p.length - 1].s; }
  return { sigs: all, complete };
}
async function readTxs(w, sigs, n, sp) {
  const list = sigs.filter(s => !s.e).slice(0, n).map(s => s.s); const out = [];
  for (let i = 0; i < list.length; i += 30) { if (CANCEL) throw new Error('cancelled'); out.push(...await api('txs', { w, s: list.slice(i, i + 30).join(',') })); sp && sp.set(`reading transactions… ${out.length}/${list.length}`); }
  return out;
}
function clockOf(times) {
  const h = new Array(24).fill(0), d = new Array(7).fill(0); for (const t of times) { if (!t) continue; const D = new Date(t * 1000); h[D.getUTCHours()]++; d[D.getUTCDay()]++; }
  const n = h.reduce((a, b) => a + b, 0); if (!n) return { h, d, n };
  let best = 0, bs = Infinity; for (let s = 0; s < 24; s++) { let sum = 0; for (let k = 0; k < 6; k++) sum += h[(s + k) % 24]; if (sum < bs) { bs = sum; best = s; } }
  const q = bs / n, c = (best + 3) % 24; let off = Math.round(4 - c); while (off > 12) off -= 24; while (off < -11) off += 24;
  const conf = n >= 40 && q < .04 ? 'high' : n >= 25 && q < .09 ? 'mid' : null;
  const region = off <= -6 ? 'the Americas (west / central)' : off <= -3 ? 'the Americas (east) or South America' : off <= -1 ? 'the Atlantic' : off <= 3 ? 'Europe or Africa' : off <= 6 ? 'the Middle East or South Asia' : off <= 9 ? 'East or Southeast Asia' : 'Australia or the Pacific';
  return { h, d, n, q, q0: best, q1: (best + 6) % 24, off, tz: 'UTC' + (off >= 0 ? '+' : '−') + Math.abs(off), region, conf };
}
function linksOf(w, recent) {
  const m = new Map();
  for (const t of recent) { if (t.swap || t.err) continue; for (const x of t.xfers || []) { if (!x.wallet || x.a === w) continue; const real = x.dir === 'out' || (x.k === 'sol' && x.amt >= .005); if (!real) continue;
      const e = m.get(x.a) || { a: x.a, n: 0, sol: 0, out: 0, inn: 0, last: 0 }; e.n++; if (x.k === 'sol') e.sol += x.amt || 0; x.dir === 'out' ? e.out++ : e.inn++; e.last = Math.max(e.last, t.t || 0); m.set(x.a, e); } }
  return [...m.values()].sort((a, b) => b.n - a.n || b.sol - a.sol);
}
async function fullScan(w, sp) {
  const R = { w };
  sp.set('reading the account…');
  const [A, H, T] = await Promise.all([api('acct', { w }), readHistory(w, 5, sp), api('trace', { w, hops: 1 }).catch(e => ({ error: e.message }))]);
  R.acct = A; R.sigs = H.sigs; R.complete = H.complete; R.total = H.sigs.length; R.first = H.complete && H.sigs.length ? H.sigs[H.sigs.length - 1].t : null; R.last = H.sigs[0] ? H.sigs[0].t : null; R.trace = Array.isArray(T) ? T : null;
  R.recent = R.total ? await readTxs(w, H.sigs, 60, sp) : [];
  R.clock = clockOf(H.sigs.map(s => s.t));
  R.links = linksOf(w, R.recent);
  const mine = R.recent.filter(t => t.signer && !t.err);
  R.apps = [...new Set(mine.flatMap(t => t.progs || []).filter(p => !['memo', 'pump.fun fees', 'Pump fun AMM fees'].includes(p)))];
  R.creates = [...new Set(mine.map(t => t.create).filter(Boolean))];
  R.memos = mine.map(t => t.memo).filter(Boolean);
  R.round = R.recent.flatMap(t => (t.xfers || []).filter(x => x.k === 'sol' && x.wallet && x.amt >= .5 && Math.abs(x.amt * 2 - Math.round(x.amt * 2)) < 1e-6)).length;
  R.moved = R.recent.reduce((s, t) => s + Math.abs(t.sol || 0), 0);
  return R;
}
function assess(R) {
  const L = [], G = [], A = R.acct;
  const names = (A.names && A.names.names) || [];
  if (names.length) L.push({ p: 20, k: 'name', h: `answers to <b>${esc(names[0])}</b>${names.length > 1 ? ` and ${names.length - 1} more name${names.length > 2 ? 's' : ''}` : ''}. a name on a wallet is a name tag.`, f: 'keep .sol names on a wallet that holds nothing else.' });
  else if (A.names && A.names.ok) G.push('no .sol name points here');
  const F = R.trace && R.trace[0], F2 = R.trace && R.trace[1];
  if (F && !F.busy && F.funder) {
    const when = F.at ? ` on ${day(F.at)}` : '';
    if (F2 && F2.busy) L.push({ p: 15, k: 'funding', h: `first SOL came from ${addr(F.funder)}${F.amt ? ` (${nf(F.amt, 3)} SOL)` : ''}${when}. that wallet has 1,000+ transactions: an exchange, a bridge or a service. if it is an exchange, your account there has your ID.`, f: 'every new wallet starts with a first deposit. it points somewhere.' });
    else L.push({ p: 12, k: 'funding', h: `first SOL came from ${addr(F.funder)}${F.amt ? ` (${nf(F.amt, 3)} SOL)` : ''}${when}, a personal-looking wallet. anyone can tie the two together.`, f: `run ${cmd('trace ' + R.w)} to follow it further back.` });
  } else if (F && F.busy) G.push('history too deep to reach the first funding (3,000+ txs)');
  const C = R.clock; if (C && C.conf) L.push({ p: C.conf === 'high' ? 12 : 8, k: 'clock', h: `quiet from ${String(C.q0).padStart(2, '0')}:00 to ${String(C.q1).padStart(2, '0')}:00 UTC almost every day. that looks like sleep: <b>${C.tz}</b>, likely ${C.region}.`, f: 'your active hours are a timezone. a timezone narrows you down fast.' });
  if (R.links.length) L.push({ p: Math.min(15, 6 + R.links.length * 2), k: 'cluster', h: `direct transfers with ${R.links.length} wallet${R.links.length > 1 ? 's' : ''}: ${R.links.slice(0, 4).map(l => addr(l.a)).join(' ')}${R.links.length > 4 ? ' …' : ''}. wallets that pay each other read as one owner.`, f: `check one with ${cmd('link ' + R.w + ' ' + R.links[0].a, 'link')}.` });
  if (A.usd >= 1000) { const top = [A.sol > .01 ? `${nf(A.sol, 2)} SOL` : null, ...A.tokens.filter(t => t.usd > 50).slice(0, 3).map(t => `${big(t.amount)} ${esc(t.sym || short(t.mint))}`)].filter(Boolean).join(' · ');
    L.push({ p: A.usd >= 1e5 ? 12 : A.usd >= 1e4 ? 9 : 5, k: 'bags', h: `anyone can see <b>${usd(A.usd)}</b> here: ${top}.`, f: 'a visible bag makes a wallet worth watching.' }); }
  if (R.creates.length) L.push({ p: 10, k: 'dev', h: `launched ${R.creates.length} coin${R.creates.length > 1 ? 's' : ''} on pump.fun from this wallet (last 60 txs): ${R.creates.slice(0, 3).map(m => `<a href="https://pump.fun/coin/${m}" target="_blank" rel="noopener">${short(m)}</a>`).join(' ')}. dev wallets get tracked.`, f: 'one wallet per job: dev, trade, hold.' });
  if (R.apps.length >= 3) L.push({ p: 5, k: 'apps', h: `uses ${R.apps.slice(0, 6).join(' · ')}. your app mix is a fingerprint.`, f: 'nothing to fix, just know it is there.' });
  if (R.total >= 1000) L.push({ p: R.total >= 5000 ? 8 : 5, k: 'history', h: `${R.total >= 5000 ? '5,000+' : nf(R.total)} transactions${R.first ? ` since ${day(R.first)}` : ''}. more history, more to match.`, f: 'old main wallets are the easiest to profile.' });
  if (R.round >= 2) L.push({ p: 3, k: 'amounts', h: `${R.round} round-number transfers between wallets. round amounts are easy to match on both sides.`, f: '' });
  if (R.memos.length) L.push({ p: 4, k: 'memos', h: `${R.memos.length} public memo${R.memos.length > 1 ? 's' : ''} on your transactions, like “${esc(R.memos[0].slice(0, 50))}”.`, f: 'memos are public text, forever.' });
  if (!R.links.length && R.recent.length) G.push('no direct transfers with other wallets lately');
  if (C && !C.conf && C.n >= 25) G.push('no clear sleep pattern');
  if (A.usd < 1000) G.push('little value on show');
  const score = Math.max(0, 100 - L.reduce((s, l) => s + l.p, 0));
  const grade = score >= 85 ? 'ghost' : score >= 65 ? 'low profile' : score >= 45 ? 'exposed' : score >= 25 ? 'mostly doxxed' : 'fully doxxed';
  return { L, G, score, grade };
}
function renderScan(R, S) {
  const A = R.acct, col = S.score >= 65 ? 'ink' : S.score >= 45 ? 'amb' : 'red';
  hd(`opsec · ${short(R.w)}`);
  html(`<div class="score"><span class="${col}">${bar(S.score)}</span>  <b>${S.score}/100</b>  <span class="${col}">${S.grade}</span></div>`);
  html(`<div class="tbl"><span>seen</span><span>${R.total ? `${R.total >= 5000 ? '5,000+' : nf(R.total)} transactions${R.first ? ' since ' + day(R.first) : ''} · last ${ago(R.last)} ago` : 'no transactions yet'}</span><span>holds</span><span>${nf(A.sol, 3)} SOL · ${A.tokenCount} token${A.tokenCount === 1 ? '' : 's'}${A.nftish ? ` · ${A.nftish} collectible${A.nftish > 1 ? 's' : ''}` : ''} · ${usd(A.usd)} visible</span>${A.onCurve ? '' : '<span>type</span><span class="amb">off-curve address (owned by a program, not a person)</span>'}</div>`);
  html(walletMap(R));
  if (S.L.length) { ln('leaks', 'hd'); for (const l of S.L) html(`<div class="leak"><span class="sev">−${l.p}</span><span class="k">${l.k}</span><span>${l.h}</span>${l.f ? `<span class="fix">${l.f}</span>` : ''}</div>`); }
  if (S.G.length) { ln('fine', 'hd'); for (const g of S.G) html(`<div class="leak good"><span class="sev">ok</span><span class="k"></span><span class="dim">${g}</span></div>`); }
  const C = R.clock; if (C && C.n) { ln('clock · UTC', 'hd'); pre(`<span class="ink">${spark(C.h, 2)}</span>\n<span class="faint">00    04    08    12    16    20    23</span>\n${C.conf ? `<span class="dim">quiet ${String(C.q0).padStart(2, '0')}–${String(C.q1).padStart(2, '0')} UTC → ${C.tz}</span>` : '<span class="dim">no clear quiet hours</span>'}`); }
  if (R.links.length) { ln('linked wallets · direct transfers in the last 60 txs', 'hd'); for (const l of R.links.slice(0, 6)) html(`<div class="tbl"><span>${addr(l.a)}</span><span>${l.n} transfer${l.n > 1 ? 's' : ''}${l.sol ? ` · ${nf(l.sol, 3)} SOL` : ''} · ${l.out ? 'you paid' : 'paid you'}${l.out && l.inn ? ' both ways' : ''} · ${cmd(`link ${R.w} ${l.a}`, 'link?')}</span></div>`); }
  if (R.apps.length) html(`<div class="tbl"><span>apps</span><span>${R.apps.join(' · ')}</span></div>`);
  if (A.tokens.length) html(`<div class="tbl"><span>bags</span><span>${A.tokens.filter(t => t.usd).slice(0, 5).map(t => `${big(t.amount)} ${esc(t.sym || short(t.mint))} <span class="dim">${usd(t.usd)}</span>`).join(' · ') || '<span class="dim">no priced tokens</span>'}</span></div>`);
  const b = html(`<div class="btns"><button class="pri" data-act="share">share my score</button><button data-run="trace ${R.w}">trace funding</button><button data-run="clock ${R.w}">clock</button><a href="${scan(R.w)}" target="_blank" rel="noopener">solscan ↗</a></div>`);
  ln(`<span class="dim">the score is a heuristic from public data: 60 latest transactions, up to 5,000 timestamps, the first funding and the wallet's names. nothing is stored.</span>`);
  LAST = { w: R.w, score: S.score, grade: S.grade, keys: S.L.map(l => l.k) };
}
async function opsec(arg) {
  const w = await target(arg); if (!w) return;
  const sp = spin('reading the account…');
  try { const R = await fullScan(w, sp); sp.ok(`read ${nf(R.total)} transactions, ${R.recent.length} in detail`); if (R.acct.program) { ln('that address is a program, not a wallet.', 'amb'); return; } renderScan(R, assess(R)); }
  catch (e) { sp.fail(e.message); }
}
async function clockCmd(arg) { const w = await target(arg); if (!w) return; const sp = spin('reading timestamps…'); try { const H = await readHistory(w, 5, sp); sp.ok(`${nf(H.sigs.length)} timestamps`); const C = clockOf(H.sigs.map(s => s.t)); if (!C.n) return ln('no history yet.', 'dim');
    hd(`clock · ${short(w)}`); pre(`<span class="ink">${spark(C.h, 2)}</span>\n<span class="faint">00    04    08    12    16    20    23   UTC</span>`);
    pre(`<span class="ink">${spark([1, 2, 3, 4, 5, 6, 0].map(i => C.d[i]), 4)}</span>\n<span class="faint">mon tue wed thu fri sat sun</span>`);
    ln(C.conf ? `quiet ${String(C.q0).padStart(2, '0')}:00–${String(C.q1).padStart(2, '0')}:00 UTC → most likely <b>${C.tz}</b>, ${C.region}. ${C.conf === 'high' ? 'strong signal.' : 'medium signal.'}` : 'no clear sleep window. this wallet keeps odd hours, or is a bot.'); } catch (e) { sp.fail(e.message); } }
async function bags(arg) { const w = await target(arg); if (!w) return; const sp = spin('reading balances…'); try { const A = await api('acct', { w }); sp.ok(); hd(`bags · ${short(w)}`); ln(`anyone can see <b>${usd(A.usd)}</b> in this wallet.`);
    html(`<div class="tbl"><span>SOL</span><span>${nf(A.sol, 4)} <span class="dim">${usd(A.solUsd ? A.sol * A.solUsd : null)}</span></span>${A.tokens.slice(0, 14).map(t => `<span>${esc(t.sym || short(t.mint))}</span><span>${big(t.amount)} <span class="dim">${t.usd ? usd(t.usd) : 'no price'}</span></span>`).join('')}</div>`);
    if (A.tokenCount > 14) ln(`+ ${A.tokenCount - 14} more tokens`, 'dim'); if (A.emptyAccounts) ln(`${A.emptyAccounts} empty token account${A.emptyAccounts > 1 ? 's' : ''}: coins you once held, still on record.`, 'dim'); } catch (e) { sp.fail(e.message); } }
async function apps(arg) { const w = await target(arg); if (!w) return; const sp = spin('reading…'); try { const H = await readHistory(w, 1, sp); const T = await readTxs(w, H.sigs, 60, sp); sp.ok(); const c = {}; T.filter(t => t.signer).forEach(t => (t.progs || []).forEach(p => c[p] = (c[p] || 0) + 1)); const L = Object.entries(c).filter(([k]) => k !== 'memo').sort((a, b) => b[1] - a[1]);
    hd(`apps · ${short(w)}`); if (!L.length) return ln('no known apps in the last 60 transactions.', 'dim'); const m = L[0][1]; for (const [k, v] of L) pre(`${k.padEnd(18)} <span class="ink">${'█'.repeat(Math.max(1, Math.round(v / m * 24)))}</span> ${v}`); } catch (e) { sp.fail(e.message); } }
async function names(arg) { const w = await target(arg); if (!w) return; const sp = spin('looking up names…'); try { const N = await api('sns', { w }); sp.ok(); if (!N.ok) return ln('the name service did not answer. try again in a minute.', 'amb'); if (!N.names.length) return ln(`no .sol names point at ${addr(w)}. good.`, 'ink'); hd(`names · ${short(w)}`); N.names.forEach(n => ln(`<b>${esc(n)}</b>${n === N.fav ? ' <span class="dim">(primary: shows up next to this wallet in apps)</span>' : ''}`)); } catch (e) { sp.fail(e.message); } }

async function trace(arg) {
  const w = await target(arg); if (!w) return;
  const sp = spin('following the first SOL back…');
  try { const C = await api('trace', { w, hops: 4 }); sp.ok(`${C.length} hop${C.length > 1 ? 's' : ''}`); hd(`funding trail · ${short(w)}`);
    C.forEach((h, i) => { const tag = h.busy ? `<span class="amb">${nf(h.count)}+ txs · busy wallet (exchange, bridge or service)</span>` : `<span class="dim">${nf(h.count)} txs${h.first ? ' · since ' + day(h.first) : ''}</span>`;
      html(`<div class="ln"><span class="${i ? 'dim' : 'ink'}">●</span> ${addr(h.w)}  ${tag}</div>`);
      if (h.funder && C[i + 1]) html(`<div class="ln"><span class="faint">│</span>   <span class="dim">← ${h.amt != null ? nf(h.amt, 4) + ' SOL' : 'first fees paid'}${h.at ? ' on ' + day(h.at) : ''}</span> <a href="${txl(h.sig)}" target="_blank" rel="noopener">tx ↗</a></div>`);
      else if (!h.funder && !h.busy && !h.partial) ln(`<span class="faint">│</span>   <span class="dim">no incoming SOL in its first transactions</span>`); });
    const end = C[C.length - 1]; ln(end.busy ? 'the trail ends at a busy wallet. on-chain, that is as far as anyone can follow. off-chain, an exchange knows who deposited.' : 'end of the readable trail.', 'dim');
  } catch (e) { sp.fail(e.message); }
}

async function link(a1, a2) {
  if (a1 === 'me') a1 = WALLET; if (a2 === 'me') a2 = WALLET;
  if (!isAddr(a1) || !isAddr(a2)) return ln(`usage: ${cmd('link ', 'link <wallet a> <wallet b>')}. are they the same person?`, 'dim');
  if (a1 === a2) return ln('that is the same wallet twice.', 'dim');
  const sp = spin('reading both wallets…');
  try {
    const lite = async w => { const [A, H, T] = await Promise.all([api('acct', { w }), readHistory(w, 2), api('trace', { w, hops: 1 }).catch(() => null)]); const recent = H.sigs.length ? await readTxs(w, H.sigs, 40) : []; return { w, A, H, T, recent, clock: clockOf(H.sigs.map(s => s.t)), links: linksOf(w, recent) }; };
    const [X, Y] = await Promise.all([lite(a1), lite(a2)]); sp.ok('read both wallets');
    const S = []; let pts = 0;
    const direct = X.recent.concat(Y.recent).flatMap(t => (t.xfers || []).filter(x => x.a === a1 || x.a === a2)); if (direct.length) { pts += 45; S.push(`<b>they pay each other</b>: ${direct.length} direct transfer${direct.length > 1 ? 's' : ''} in recent history`); }
    const fx = X.T && X.T[0] && X.T[0].funder, fy = Y.T && Y.T[0] && Y.T[0].funder;
    if (fx && fx === a2 || fy && fy === a1) { pts += 45; S.push('<b>one funded the other</b>: the first SOL of one came from the other'); }
    else if (fx && fx === fy) { const busy = X.T[1] && X.T[1].busy; pts += busy ? 10 : 30; S.push(`<b>same first funder</b>: ${addr(fx)}${busy ? ' (a busy wallet, so weaker)' : ''}`); }
    const cx = new Set(X.links.map(l => l.a)), shared = Y.links.filter(l => cx.has(l.a)); if (shared.length) { pts += Math.min(20, shared.length * 10); S.push(`<b>shared counterparties</b>: ${shared.slice(0, 3).map(l => addr(l.a)).join(' ')}`); }
    const cos = (u, v) => { let a = 0, b = 0, c = 0; for (let i = 0; i < 24; i++) { a += u[i] * v[i]; b += u[i] * u[i]; c += v[i] * v[i]; } return b && c ? a / Math.sqrt(b * c) : 0; };
    const cs = cos(X.clock.h, Y.clock.h); if (X.clock.n >= 40 && Y.clock.n >= 40 && cs > .85) { pts += 10; S.push(`<b>same hours</b>: their daily rhythms match ${Math.round(cs * 100)}%`); }
    const mx = new Set(X.A.tokens.filter(t => !t.verified).map(t => t.mint)), common = Y.A.tokens.filter(t => !t.verified && mx.has(t.mint)); if (common.length) { pts += Math.min(15, common.length * 5); S.push(`<b>same niche bags</b>: both hold ${common.slice(0, 3).map(t => esc(t.sym || short(t.mint))).join(', ')}`); }
    pts = Math.min(100, pts); const v = pts >= 70 ? ['linked', 'red'] : pts >= 40 ? ['probably linked', 'amb'] : pts >= 15 ? ['weak signals', 'amb'] : ['no link found', 'ink'];
    hd(`link · ${short(a1)} ↔ ${short(a2)}`);
    html(`<div class="score"><span class="${v[1]}">${bar(pts)}</span>  <b>${pts}/100</b>  <span class="${v[1]}">${v[0]}</span></div>`);
    if (S.length) S.forEach(s => ln('· ' + s)); else ln('no direct transfers, no shared funder, no shared counterparties, no matching hours in what is readable.', 'dim');
    pre(`<span class="dim">a</span> <span class="ink">${spark(X.clock.h)}</span>\n<span class="dim">b</span> <span class="ink">${spark(Y.clock.h)}</span>  <span class="faint">hours, UTC</span>`);
  } catch (e) { sp.fail(e.message); }
}

// ------------------------------------------------------------ whoami: what this browser gives away. nothing leaves the page.
function fingerprint() {
  const n = navigator, tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '—', off = -new Date().getTimezoneOffset() / 60;
  let gpu = 'hidden'; try { const g = document.createElement('canvas').getContext('webgl'); const e = g && g.getExtension('WEBGL_debug_renderer_info'); if (e) gpu = g.getParameter(e.UNMASKED_RENDERER_WEBGL); } catch { }
  let hash = '—'; try { const c = document.createElement('canvas'); c.width = 240; c.height = 60; const x = c.getContext('2d'); x.textBaseline = 'top'; x.font = '16px Arial'; x.fillStyle = '#f60'; x.fillRect(100, 1, 62, 20); x.fillStyle = '#069'; x.fillText('pr1v ≠ public 😶', 2, 15); x.fillStyle = 'rgba(102,204,0,.7)'; x.fillText('pr1v ≠ public 😶', 4, 17); const d = c.toDataURL(); let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d.charCodeAt(i); h = Math.imul(h, 16777619); } hash = (h >>> 0).toString(16).padStart(8, '0'); } catch { }
  const ua = n.userAgentData ? n.userAgentData.brands.filter(b => !/not/i.test(b.brand)).map(b => b.brand + ' ' + b.version).join(', ') : n.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 80);
  return [
    ['timezone', `${tz} (UTC${off >= 0 ? '+' : ''}${off})`, 3.0], ['languages', (n.languages || [n.language]).join(', '), 3.5], ['screen', `${screen.width}×${screen.height} at ${devicePixelRatio}x`, 4.8],
    ['platform', (n.userAgentData && n.userAgentData.platform) || n.platform || '—', 2.0], ['browser', ua || '—', 6.0], ['cpu cores', n.hardwareConcurrency || 'hidden', 1.6], ['memory', n.deviceMemory ? n.deviceMemory + ' GB+' : 'hidden', 1.2],
    ['gpu', gpu, 5.5], ['canvas hash', hash, 7.5], ['touch points', n.maxTouchPoints ?? 0, .8], ['theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light', .5], ['do not track', n.doNotTrack == null ? 'unset' : n.doNotTrack, .6],
  ];
}
function whoami() {
  const F = fingerprint(), bits = F.reduce((s, f) => s + f[2], 0);
  hd('whoami · this browser');
  html(`<div class="tbl">${F.map(([k, v, b]) => `<span>${k}</span><span>${esc(v)} <span class="faint">~${b} bits</span></span>`).join('')}</div>`);
  ln(`together that is roughly <b>${Math.round(bits)} bits</b> of identifying information. 33 bits is enough to tell apart everyone on earth.`);
  ln('every site you open can read all of this without asking, and so can every app you connect your wallet to. your wallet\'s RPC also sees your IP address on every request.', 'dim');
  ln('the bit counts are rough averages from public fingerprinting research. nothing on this page was sent anywhere.', 'dim');
}

// ------------------------------------------------------------ drop: sealed notes. content encrypted to the recipient's key; who, to whom and when stay public.
const KEYMSG = 'pr1v inbox key v1\n\nsign to unlock your pr1v inbox on this device.\nthis is not a transaction and costs nothing.';
async function inboxKeys() {
  if (KEYS && KEYS.w === WALLET) return KEYS;
  const p = prov(); if (!p || !p.signMessage) throw new Error('this wallet cannot sign messages');
  const r = await p.signMessage(new TextEncoder().encode(KEYMSG), 'utf8'); const sig = r && r.signature ? r.signature : r;
  const seed = nacl.hash(new Uint8Array(sig)).slice(0, 32); const kp = nacl.box.keyPair.fromSecretKey(seed);
  KEYS = { w: WALLET, pub: u8b64(kp.publicKey), sec: kp.secretKey }; return KEYS;
}
async function idx(force) { if (!IDX || force || Date.now() - IDX.at > 15000) IDX = await api('idx'); return IDX; }
async function drop(args) {
  const sub = (args[0] || '').toLowerCase();
  if (!sub || sub === 'help' || sub === 'status') {
    hd('drop · sealed notes between wallets');
    ln('write a note to any wallet. it is encrypted in your browser to that wallet\'s inbox key and written on-chain. only that wallet can open it.');
    html(`<div class="tbl"><span>${cmd('drop key')}</span><span>open your inbox: sign once, then publish your inbox key (one tiny transaction)</span><span>${cmd('drop send ', 'drop send <wallet> <note>')}</span><span>seal a note to a wallet (max 280 characters)</span><span>${cmd('drop inbox')}</span><span>open the notes sent to you</span><span>${cmd('drop sent')}</span><span>notes you sent (sealed, so only the time and recipient show)</span></div>`);
    ln('public: that a note went from one wallet to another, and when. private: what it says.', 'dim');
    try { const I = await idx(); ln(`on-chain right now: ${Object.keys(I.keys).length} inbox${Object.keys(I.keys).length === 1 ? '' : 'es'} · ${I.msgs.length} sealed note${I.msgs.length === 1 ? '' : 's'}.`, 'dim'); } catch { }
    return;
  }
  if (!window.nacl) return ln('the encryption library did not load. reload the page.', 'red');
  if (!(await needWallet())) return;
  if (sub === 'key') {
    const sp = spin('sign the message in your wallet to derive your inbox key…');
    try { const K = await inboxKeys(); const I = await idx(true); const cur = I.keys[WALLET];
      if (cur && cur.pub === K.pub) return sp.ok(`your inbox is already open. key ${K.pub.slice(0, 10)}…`);
      sp.set('publishing your inbox key. sign in your wallet…'); const b = await api('bkey', {}, { from: WALLET, pub: K.pub }); const sig = await signSend(b.tx); await confirmTx(sig, sp); IDX = null;
      sp.ok(`inbox open. anyone can now seal a note to ${short(WALLET)}. <a href="${txl(sig)}" target="_blank" rel="noopener">tx ↗</a>`); dropW();
    } catch (e) { sp.fail(/reject|cancel|denied/i.test(e.message) ? 'you cancelled in your wallet' : e.message); }
    return;
  }
  if (sub === 'send') {
    const to = args[1] === 'me' ? WALLET : args[1], note = args.slice(2).join(' ').trim();
    if (!isAddr(to) || !note) return ln(`usage: ${cmd('drop send ', 'drop send <wallet> <note>')}`, 'dim');
    const bytes = new TextEncoder().encode(note); if (bytes.length > 300) return ln(`that note is ${bytes.length} bytes. keep it under 300 (about 280 characters).`, 'red');
    const sp = spin('looking up their inbox key…');
    try { const I = await idx(true); const k = I.keys[to]; if (!k) return sp.fail(`${short(to)} has no pr1v inbox yet. they open one with drop key.`);
      const eph = nacl.box.keyPair(), nonce = nacl.randomBytes(24), box = nacl.box(bytes, nonce, b64u8(k.pub), eph.secretKey);
      sp.set('sealed in your browser. sign the transaction in your wallet…');
      const b = await api('bmsg', {}, { from: WALLET, to, eph: u8b64(eph.publicKey), nonce: u8b64(nonce), box: u8b64(box) }); const sig = await signSend(b.tx); await confirmTx(sig, sp); IDX = null;
      sp.ok(`sealed note delivered to ${addr(to)}. only they can open it. <a href="${txl(sig)}" target="_blank" rel="noopener">tx ↗</a>`); dropW();
    } catch (e) { sp.fail(/reject|cancel|denied/i.test(e.message) ? 'you cancelled in your wallet' : e.message); }
    return;
  }
  if (sub === 'inbox') {
    const sp = spin('sign the message in your wallet to unlock your inbox…');
    try { const K = await inboxKeys(); sp.set('reading the chain…'); const I = await idx(true); const mine = I.msgs.filter(m => m.to === WALLET); sp.ok(`${mine.length} note${mine.length === 1 ? '' : 's'} for ${short(WALLET)}`);
      if (!I.keys[WALLET]) ln(`your inbox key is not published yet, so nobody can write to you. run ${cmd('drop key')}.`, 'amb');
      hd('inbox'); if (!mine.length) return ln('empty. share your address and tell people to drop you a note.', 'dim');
      for (const m of mine) { let txt = null; try { const o = nacl.box.open(b64u8(m.box), b64u8(m.nonce), b64u8(m.eph), K.sec); if (o) txt = new TextDecoder().decode(o); } catch { }
        html(`<div class="card"><div class="dim">from ${addr(m.from)} · ${ago(m.t)} ago · <a href="${txl(m.sig)}" target="_blank" rel="noopener">tx ↗</a> · ${cmd('drop send ' + m.from + ' ', 'reply')}</div><div class="note">${txt != null ? esc(txt) : '<span class="amb">sealed to an older key of yours, cannot open</span>'}</div></div>`); }
    } catch (e) { sp.fail(/reject|cancel|denied/i.test(e.message) ? 'you cancelled in your wallet' : e.message); }
    return;
  }
  if (sub === 'sent') { const sp = spin('reading the chain…'); try { const I = await idx(true); const mine = I.msgs.filter(m => m.from === WALLET); sp.ok(`${mine.length} sent`); mine.forEach(m => ln(`→ ${addr(m.to)} · ${ago(m.t)} ago · <span class="blk">${'x'.repeat(14)}</span> <a href="${txl(m.sig)}" target="_blank" rel="noopener">tx ↗</a>`)); if (!mine.length) ln('nothing sent yet.', 'dim'); } catch (e) { sp.fail(e.message); } return; }
  ln(`unknown: drop ${esc(sub)}. try ${cmd('drop')}`, 'dim');
}

// ------------------------------------------------------------ coin
let COIN = null; async function coinData() { if (!COIN) COIN = await api('coin').catch(() => ({ ca: null })); return COIN; }
async function coin(sub) {
  const C = await coinData();
  if (!C.ca) { ln('$PR1V is not live yet. the contract address will show up here, in the side panel and on X the moment it launches.', 'dim'); if (C.x) ln(`follow <a href="${esc(C.x)}" target="_blank" rel="noopener">${esc(C.x.replace(/^https?:\/\/(x|twitter)\.com\//, '@'))}</a>`); return; }
  if (sub === 'ca') { copy(C.ca, 'contract address copied'); return ln(`ca: <b>${C.ca}</b> <span class="dim">(copied)</span>`); }
  if (sub === 'buy') { open('https://pump.fun/coin/' + C.ca, '_blank', 'noopener'); return ln('opening pump.fun…', 'dim'); }
  if (sub === 'chart') { open('https://dexscreener.com/solana/' + C.ca, '_blank', 'noopener'); return ln('opening the chart…', 'dim'); }
  if (sub === 'x') { if (C.x) open(C.x, '_blank', 'noopener'); return; }
  hd('$PR1V'); html(`<div class="tbl"><span>ca</span><span><a class="cmd" data-run="ca">${C.ca}</a></span><span>price</span><span>${C.usd != null ? '$' + (C.usd < .01 ? C.usd.toPrecision(3) : nf(C.usd, 4)) : '—'}</span><span>mcap</span><span>${usd(C.mcap)}</span><span>holders</span><span>${nf(C.holders)}</span></div>`);
  html(`<div class="btns"><button class="pri" data-run="buy">buy</button><button data-run="chart">chart</button>${C.x ? '<button data-run="x">𝕏</button>' : ''}<button data-run="ca">copy ca</button></div>`);
}

// ------------------------------------------------------------ static
const LEAKS = [
  ['names', '.sol names and other on-chain names on your main wallet', 'keep names on a wallet that holds nothing else'],
  ['funding', 'withdrawing from an exchange straight into a wallet you want private', 'an exchange knows who withdrew. assume it is on record'],
  ['clusters', 'sending SOL or tokens directly between your own wallets', 'wallets that pay each other read as one owner'],
  ['clock', 'trading at the same hours every day', 'your rhythm is a timezone'],
  ['screenshots', 'PnL cards and screenshots with an address, a balance or a unique trade size in them', 'crop them, round them, wait before you post'],
  ['dev wallets', 'launching, trading and holding from the same wallet', 'one wallet per job'],
  ['amounts', 'moving the exact same or round amounts between wallets', 'amounts can be matched on both sides'],
  ['connections', 'connecting and signing in with your main wallet everywhere', 'every app you sign into links that wallet to your account there'],
  ['browser', 'your browser fingerprint and IP address (see whoami)', 'every site and RPC sees them'],
  ['memos', 'public memos and on-chain messages', 'memos are plain public text, forever'],
];
const HELP = [
  ['trenches', 'live pump.fun launches, with what is public about each dev'], ['dev <coin|wallet>', 'who launched it: funding, other coins, linked wallets'], ['token <mint>', 'a coin at a glance'],
  ['opsec <wallet|me>', 'how doxxed is a wallet: score, leaks, fixes'], ['trace <wallet|me>', 'follow the first SOL back, hop by hop'], ['link <a> <b>', 'are two wallets the same person?'],
  ['clock <wallet|me>', 'when a wallet is awake, and its likely timezone'], ['bags <wallet|me>', 'what anyone can see it holds'], ['apps <wallet|me>', 'which apps it uses'], ['name <wallet|me>', '.sol names pointing at it'],
  ['whoami', 'what this browser gives away'], ['drop', 'sealed notes between wallets: key · send · inbox · sent'], ['leaks', 'the 10 ways wallets get doxxed'], ['share', 'share your last score (without your address)'],
  ['connect · disconnect', 'your wallet (only for drop and “me”)'], ['coin · ca · buy · chart · x', '$PR1V'], ['about · faq · roadmap', 'what pr1v is'], ['ls · cat · history · clear · theme · intro', 'the usual'],
];
function help() { hd('commands'); html(`<div class="tbl">${HELP.map(([c, d]) => `<span>${cmd(c.split(' ')[0] + (c.includes('<') ? ' ' : ''), c)}</span><span>${d}</span>`).join('')}</div>`); ln('click anything underlined · ↑ ↓ history · tab completes · ctrl+c cancels', 'dim'); }
function leaks() { hd('the 10 ways wallets get doxxed'); LEAKS.forEach(([k, a, b], i) => html(`<div class="leak"><span class="sev">${String(i + 1).padStart(2, '0')}</span><span class="k">${k}</span><span>${a}</span><span class="fix">${b}</span></div>`)); ln(`see which ones your wallet has: ${cmd('opsec me')}`, 'dim'); }
function about() { hd('about pr1v'); ln('every wallet on Solana is public. most people have no idea how much theirs gives away.'); ln('pr1v shows you, then gives you tools that leak less. <b>public chain. pr1v you.</b>');
  ln('live now', 'hd'); html(`<div class="tbl"><span>opsec · trace · link</span><span>read-only, from public chain data</span><span>clock · bags · apps · name</span><span>read-only, from public chain data</span><span>whoami</span><span>runs in your browser, sends nothing</span><span>drop</span><span>notes sealed to a wallet's key and written on-chain. only that wallet can open them</span></div>`);
  ln('pr1v never holds keys, never holds coins, keeps no database of what you scan and never moves funds for anyone.', 'dim'); }
function faq() { hd('faq'); [['is it safe to scan a wallet?', 'yes. a scan only reads public chain data. nothing is signed and nothing is sent from your wallet.'], ['do you store the wallets I scan?', 'no. there is no database. answers are cached for a few minutes so repeat scans are fast, then dropped.'], ['how does drop work?', 'your wallet signs a fixed message once; your browser turns that signature into an encryption key. notes to you are sealed to it with NaCl box and written in a memo on Solana. only your signature can rebuild the key.'], ['who can see a drop?', 'anyone can see that a note went from one wallet to another, and when. nobody but the recipient can read it.'], ['is the score exact?', 'it is a heuristic: name tags, funding, active hours, direct transfers, visible value, dev activity and history. every leak shows its evidence.'], ['is pr1v affiliated with anyone?', 'no. pr1v is independent. not affiliated with Solana, any wallet, exchange, government or office.'], ['is $PR1V an investment?', 'no. it is a memecoin. memecoins can go to zero. nothing here is financial advice.']].forEach(([q, a]) => { ln(`<b>${q}</b>`); ln(a, 'dim'); }); }
function roadmap() { hd('roadmap'); html(`<div class="tbl"><span class="ink">live</span><span>opsec · trace · link · clock · bags · apps · name · whoami · drop</span><span>next</span><span>confess: a board where only holders can post, and nobody knows which holder</span><span>next</span><span>redact: confidential balances with Token-2022, so bags stop being public</span><span>next</span><span>watch: an alert when one of your wallets leaks something new</span></div>`); }
const FILES = { 'readme.txt': about, 'leaks.txt': leaks, 'faq.txt': faq, 'roadmap.txt': roadmap, 'help.txt': help };

// ------------------------------------------------------------ share card
function share() {
  if (!LAST) return ln(`scan a wallet first: ${cmd('opsec me')}`, 'dim');
  const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const x = c.getContext('2d'); const dark = document.documentElement.dataset.theme === 'dark';
  const P = dark ? { bg: '#0b0b0d', win: '#111114', bar: '#18181c', line: '#26262c', tx: '#e4e4e9', dim: '#7c7c86', ink: '#b6f23c' } : { bg: '#e7e7ea', win: '#f5f5f7', bar: '#e1e1e5', line: '#d3d3d8', tx: '#26262b', dim: '#85858f', ink: '#4f8d14' };
  const red = LAST.score >= 65 ? P.ink : LAST.score >= 45 ? '#d4912a' : '#d24a3f';
  x.fillStyle = P.bg; x.fillRect(0, 0, 1200, 630); x.fillStyle = P.win; x.strokeStyle = P.line; x.lineWidth = 2; x.beginPath(); x.roundRect(60, 60, 1080, 510, 16); x.fill(); x.stroke();
  x.fillStyle = P.bar; x.beginPath(); x.roundRect(61, 61, 1078, 50, [15, 15, 0, 0]); x.fill(); x.font = '500 20px JB'; x.fillStyle = P.dim; x.fillText('pr1v — opsec — 160×24', 100, 93);
  x.font = '600 30px JB'; x.fillStyle = P.dim; x.fillText('anon@laptop ~ %', 100, 180); x.fillStyle = P.tx; x.fillText(' opsec me', 100 + x.measureText('anon@laptop ~ %').width, 180);
  x.font = '800 150px JB'; x.fillStyle = P.tx; x.fillText(String(LAST.score), 100, 350); const sw = x.measureText(String(LAST.score)).width; x.font = '600 56px JB'; x.fillStyle = P.dim; x.fillText('/100', 110 + sw, 350);
  x.font = '700 40px JB'; x.fillStyle = red; x.fillText(LAST.grade, 100, 415);
  for (let i = 0; i < 20; i++) { x.fillStyle = i < Math.round(LAST.score / 5) ? red : P.line; x.fillRect(100 + i * 26, 440, 20, 26); }
  x.font = '500 24px JB'; x.fillStyle = P.dim; x.fillText(LAST.keys.length ? 'leaks: ' + LAST.keys.slice(0, 5).join(' · ') : 'no leaks found', 100, 515);
  x.textAlign = 'right'; x.font = '600 26px JB'; x.fillStyle = P.tx; x.fillText('public chain. pr1v you.', 1100, 515); x.font = '500 20px JB'; x.fillStyle = P.dim; x.fillText(location.host, 1100, 548);
  const url = c.toDataURL('image/png');
  hd('share'); const im = html(`<img src="${url}" alt="your opsec card" style="width:min(100%,560px);border:1px solid var(--line);border-radius:8px;display:block;margin:6px 0">`).querySelector('img'); im.onload = () => scrollDown(true);
  const text = `my wallet's opsec: ${LAST.score}/100 (${LAST.grade})${LAST.keys.length ? '\nleaks: ' + LAST.keys.slice(0, 4).join(', ') : ''}\n\nhow doxxed is yours? ${location.origin}`;
  html(`<div class="btns"><a class="pri" href="https://x.com/intent/tweet?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">post on 𝕏</a><a href="${url}" download="pr1v-opsec.png">save the card</a></div>`);
  ln('the card and the post leave your address out on purpose.', 'dim'); setTimeout(() => scrollDown(true), 60);
}

// ------------------------------------------------------------ trenches: live pump.fun launches, and what is public about each dev
const TR = { tab: 'new', coins: [], seen: new Map(), shown: new Set(), open: null, paused: false, last: 0, started: Date.now(), err: null };
const img = (c, cls = 'cimg') => c.icon ? `<img class="${cls}" src="${esc(c.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<span class=&quot;${cls}&quot;>${esc((c.sym || '?')[0])}</span>'">` : `<span class="${cls}">${esc((c.sym || '?')[0])}</span>`;
const age = iso => { if (!iso) return '—'; const s = (Date.now() - Date.parse(iso)) / 1000; return s < 60 ? Math.max(1, Math.round(s)) + 's' : s < 3600 ? Math.round(s / 60) + 'm' : s < 86400 ? Math.round(s / 3600) + 'h' : Math.round(s / 86400) + 'd'; };
const pc = v => v == null ? '' : `<span class="${v >= 0 ? 'ink' : 'red'}">${v >= 0 ? '+' : ''}${nf(v, Math.abs(v) < 10 ? 1 : 0)}%</span>`;
function devBadges(c) { const a = c.audit || {}, B = []; const rep = c.dev ? [...TR.seen.values()].filter(x => x.dev === c.dev).length : 0; if (rep > 1) B.push(['r', `${rep} launches this session`]);
  if (a.devMints != null) { if (a.devMints > 100) B.push(['r', `factory · ${nf(a.devMints)} coins`]); else if (a.devMints > 20) B.push(['r', `serial · ${nf(a.devMints)} coins`]); else if (a.devMints <= 1) B.push(['g', 'first coin']); else B.push(['', `${a.devMints} coins`]); }
  if (a.devGrad) B.push(['g', `${a.devGrad} graduated`]);
  if (a.devPct != null && a.devPct >= .5) B.push([a.devPct >= 5 ? 'r' : 'a', `dev holds ${nf(a.devPct, 1)}%`]);
  if (a.topPct != null) B.push([a.topPct >= 40 ? 'r' : '', `top holders ${nf(a.topPct, 0)}%`]);
  return B; }
const serial = c => c.audit && c.audit.devMints > 20;
async function trPoll(force) {
  if (TR.paused && !force) return; if (document.hidden && !force) return;
  try { const r = await api('trenches', { tab: TR.tab }); TR.err = null; TR.last = Date.now();
    let fresh = 0; for (const c of r.coins) if (!TR.seen.has(c.mint)) { TR.seen.set(c.mint, { ...c, at: Date.now() }); fresh++; } if (fresh && TR.ping && TR.last0) ping(); TR.last0 = true;
    if (r.tab === TR.tab) TR.coins = TR.tab === 'new' ? [...TR.seen.values()].sort((a, b) => Date.parse(b.created || 0) - Date.parse(a.created || 0)).slice(0, 80) : r.coins;
    if (TR.tab !== 'new') { const n = await api('trenches', { tab: 'new' }).catch(() => null); if (n) for (const c of n.coins) if (!TR.seen.has(c.mint)) TR.seen.set(c.mint, { ...c, at: Date.now() }); }
  } catch (e) { TR.err = e.message; }
  trRender(); pulseW(); tapeW();
}
function trStats() { const L = [...TR.seen.values()], mins = Math.max(1, (Date.now() - TR.started) / 60000), A = L.filter(c => c.audit && c.audit.devMints != null);
  const ser = A.filter(serial).length, first = A.filter(c => c.audit.devMints <= 1).length, dh = L.map(c => c.audit && c.audit.devPct).filter(v => v != null).sort((a, b) => a - b);
  return { n: L.length, rate: L.length / mins, ser: A.length ? ser / A.length : null, first: A.length ? first / A.length : null, med: dh.length ? dh[Math.floor(dh.length / 2)] : null }; }
function trRender() {
  const list = $('#trList'); if (!list) return; const q = ($('#trQ').value || '').trim().toLowerCase(), hide = $('#trSerial').checked;
  const S = trStats(); $('#trN').textContent = S.n ? ' ' + S.n : '';
  $('#trStat').innerHTML = TR.err ? `<span class="red">${esc(TR.err)}</span>` : `<span><b class="ink">●</b> live from pump.fun · updated ${TR.last ? Math.max(0, Math.round((Date.now() - TR.last) / 1000)) + 's ago' : '…'}</span><span>seen <b>${S.n}</b> launches · <b>${nf(S.rate, 1)}</b>/min</span>${S.ser != null ? `<span>serial devs <b class="red">${Math.round(S.ser * 100)}%</b></span><span>first-time devs <b class="ink">${Math.round(S.first * 100)}%</b></span>` : ''}${S.med != null ? `<span>median dev bag <b>${nf(S.med, 1)}%</b></span>` : ''}`;
  let C = TR.coins.filter(c => !q || [c.sym, c.name, c.mint, c.dev].some(v => v && String(v).toLowerCase().includes(q))); if (hide) C = C.filter(c => !serial(c));
  if (TR.sort) C = C.slice().sort((a, b) => (sortVal(a, TR.sort) - sortVal(b, TR.sort)) * (TR.asc ? 1 : -1));
  if (!C.length) { list.innerHTML = `<p class="dim pad">${TR.coins.length ? 'nothing matches that filter.' : TR.err ? 'pump.fun data is not answering right now. retrying…' : 'waiting for the first launches…'}</p>`; return; }
  const keep = list.scrollTop;
  list.innerHTML = C.map(c => { const f5 = c.s5 || {}, tot = (f5.bv || 0) + (f5.sv || 0), bp = tot ? f5.bv / tot * 100 : 50, fresh = !TR.shown.has(c.mint) && TR.shown.size ? ' fresh' : '';
    const row = `<div class="crow${fresh}" data-m="${c.mint}">${img(c)}<div class="cn"><b>${esc(c.name || c.sym || short(c.mint))}</b><span>$${esc(c.sym || '?')} · ${age(c.created)}${c.s5 && c.s5.pc != null ? ' · ' + pc(c.s5.pc) : ''}</span></div>
      <span class="num">${usd(c.mcap)}</span><span class="num">${nf(c.holders)}</span>
      <div class="flow"><div class="fb"><i style="width:${bp.toFixed(0)}%"></i></div><span>${tot ? usd(tot) + ' · ' + (f5.b || 0) + '/' + (f5.s || 0) : 'no trades yet'}</span></div>
      <div class="badges">${devBadges(c).map(([k, t]) => `<span class="bd ${k}">${t}</span>`).join('') || '<span class="dim">—</span>'}</div>
      <div class="cact"><button data-run="dev ${c.mint}" title="who is the dev?">⌕</button><a href="https://pump.fun/coin/${c.mint}" target="_blank" rel="noopener" title="open on pump.fun">↗</a></div></div>`;
    return row + (TR.open === c.mint ? trDetail(c) : ''); }).join('');
  C.forEach(c => TR.shown.add(c.mint)); list.scrollTop = keep;
}
function trDetail(c) { const a = c.audit || {}, s5 = c.s5 || {}, h = c.s1h || {};
  return `<div class="cdet"><div class="kv"><span>ca</span><span><a class="cmd" data-copy="${c.mint}">${short(c.mint)} ⧉</a></span><span>dev</span><span>${c.dev ? `<a class="cmd" data-run="dev ${c.dev}">${short(c.dev)}</a>` : '—'}</span>
    <span>price</span><span>${c.usd != null ? '$' + (+c.usd).toPrecision(3) : '—'}</span><span>liquidity</span><span>${usd(c.liq)}</span>
    <span>5m</span><span>${(s5.b || 0)} buys · ${(s5.s || 0)} sells · ${s5.tr || 0} traders ${pc(s5.pc)}</span><span>1h</span><span>${usd(h.v)} volume · ${h.tr || 0} traders ${pc(h.pc)}</span>
    <span>dev coins</span><span>${a.devMints != null ? nf(a.devMints) + ' launched · ' + nf(a.devGrad || 0) + ' graduated' : '—'}</span><span>organic</span><span>${c.organicL ? esc(c.organicL) + (c.organic != null ? ' · ' + nf(c.organic, 0) : '') : '—'}</span></div>
    <div class="btns"><button class="pri" data-run="dev ${c.mint}">who is the dev</button><button data-run="holders ${c.mint}">top holders</button>${c.dev ? `<button data-run="trace ${c.dev}">trace dev funding</button><button data-run="opsec ${c.dev}">dev opsec</button>` : ''}<a href="https://pump.fun/coin/${c.mint}" target="_blank" rel="noopener">pump.fun ↗</a><a href="https://dexscreener.com/solana/${c.mint}" target="_blank" rel="noopener">chart ↗</a></div></div>`; }
function pulseW() { const el = $('#pulse'); if (!el) return; const S = trStats(), L = [...TR.seen.values()].sort((a, b) => Date.parse(b.created || 0) - Date.parse(a.created || 0)).slice(0, 4);
  el.innerHTML = `<div class="pulse"><div class="kv"><span>launches seen</span><span><b>${S.n}</b> · ${nf(S.rate, 1)}/min</span><span>serial devs</span><span>${S.ser != null ? Math.round(S.ser * 100) + '%' : '—'}</span></div>
    <div class="pfeed">${L.map(c => `<button data-run="dev ${c.mint}">${img(c)}<b>$${esc(c.sym || '?')} <span>${esc((c.name || '').slice(0, 18))}</span></b><span>${age(c.created)}</span></button>`).join('') || '<span class="dim">waiting for launches…</span>'}</div>
    <a class="wlink" data-run="trenches">open the trenches</a></div>`; }
function showTab(t) { const term = t !== 'trench'; $('#paneTerm').hidden = !term; $('#paneTrench').hidden = term; $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === (term ? 'term' : 'trench'))); if (!term) { trRender(); trPoll(true); } else if (matchMedia('(pointer: fine)').matches) IN.focus({ preventScroll: true }); }
$$('.tab').forEach(b => b.onclick = () => showTab(b.dataset.tab));
$('#trTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('#trTabs button').forEach(x => x.classList.toggle('on', x === b)); TR.tab = b.dataset.t; TR.coins = TR.tab === 'new' ? [...TR.seen.values()].sort((a, c) => Date.parse(c.created || 0) - Date.parse(a.created || 0)).slice(0, 80) : []; TR.open = null; trRender(); trPoll(true); });
$('#trQ').addEventListener('input', trRender); $('#trSerial').addEventListener('change', trRender);
$('#trPause').onclick = () => { TR.paused = !TR.paused; $('#trPause').textContent = TR.paused ? 'resume' : 'pause'; $('#trPause').setAttribute('aria-pressed', TR.paused); if (!TR.paused) trPoll(true); };
$('#trList').addEventListener('click', e => { if (e.target.closest('a,button,[data-copy],[data-run]')) return; const r = e.target.closest('.crow'); if (!r) return; TR.open = TR.open === r.dataset.m ? null : r.dataset.m; trRender(); });
document.addEventListener('click', e => { const c = e.target.closest('[data-copy]'); if (c) { e.preventDefault(); copy(c.dataset.copy, 'contract address copied'); } });
setInterval(() => { if (!booted) return; const active = !$('#paneTrench').hidden; if (active || Date.now() - TR.last > 14000) trPoll(); }, 5000);
setInterval(() => { if (!$('#paneTrench').hidden && !TR.paused) { const s = $('#trStat span'); if (s && TR.last) s.innerHTML = `<b class="ink">●</b> live from pump.fun · updated ${Math.round((Date.now() - TR.last) / 1000)}s ago`; } }, 1000);

async function tokenCard(m) { const sp = spin('reading the coin…'); try { const c = await api('token', { m }); sp.ok(`$${esc(c.sym || '?')} · ${esc(c.name || '')}`); return c; } catch (e) { sp.fail(e.message); return null; } }
async function devCmd(arg) {
  if (!arg) return ln(`usage: ${cmd('dev ', 'dev <coin or wallet>')}. who launched it, how they were funded, what else they launched.`, 'dim');
  if (arg === 'me') arg = WALLET; if (!isAddr(arg)) return ln(`<span class="red">“${esc(String(arg).slice(0, 60))}” is not a Solana address.</span>`);
  let coin = null, w = arg;
  if (/pump$/.test(arg)) { coin = await tokenCard(arg); if (!coin) return; } else coin = await api('token', { m: arg }).catch(() => null);
  if (coin) { if (!coin.dev) return ln('Jupiter does not list a dev for that coin.', 'dim'); w = coin.dev; }
  const sp = spin(`reading the dev ${short(w)}…`);
  try { const D = await api('dev', { w }); sp.ok(`read ${D.busy ? '1,000+' : nf(D.count)} transactions`);
    hd(`dev · ${short(w)}${coin ? ` · $${esc(coin.sym || '?')}` : ''}`);
    const a = coin && coin.audit || {}, V = [];
    if (a.devMints != null) V.push(a.devMints > 100 ? `<span class="red">token factory: ${nf(a.devMints)} coins launched</span>` : a.devMints > 20 ? `<span class="red">serial launcher: ${nf(a.devMints)} coins</span>` : a.devMints <= 1 ? '<span class="ink">first coin from this wallet</span>' : `${a.devMints} coins launched`);
    if (a.devGrad) V.push(`<span class="ink">${a.devGrad} graduated</span>`);
    if (!D.busy && D.count < 25 && D.first && Date.now() / 1000 - D.first < 3 * 86400) V.push('<span class="amb">fresh wallet: under 25 transactions, made in the last 3 days</span>');
    if (D.funder) V.push(D.funder.busy ? '<span class="amb">funded from a busy wallet (exchange, bridge or service)</span>' : `<span class="red">funded by a personal wallet: ${addr(D.funder.w)}</span>`);
    if (a.devPct != null && a.devPct >= .5) V.push(`<span class="${a.devPct >= 5 ? 'red' : 'amb'}">dev still holds ${nf(a.devPct, 1)}%</span>`);
    if (a.topPct != null) V.push(`top holders own ${nf(a.topPct, 0)}%`);
    if (V.length) html(`<div class="leak"><span class="sev">●</span><span class="k">verdict</span><span>${V.join(' · ')}</span></div>`);
    html(`<div class="tbl"><span>wallet</span><span>${addr(w)} · ${D.busy ? '1,000+' : nf(D.count)} txs${D.first ? ' · since ' + day(D.first) : ''}${D.last ? ' · last ' + ago(D.last) + ' ago' : ''}</span>
      <span>funding</span><span>${D.funder ? `${D.funder.amt != null ? nf(D.funder.amt, 3) + ' SOL ' : ''}from ${addr(D.funder.w)}${D.funder.at ? ' on ' + day(D.funder.at) : ''} · ${D.funder.busy ? '<span class="amb">busy wallet, 1,000+ txs</span>' : nf(D.funder.count) + ' txs'} <a href="${txl(D.funder.sig)}" target="_blank" rel="noopener">tx ↗</a>` : D.busy ? '<span class="dim">too much history to reach the first funding</span>' : '<span class="dim">no incoming SOL in its first transactions</span>'}</span>
      <span>launched</span><span>${D.creates.length ? D.creates.map(c => `<a href="https://pump.fun/coin/${c.mint}" target="_blank" rel="noopener">$${esc(c.sym || short(c.mint))}</a>${c.mcap ? ' <span class="dim">' + usd(c.mcap) + '</span>' : ''}`).join(' · ') + ' <span class="dim">(last 40 txs)</span>' : '<span class="dim">no pump.fun creates in the last 40 txs</span>'}</span>
      <span>paid</span><span>${D.sends.length ? D.sends.map(x => `${addr(x.a)} <span class="dim">×${x.n}</span>`).join(' · ') + ' <span class="dim">direct transfers: likely its own wallets</span>' : '<span class="dim">no direct transfers out lately</span>'}</span>
      <span>apps</span><span>${D.apps.length ? D.apps.join(' · ') : '—'}</span></div>`);
    html(`<div class="btns"><button class="pri" data-run="trace ${w}">trace funding</button><button data-run="opsec ${w}">full opsec</button>${coin ? `<button data-run="holders ${coin.mint}">top holders</button>` : ''}<button data-run="watch ${w} dev">watch dev</button>${D.sends[0] ? `<button data-run="link ${w} ${D.sends[0].a}">link to ${short(D.sends[0].a)}</button>` : ''}${coin ? `<a href="https://pump.fun/coin/${coin.mint}" target="_blank" rel="noopener">pump.fun ↗</a>` : ''}<a href="${scan(w)}" target="_blank" rel="noopener">solscan ↗</a></div>`);
    ln('every line is read from public chain data and Jupiter\'s token feed. a busy funder is a pattern, not a name.', 'dim');
  } catch (e) { sp.fail(e.message); }
}

// ------------------------------------------------------------ holders: who holds a coin, and how much of it the dev and the top wallets have
async function holdersCmd(arg) {
  if (!isAddr(arg)) return ln(`usage: ${cmd('holders ', 'holders <coin>')}. the 20 biggest holders, the dev, and how concentrated it is.`, 'dim');
  const sp = spin('reading the biggest holders…');
  try { const H = await api('holders', { m: arg }); if (H.fallback) { sp.ok('summary'); hd(`holders · $${esc(H.sym || short(arg))}`); html(`<div class="tbl"><span>holders</span><span>${nf(H.holders)}</span><span>top holders</span><span>${H.topPct != null ? `<b class="${H.topPct >= 40 ? 'red' : 'amb'}">${nf(H.topPct, 1)}%</b> of supply` : '—'}</span><span>dev holds</span><span>${H.devPct != null ? nf(H.devPct, 2) + '%' : '—'}</span><span>dev</span><span>${H.dev ? addr(H.dev) : '—'}</span></div>`); ln('the free Solana servers are refusing the full top-20 list right now, so this is Jupiter\'s summary. the full list comes back when they answer.', 'dim'); html(`<div class="btns">${H.dev ? `<button class="pri" data-run="dev ${arg}">who is the dev</button>` : ''}<a href="https://pump.fun/coin/${arg}" target="_blank" rel="noopener">pump.fun ↗</a></div>`); return; }
    sp.ok(`${H.top.length} biggest accounts`); hd(`holders · $${esc(H.sym || short(arg))}`);
    const wal = H.top.filter(x => x.wallet), prog = H.top.filter(x => x.wallet === false), sum = a => a.reduce((s, x) => s + (x.pct || 0), 0);
    const top10 = sum(wal.slice(0, 10)), devH = H.top.find(x => x.dev);
    html(`<div class="tbl"><span>top 10 wallets</span><span><b class="${top10 >= 30 ? 'red' : top10 >= 15 ? 'amb' : 'ink'}">${nf(top10, 1)}%</b> of supply</span><span>programs</span><span>${prog.length ? nf(sum(prog), 1) + '% in ' + prog.length + ' program account' + (prog.length > 1 ? 's' : '') + ' (bonding curve or pool)' : 'none in the top 20'}</span><span>dev</span><span>${devH ? `<b class="red">${nf(devH.pct, 2)}%</b> · ${addr(devH.owner)}` : H.dev ? `not in the top 20 · ${addr(H.dev)}` : '—'}</span></div>`);
    const mx = Math.max(...H.top.map(x => x.pct || 0), 1);
    for (const [i, x] of H.top.entries()) html(`<div class="ln"><span class="faint">${String(i + 1).padStart(2)}</span>  <span class="num">${(nf(x.pct, 2) + '%').padStart(7)}</span>  <span class="hbar ${x.dev ? 'd' : x.wallet === false ? 'p' : ''}" style="width:${Math.max(2, (x.pct || 0) / mx * 160).toFixed(0)}px"></span>${x.owner ? (x.wallet ? addr(x.owner) : `<span class="dim">${short(x.owner)} program</span>`) : '<span class="dim">unknown</span>'}${x.dev ? ' <span class="bd r">dev</span>' : ''}</div>`);
    html(`<div class="btns">${H.dev ? `<button class="pri" data-run="dev ${arg}">who is the dev</button>` : ''}${wal[0] ? `<button data-run="opsec ${wal[0].owner}">opsec top holder</button>` : ''}${wal[1] ? `<button data-run="link ${wal[0].owner} ${wal[1].owner}">link top 2</button>` : ''}<a href="https://pump.fun/coin/${arg}" target="_blank" rel="noopener">pump.fun ↗</a></div>`);
  } catch (e) { sp.fail(e.message); }
}

// ------------------------------------------------------------ watch: wallets you keep an eye on. kept in this browser only.
let WATCH = store.get('watch', []);
const saveWatch = () => { store.set('watch', WATCH); watchW(); };
async function watchCmd(a) {
  const w = a[0] === 'me' ? WALLET : a[0]; if (!isAddr(w)) { if (!WATCH.length) return ln(`usage: ${cmd('watch ', 'watch <wallet> [label]')}. pr1v pings you here when it moves.`, 'dim'); hd('watching'); WATCH.forEach((x, i) => ln(`${String(i + 1).padStart(2)}  ${addr(x.w)} ${x.label ? '<b>' + esc(x.label) + '</b>' : ''} <span class="dim">last move ${x.t ? ago(x.t) + ' ago' : '—'}</span> ${cmd('unwatch ' + x.w, 'unwatch')}`)); return; }
  if (WATCH.find(x => x.w === w)) return ln(`already watching ${addr(w)}`, 'dim'); if (WATCH.length >= 12) return ln('you can watch up to 12 wallets.', 'dim');
  const sp = spin('reading its last move…'); try { const S = await api('sigs', { w, limit: 1 }); const x = { w, label: a.slice(1).join(' ').slice(0, 24), s: S[0] ? S[0].s : null, t: S[0] ? S[0].t : null }; WATCH.push(x); saveWatch(); sp.ok(`watching ${addr(w)}${x.label ? ' as <b>' + esc(x.label) + '</b>' : ''}. last move ${x.t ? ago(x.t) + ' ago' : 'never'}. the list lives in this browser only.`); } catch (e) { sp.fail(e.message); }
}
function unwatch(arg) { const i = WATCH.findIndex((x, k) => x.w === arg || String(k + 1) === arg); if (i < 0) return ln(`not watching that. ${cmd('watch')}`, 'dim'); const [x] = WATCH.splice(i, 1); saveWatch(); ln(`stopped watching ${short(x.w)}`, 'dim'); }
function watchW() { const el = $('#watchW'); if (!el) return; el.innerHTML = WATCH.length ? `<div class="wl">${WATCH.map(x => `<div><a class="cmd" data-run="opsec ${x.w}">${x.label ? esc(x.label) + ' · ' : ''}${short(x.w)}</a><span class="${x.fresh ? 'new' : 'dim'}">${x.t ? ago(x.t) : '—'}</span><button class="x" data-run="unwatch ${x.w}" aria-label="stop watching">×</button></div>`).join('')}</div>` : `<p class="dim">keep an eye on any wallet: a dev, a whale, your own. pr1v pings you when it moves.</p><div class="row2"><button data-fill="watch ">watch a wallet</button>${WALLET ? '<button data-run="watch me">watch mine</button>' : ''}</div>`; }
async function watchPoll() { if (!WATCH.length || document.hidden) return; for (const x of WATCH) { try { const S = await api('sigs', { w: x.w, limit: 1 }); const top = S[0]; if (top && top.s !== x.s) { const was = x.s; x.s = top.s; x.t = top.t; x.fresh = true; if (was) { toast(`${x.label || short(x.w)} just moved`); ln(`<span class="ink">●</span> ${x.label ? '<b>' + esc(x.label) + '</b> ' : ''}${addr(x.w)} just moved · <a href="${txl(top.s)}" target="_blank" rel="noopener">tx ↗</a> · ${cmd('opsec ' + x.w, 'opsec')}`); } } } catch { } } store.set('watch', WATCH); watchW(); setTimeout(() => { WATCH.forEach(x => x.fresh = false); }, 30000); }
setInterval(watchPoll, 45000);

// ------------------------------------------------------------ status line, tmux style
function sbar() { const el = $('#sbar'); if (!el) return; const term = !$('#paneTerm').hidden, S = trStats(), off = -new Date().getTimezoneOffset() / 60;
  el.innerHTML = `<span><b>[pr1v]</b></span><span class="sw ${term ? 'on' : ''}">0:term${term ? '*' : ''}</span><span class="sw ${term ? '' : 'on'}">1:trenches${term ? '' : '*'}</span><span class="sp"></span>
    <span class="${NET.ok ? 'ok' : 'bad'}">● mainnet</span><span class="hide-s">rpc ${NET.ms ? Math.round(NET.ms) + 'ms' : '—'}</span><span class="hide-s">launches ${S.n}</span><span class="hide-s">watching ${WATCH.length}</span><span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC${off >= 0 ? '+' : ''}${off}</span>`; }
setInterval(sbar, 1000);

// ------------------------------------------------------------ wallet map: the scan as a picture
function walletMap(R) {
  const W = 680, H = 270, cx = 340, cy = 135, F = R.trace && R.trace[0], F2 = R.trace && R.trace[1], A = R.acct, names = (A.names && A.names.names) || [];
  const L = R.links.slice(0, 6), parts = [];
  const node = (x, y, r, fill, stroke, label, sub, run) => `<g class="n" ${run ? `data-run="${run}"` : ''}><circle cx="${x}" cy="${y}" r="${r}" style="fill:${fill};stroke:${stroke};stroke-width:1.5"/><text x="${x}" y="${y + r + 15}" text-anchor="middle">${esc(label)}</text>${sub ? `<text class="d" x="${x}" y="${y + r + 29}" text-anchor="middle">${esc(sub)}</text>` : ''}</g>`;
  if (F && F.funder) { const busy = F2 && F2.busy, col = busy ? 'var(--amber)' : 'var(--red)';
    parts.push(`<line x1="118" y1="${cy}" x2="${cx - 34}" y2="${cy}" style="stroke:${col};stroke-width:2;stroke-dasharray:5 5"/><polygon points="${cx - 36},${cy - 5} ${cx - 26},${cy} ${cx - 36},${cy + 5}" style="fill:${col}"/>`);
    parts.push(`<text class="d" x="${(118 + cx - 34) / 2}" y="${cy - 9}" text-anchor="middle">${F.amt != null ? nf(F.amt, 2) + ' SOL · first funding' : 'first funding'}</text>`);
    parts.push(node(92, cy, 22, 'var(--win)', col, short(F.funder), busy ? 'busy: exchange?' : 'personal wallet', 'opsec ' + F.funder)); }
  else parts.push(`<text class="d" x="92" y="${cy + 4}" text-anchor="middle">${F && F.busy ? 'funding too deep' : 'no funder found'}</text>`);
  L.forEach((l, i) => { const a = (L.length === 1 ? 0 : -50 + i * (100 / (L.length - 1))) * Math.PI / 180, x = cx + Math.cos(a) * 215, y = cy + Math.sin(a) * 100;
    parts.push(`<line x1="${cx + 30}" y1="${cy}" x2="${x - 16}" y2="${y}" style="stroke:var(--red);stroke-opacity:.55;stroke-width:${1 + Math.min(4, l.n)}"/>`);
    parts.push(node(x, y, 14, 'var(--win)', 'var(--red)', short(l.a), l.n + '× ' + (l.out && l.inn ? '⇄' : l.out ? '→' : '←'), 'opsec ' + l.a)); });
  if (!L.length) parts.push(`<text class="d" x="${cx + 200}" y="${cy + 4}" text-anchor="middle">no direct transfers</text>`);
  if (names.length) parts.push(`<rect x="${cx - 70}" y="14" width="140" height="24" rx="12" style="fill:var(--blk)"/><text x="${cx}" y="30" text-anchor="middle" style="fill:var(--win)">${esc(names[0])}</text><line x1="${cx}" y1="38" x2="${cx}" y2="${cy - 32}" style="stroke:var(--blk);stroke-width:1.5"/>`);
  const C = R.clock; if (C && C.conf) parts.push(`<text class="d" x="${cx}" y="${H - 14}" text-anchor="middle">awake ${String(C.q1).padStart(2, '0')}–${String(C.q0).padStart(2, '0')} UTC · ${C.tz}</text>`);
  if (R.apps.length) parts.push(`<text class="d" x="16" y="24">${esc(R.apps.slice(0, 3).join(' · '))}</text>`);
  parts.push(`<circle cx="${cx}" cy="${cy}" r="30" style="fill:var(--blk)"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" style="fill:var(--win)">${short(R.w).replace('…', '·')}</text><text class="d" x="${cx}" y="${cy + 48}" text-anchor="middle">${usd(A.usd)} visible</text>`);
  return `<div class="map"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="wallet map">${parts.join('')}</svg></div>`;
}

// ------------------------------------------------------------ live tape, ping, sorting
let tapeKey = '', tapeAt = 0;
function tapeW() { const el = $('#tapeIn'); if (!el) return; const L = [...TR.seen.values()].sort((a, b) => Date.parse(b.created || 0) - Date.parse(a.created || 0)).slice(0, 22); const key = L.map(c => c.mint).join();
  if (!L.length || key === tapeKey || Date.now() - tapeAt < 20000 && tapeKey) return; tapeKey = key; tapeAt = Date.now();
  const one = L.map(c => { const a = c.audit || {}, k = a.devMints > 20 ? 'r' : a.devMints != null && a.devMints <= 1 ? 'g' : ''; return `<button data-run="dev ${c.mint}">${img(c)}<b>$${esc(c.sym || '?')}</b>${usd(c.mcap)}<i class="${k}"></i>${age(c.created)}</button>`; }).join('');
  el.innerHTML = one + one; }
let pingCtx = null; function ping() { try { pingCtx = pingCtx || new (window.AudioContext || window.webkitAudioContext)(); const t = pingCtx.currentTime, o = pingCtx.createOscillator(), g = pingCtx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(1320, t); o.frequency.exponentialRampToValueAtTime(880, t + .12); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.06, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .35); o.connect(g); g.connect(pingCtx.destination); o.start(t); o.stop(t + .4); } catch { } }
$('#trPing').onclick = () => { TR.ping = !TR.ping; $('#trPing').textContent = TR.ping ? 'ping on' : 'ping off'; $('#trPing').setAttribute('aria-pressed', TR.ping); if (TR.ping) ping(); };
TR.sort = null; TR.asc = false;
$$('.thead [data-sort]').forEach(b => b.onclick = () => { const k = b.dataset.sort; if (TR.sort === k) TR.asc = !TR.asc; else { TR.sort = k; TR.asc = k === 'age' ? false : false; } $$('.thead [data-sort]').forEach(x => { x.classList.toggle('on', x.dataset.sort === TR.sort); x.classList.toggle('asc', x.dataset.sort === TR.sort && TR.asc); }); trRender(); });
const sortVal = (c, k) => k === 'age' ? Date.parse(c.created || 0) : k === 'mcap' ? c.mcap || 0 : k === 'holders' ? c.holders || 0 : k === 'flow' ? (c.s5 ? c.s5.bv + c.s5.sv : 0) : k === 'dev' ? (c.audit && c.audit.devMints != null ? c.audit.devMints : -1) : 0;

// ------------------------------------------------------------ command palette (⌘K, ctrl+K or /)
let PI = 0, PITEMS = [];
function palItems(q) { q = q.trim(); const ql = q.toLowerCase(), out = [];
  if (isAddr(q)) { out.push(['wallet or coin', [['opsec ' + q, 'how doxxed is it'], ['dev ' + q, 'who launched it'], ['trace ' + q, 'follow the first SOL'], ['holders ' + q, 'top holders'], ['watch ' + q, 'ping me when it moves'], ['bags ' + q, 'what it holds']].map(([c, d]) => ({ run: c, label: c.split(' ')[0] + ' ' + short(q), sub: d, icon: '›' }))]); }
  const cmds = HELP.filter(([c, d]) => !ql || (c + ' ' + d).toLowerCase().includes(ql)).slice(0, 9).map(([c, d]) => ({ [c.includes('<') ? 'fill' : 'run']: c.includes('<') ? c.split(' ')[0] + ' ' : c.split(' ')[0], label: c, sub: d, icon: '⌘' }));
  if (cmds.length) out.push(['commands', cmds]);
  const coins = [...TR.seen.values()].filter(c => !ql || [c.sym, c.name].some(v => v && v.toLowerCase().includes(ql))).sort((a, b) => Date.parse(b.created || 0) - Date.parse(a.created || 0)).slice(0, 6).map(c => ({ run: 'dev ' + c.mint, label: '$' + (c.sym || '?') + ' · ' + (c.name || ''), sub: usd(c.mcap) + ' · ' + age(c.created), img: c }));
  if (coins.length) out.push(['live launches', coins]);
  const seenW = [...new Set(HIST.slice().reverse().flatMap(h => h.split(/\s+/)).filter(isAddr))].filter(a => !ql || a.toLowerCase().includes(ql)).slice(0, 5).map(a => ({ run: 'opsec ' + a, label: short(a), sub: 'recent', icon: '↺' }));
  if (seenW.length) out.push(['recent wallets', seenW]);
  const wt = WATCH.filter(x => !ql || (x.w + (x.label || '')).toLowerCase().includes(ql)).map(x => ({ run: 'opsec ' + x.w, label: (x.label ? x.label + ' · ' : '') + short(x.w), sub: 'watching', icon: '◉' }));
  if (wt.length) out.push(['watching', wt]);
  return out; }
function palRender() { const G = palItems($('#palI').value); PITEMS = G.flatMap(g => g[1]); PI = Math.min(PI, Math.max(0, PITEMS.length - 1)); let k = 0;
  $('#palL').innerHTML = G.map(([g, L]) => `<div class="g">${g}</div>` + L.map(it => `<button data-pi="${k}" class="${k++ === PI ? 'on' : ''}">${it.img ? img(it.img) : `<span>${it.icon}</span>`}<b>${esc(it.label)}</b><span>${esc(it.sub || '')}</span></button>`).join('')).join('') || '<div class="g">nothing found</div>';
  const on = $('#palL .on'); on && on.scrollIntoView({ block: 'nearest' }); }
function palOpen() { $('#pal').hidden = false; $('#palI').value = ''; PI = 0; palRender(); setTimeout(() => $('#palI').focus(), 10); }
function palClose() { $('#pal').hidden = true; }
function palGo(i) { const it = PITEMS[i]; if (!it) return; palClose(); if (it.run) run(it.run); else { if ($('#paneTerm').hidden) showTab('term'); IN.value = it.fill; IN.focus(); } }
$('#kbtn').onclick = palOpen; $('#palI').addEventListener('input', () => { PI = 0; palRender(); });
$('#palI').addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); PI = Math.min(PITEMS.length - 1, PI + 1); palRender(); } else if (e.key === 'ArrowUp') { e.preventDefault(); PI = Math.max(0, PI - 1); palRender(); } else if (e.key === 'Enter') { e.preventDefault(); palGo(PI); } else if (e.key === 'Escape') palClose(); });
$('#palL').addEventListener('click', e => { const b = e.target.closest('[data-pi]'); if (b) palGo(+b.dataset.pi); });
$('#pal').addEventListener('click', e => { if (e.target.id === 'pal') palClose(); });
document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#pal').hidden ? palOpen() : palClose(); } else if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && document.body.classList.contains('ready')) { e.preventDefault(); palOpen(); } else if (e.key === 'Escape' && !$('#pal').hidden) palClose(); });

// ------------------------------------------------------------ runner
const ALIAS = { top: 'holders', bundle: 'holders', follow: 'watch', track: 'watch', trench: 'trenches', live: 'trenches', pump: 'trenches', who: 'dev', deployer: 'dev', creator: 'dev', scan: 'opsec', score: 'opsec', doxx: 'opsec', '?': 'help', man: 'help', funding: 'trace', names: 'name', sns: 'name', hours: 'clock', tz: 'clock', balance: 'bags', fingerprint: 'whoami', inbox: 'drop', cls: 'clear', ca: 'ca' };
const CMDS = ['trenches', 'dev', 'token', 'holders', 'watch', 'unwatch', 'opsec', 'trace', 'link', 'clock', 'bags', 'apps', 'name', 'whoami', 'drop', 'leaks', 'share', 'connect', 'disconnect', 'coin', 'ca', 'buy', 'chart', 'x', 'about', 'faq', 'roadmap', 'ls', 'cat', 'history', 'clear', 'theme', 'intro', 'help', 'date', 'echo', 'sudo', 'exit', 'me'];
async function run(line, silent) {
  line = String(line || '').trim(); if (!line) return;
  if (BUSY) { toast('one moment, still working (ctrl+c to cancel)'); return; }
  if (!/^trenches\b|^trench\b|^live\b/.test(line) && $('#paneTerm').hidden) showTab('term');
  if (!silent) { ln(`<span class="ps">anon@laptop ~ %</span> ${esc(line)}`, 'in'); if (HIST[HIST.length - 1] !== line) { HIST.push(line); if (HIST.length > 80) HIST.shift(); store.set('hist', HIST); } HI = HIST.length; }
  scrollDown(true);
  const parts = line.split(/\s+/); let c = parts[0].toLowerCase(); c = ALIAS[c] || c; const a = parts.slice(1);
  BUSY = true; CANCEL = false; document.body.classList.add('busy');
  try {
    switch (c) {
      case 'help': help(); break; case 'trenches': if (a[0] && ['new', 'hot', 'organic', 'traded'].includes(a[0])) { $$('#trTabs button').forEach(x => x.classList.toggle('on', x.dataset.t === a[0])); TR.tab = a[0]; } showTab('trench'); break;
      case 'dev': showTab('term'); await devCmd(a[0]); break; case 'holders': await holdersCmd(a[0]); break; case 'watch': await watchCmd(a); break; case 'unwatch': unwatch(a[0]); break; case 'token': { if (!isAddr(a[0])) { ln(`usage: ${cmd('token ', 'token <mint>')}`, 'dim'); break; } const c = await tokenCard(a[0]); if (c) { html(`<div class="tbl"><span>mcap</span><span>${usd(c.mcap)}</span><span>holders</span><span>${nf(c.holders)}</span><span>liquidity</span><span>${usd(c.liq)}</span><span>dev</span><span>${c.dev ? addr(c.dev) : '—'}</span></div>`); html(`<div class="btns"><button class="pri" data-run="dev ${c.mint}">who is the dev</button><a href="https://pump.fun/coin/${c.mint}" target="_blank" rel="noopener">pump.fun ↗</a></div>`); } break; } case 'opsec': await opsec(a[0]); break; case 'trace': await trace(a[0]); break; case 'link': await link(a[0], a[1]); break;
      case 'clock': await clockCmd(a[0]); break; case 'bags': await bags(a[0]); break; case 'apps': await apps(a[0]); break; case 'name': await names(a[0]); break;
      case 'whoami': whoami(); break; case 'drop': await drop(a); break; case 'leaks': leaks(); break; case 'share': share(); break;
      case 'connect': await connect(); break; case 'disconnect': await disconnect(); break; case 'me': WALLET ? ln(`connected as ${addr(WALLET)}`) : ln(`not connected. ${cmd('connect')}`, 'dim'); break;
      case 'coin': await coin(); break; case 'ca': case 'buy': case 'chart': case 'x': await coin(c); break;
      case 'about': about(); break; case 'faq': faq(); break; case 'roadmap': roadmap(); break;
      case 'ls': ln(Object.keys(FILES).map(f => cmd('cat ' + f, f)).join('   ')); break;
      case 'cat': (FILES[a[0]] || (() => ln(`cat: ${esc(a[0] || '')}: no such file`, 'dim')))(); break;
      case 'history': HIST.slice(-20).forEach((h, i) => ln(`<span class="faint">${String(i + 1).padStart(3)}</span>  ${cmd(h)}`)); break;
      case 'clear': OUT.innerHTML = ''; break;
      case 'theme': setTheme(a[0] || (document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark')); ln(`theme: ${document.documentElement.dataset.theme}`, 'dim'); break;
      case 'intro': try { sessionStorage.removeItem('pr1vIntro'); } catch { } location.reload(); break;
      case 'date': { const off = -new Date().getTimezoneOffset() / 60; ln(`${new Date().toString().replace(/ \(.+\)$/, '')}`); ln(`${new Date().toUTCString()}`, 'dim'); ln(`your browser tells every site you are on UTC${off >= 0 ? '+' : ''}${off}.`, 'dim'); break; }
      case 'echo': ln(esc(a.join(' '))); break;
      case 'sudo': ln('anon is not in the sudoers file. this incident will not be reported. we keep no logs.', 'dim'); break;
      case 'exit': case 'logout': ln('there is no exit. only pr1v.', 'dim'); break;
      default: if (isAddr(parts[0])) { await opsec(parts[0]); break; } ln(`command not found: ${esc(parts[0])}. try ${cmd('help')}`, 'dim');
    }
  } catch (e) { ln(esc(e.message || String(e)), 'red'); }
  finally { BUSY = false; document.body.classList.remove('busy'); }
}
window.PR1V = { run };

// ------------------------------------------------------------ input
const IN = $('#in');
$('#cmd').addEventListener('submit', e => { e.preventDefault(); const v = IN.value; IN.value = ''; run(v); });
IN.addEventListener('keydown', e => {
  if (e.key === 'ArrowUp') { e.preventDefault(); if (HI > 0) { HI--; IN.value = HIST[HI] || ''; } }
  else if (e.key === 'ArrowDown') { e.preventDefault(); if (HI < HIST.length) { HI++; IN.value = HIST[HI] || ''; } }
  else if (e.key === 'Tab') { e.preventDefault(); const v = IN.value.trim().toLowerCase(); if (!v || v.includes(' ')) return; const m = CMDS.filter(c => c.startsWith(v)); if (m.length === 1) IN.value = m[0] + ' '; else if (m.length) ln(m.join('   '), 'dim'); }
  else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); OUT.innerHTML = ''; }
  else if (e.key === 'c' && e.ctrlKey && !IN.selectionEnd) { if (BUSY) { CANCEL = true; ln('^C', 'dim'); } }
});
document.addEventListener('click', e => {
  const r = e.target.closest('[data-run]'), f = e.target.closest('[data-fill]'), act = e.target.closest('[data-act]');
  if (r) { e.preventDefault(); document.body.classList.remove('side-open'); run(r.dataset.run); }
  else if (f) { e.preventDefault(); document.body.classList.remove('side-open'); IN.value = f.dataset.fill; IN.focus(); }
  else if (act && act.dataset.act === 'share') share();
});
$('#paneTerm').addEventListener('click', e => { if (!e.target.closest('a,button,input') && !getSelection().toString()) IN.focus({ preventScroll: true }); });
$('#wallet').onclick = () => WALLET ? (copy(WALLET, 'your address is copied')) : run('connect');
$('#menuBtn').onclick = () => document.body.classList.toggle('side-open');
function setTheme(t) { t = t === 'dark' ? 'dark' : 'light'; document.documentElement.dataset.theme = t; store.set('theme', t); document.querySelector('meta[name=theme-color]').content = t === 'dark' ? '#18181c' : '#e1e1e5'; }
$('#theme').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
setTheme(store.get('theme', 'light'));
$('#scanF').addEventListener('submit', e => { e.preventDefault(); const v = $('#scanI').value.trim(); if (!v) return $('#scanI').focus(); $('#scanI').value = ''; document.body.classList.remove('side-open'); run('opsec ' + v); });

// ------------------------------------------------------------ side widgets
(function tzClock() { const off = -new Date().getTimezoneOffset() / 60; const f = () => { $('#tz').textContent = `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · UTC${off >= 0 ? '+' : ''}${off} leaks`; }; f(); setInterval(f, 20000); })();
function fpW() { const F = fingerprint(), bits = Math.round(F.reduce((s, f) => s + f[2], 0)), g = k => esc(F.find(f => f[0] === k)[1]);
  $('#fp').innerHTML = `<div class="kv"><span>timezone</span><span>${g('timezone')}</span><span>screen</span><span>${g('screen')}</span><span>gpu</span><span title="${g('gpu')}">${g('gpu')}</span><span>canvas</span><span>${g('canvas hash')}</span></div><div class="meter"><i></i></div><div class="dim">≈ ${bits} bits identify you. 33 bits picks one person out of everyone on earth.</div><a class="wlink" data-run="whoami">full report</a>`;
  requestAnimationFrame(() => setTimeout(() => { const i = $('#fp .meter i'); if (i) i.style.width = Math.min(100, bits / 50 * 100) + '%'; }, 300)); }
async function dropW() { const el = $('#dropW'); try { const I = await idx(); const k = Object.keys(I.keys).length, m = I.msgs.length;
    const feed = [...Object.entries(I.keys).map(([w, v]) => ({ t: v.t, sig: v.sig, h: `<b>${short(w)}</b> opened an inbox` })), ...I.msgs.map(x => ({ t: x.t, sig: x.sig, h: `<b>${short(x.from)}</b> → <b>${short(x.to)}</b> sealed note` }))].sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, 5);
    const mineOpen = WALLET && I.keys[WALLET];
    el.innerHTML = `<div class="kv"><span>inboxes</span><span>${k}</span><span>sealed notes</span><span>${m}</span>${WALLET ? `<span>yours</span><span>${mineOpen ? 'open' : 'not open yet'}</span>` : ''}</div>
      <div class="feed">${feed.length ? feed.map(f => `<a href="${txl(f.sig)}" target="_blank" rel="noopener"><span>${f.h}</span><span>${ago(f.t)}</span></a>`).join('') : '<span class="dim">no notes yet. the first one shows up here.</span>'}</div>
      <div class="row2"><button data-run="${mineOpen ? 'drop inbox' : 'drop key'}">${mineOpen ? 'open inbox' : 'open my inbox'}</button><button data-fill="drop send ">send a note</button></div>`; }
  catch (e) { el.innerHTML = `<p class="dim">could not read the chain right now. <a class="wlink" data-run="drop">drop</a></p>`; } }
async function coinW() { const C = await coinData(); if (!C.ca) return; $('#coinW').hidden = false; $('#coinB').innerHTML = `<div class="kv"><span>ca</span><span><a class="cmd" data-run="ca">${short(C.ca)} ⧉</a></span><span>mcap</span><span>${usd(C.mcap)}</span><span>holders</span><span>${nf(C.holders)}</span></div><div class="row2"><button data-run="buy">buy</button><button data-run="chart">chart</button>${C.x ? '<button data-run="x">𝕏</button>' : ''}</div>`; }
const TODO = ['one wallet per job: dev, trade, hold', 'no .sol name on your main wallet', 'never pay your own wallets directly', 'crop addresses out of screenshots', 'disconnect old apps from your wallet', 'use a private RPC or a VPN in your wallet', 'scan your main wallet with opsec', 'open a drop inbox'];
function todoW() { const S = store.get('todo', []); const el = $('#todo'); el.className = 'wb todo';
  el.innerHTML = TODO.map((t, i) => `<label class="${S.includes(i) ? 'on' : ''}"><input type="checkbox" data-i="${i}" ${S.includes(i) ? 'checked' : ''}><span>${t}</span></label>`).join('') + `<div class="pc">${S.length}/${TODO.length} done</div>`;
  el.querySelectorAll('input').forEach(i => i.onchange = () => { const s = new Set(store.get('todo', [])); i.checked ? s.add(+i.dataset.i) : s.delete(+i.dataset.i); store.set('todo', [...s]); todoW(); }); }

// ------------------------------------------------------------ boot
const ART = `██████╗ ██████╗  ██╗██╗   ██╗
██╔══██╗██╔══██╗███║██║   ██║
██████╔╝██████╔╝╚██║██║   ██║
██╔═══╝ ██╔══██╗ ██║╚██╗ ██╔╝
██║     ██║  ██║ ██║ ╚████╔╝
╚═╝     ╚═╝  ╚═╝ ╚═╝  ╚═══╝`;
let booted = false;
async function boot() {
  if (booted) return; booted = true; document.body.classList.add('ready');
  fpW(); todoW(); dropW(); coinW(); trPoll(true); watchW(); sbar(); setTimeout(watchPoll, 4000);
  const d = new Date(); const step = reduced ? 0 : 90;
  const L = [() => ln(`last login: ${d.toDateString()} ${d.toTimeString().slice(0, 8)} on ttys001`, 'dim boot'), () => pre(ART, 'art boot'), () => ln('<b>pr1v</b> · the privacy layer for solana', 'boot'), () => ln('public chain. pr1v you.', 'dim boot'), () => ln('', 'boot'),
    () => html(`<div class="tbl boot"><span>${cmd('trenches')}</span><span>live pump.fun launches and who is behind them</span><span>${cmd('opsec ', 'opsec <wallet>')}</span><span>how doxxed is a wallet</span><span>${cmd('whoami')}</span><span>what this browser gives away</span><span>${cmd('trace ', 'trace <wallet>')}</span><span>follow its first SOL back</span><span>${cmd('drop')}</span><span>sealed notes between wallets</span><span>${cmd('help')}</span><span>everything else</span></div>`),
    () => ln('paste any wallet and press enter. nothing you scan is stored.', 'dim boot')];
  for (const f of L) { f(); await sleep(step); }
  const q = new URLSearchParams(location.search); const w = q.get('w') || (location.hash.match(/^#\/?([1-9A-HJ-NP-Za-km-z]{32,44})$/) || [])[1];
  if (w && isAddr(w)) run('opsec ' + w);
  if (matchMedia('(pointer: fine)').matches) IN.focus({ preventScroll: true });
  const p = prov(); if (p && p.isConnected && p.publicKey) { WALLET = p.publicKey.toString(); walletUI(); }
  else if (p && p.connect) p.connect({ onlyIfTrusted: true }).then(r => { if (r && r.publicKey) { WALLET = r.publicKey.toString(); walletUI(); } }).catch(() => { });
}
window.PR1V.boot = boot;
document.addEventListener('pr1v:ready', boot);
setTimeout(() => { if (!booted && !window.__pr1vIntroRunning) boot(); }, 2500);
setTimeout(() => { if (!booted) boot(); }, 25000);
})();
