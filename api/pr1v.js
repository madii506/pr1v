// pr1v engine. Reads only public chain data; builds transactions the user signs in their own wallet. Holds no keys.
const { PublicKey, Transaction, SystemProgram, TransactionInstruction, ComputeBudgetProgram } = require('@solana/web3.js');

const RPCS = [process.env.RPC_URL, 'https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com'].filter(Boolean);
const TAG = new PublicKey(process.env.PR1V_TAG || 'EhcUVBm7ZfunUX9TWTakEMEJiyzh9qtqf7Ymcwp7PCNX'); // an address with no key: every pr1v drop touches it, so the chain itself is the index
const MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const JUP = 'https://lite-api.jup.ag';

const PROGRAMS = {
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': 'pump.fun', 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA': 'PumpSwap', 'pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ': 'pump.fun fees',
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': 'Jupiter', 'jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu': 'Jupiter limit', 'DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23M': 'Jupiter DCA',
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': 'Raydium', 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C': 'Raydium CPMM', 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': 'Raydium CLMM',
  'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj': 'Raydium LaunchLab', 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo': 'Meteora DLMM', 'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB': 'Meteora pools',
  'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN': 'Meteora DBC', 'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG': 'Meteora DAMM', 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': 'Orca',
  'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K': 'Magic Eden', 'TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN': 'Tensor', 'TCMPhJdwDryooaGtiocG1u3xcYbRpiJzb283XfCZsDp': 'Tensor',
  'namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX': 'SNS names', 'jCebN34bUfdeUYJT13J1yG16XWQpt5PDx6Mse9GUqhR': 'SNS names', 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr': 'memo',
  'Stake11111111111111111111111111111111111111': 'staking', 'SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy': 'stake pools', 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD': 'Marinade',
  'worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth': 'Wormhole', 'DEbrdGj3HsRsAzx6uH4MKyREKxVAfBydijLUF3ygsFfh': 'deBridge', 'dst5MGcFPoBeREFAA5E3tU5ij8m5uVYwkzkSAbsLbNo': 'deBridge',
  'MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA': 'marginfi', 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD': 'Kamino', 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH': 'Drift',
  'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY': 'Phoenix', 'BSfD6SHZigAfDWSjzD5Q41jw8LmKwtmjskPH9XW1mrRW': 'Pump fun AMM fees', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb': null,
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': null, 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': null, '11111111111111111111111111111111': null, 'ComputeBudget111111111111111111111111111111': null,
};
const SWAPPY = new Set(['pump.fun', 'PumpSwap', 'Jupiter', 'Jupiter limit', 'Jupiter DCA', 'Raydium', 'Raydium CPMM', 'Raydium CLMM', 'Raydium LaunchLab', 'Meteora DLMM', 'Meteora pools', 'Meteora DBC', 'Meteora DAMM', 'Orca', 'Magic Eden', 'Tensor', 'Phoenix', 'Drift', 'Kamino', 'marginfi']);

// ------------------------------------------------------------------ rpc
async function rpcRaw(body) {
  let last = null;
  for (let round = 0; round < 2; round++) {
    for (const u of RPCS) {
      try {
        const r = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
        if (r.status === 429 || r.status === 401 || r.status === 403 || r.status >= 500) { last = new Error('rpc ' + r.status); continue; }
        const j = await r.json();
        if (!Array.isArray(j) && j.error && /rate|too many|busy/i.test(j.error.message || '')) { last = new Error(j.error.message); continue; }
        return j;
      } catch (e) { last = e; }
    }
    await new Promise(r => setTimeout(r, 700));
  }
  throw last || new Error('the Solana RPC did not answer');
}
async function rpc(method, params) { const j = await rpcRaw({ jsonrpc: '2.0', id: 1, method, params }); if (j.error) throw new Error(j.error.message || 'rpc error'); return j.result; }
async function rpcMany(calls, chunk = 25) {
  const out = new Array(calls.length);
  for (let i = 0; i < calls.length; i += chunk) {
    const part = calls.slice(i, i + chunk).map((c, k) => ({ jsonrpc: '2.0', id: i + k, method: c[0], params: c[1] }));
    let j = await rpcRaw(part);
    if (!Array.isArray(j)) { j = await Promise.all(part.map(p => rpcRaw(p).catch(e => ({ id: p.id, error: { message: e.message } })))); }
    for (const x of j) out[x.id] = x.error ? null : x.result;
  }
  return out;
}
const cache = new Map();
async function cached(key, ttl, fn) { const c = cache.get(key); if (c && Date.now() - c.t < ttl) return c.v; const v = await fn(); cache.set(key, { t: Date.now(), v }); if (cache.size > 400) cache.delete(cache.keys().next().value); return v; }

// ------------------------------------------------------------------ helpers
const isAddr = s => typeof s === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s) && (() => { try { new PublicKey(s); return true; } catch { return false; } })();
const onCurve = s => { try { return PublicKey.isOnCurve(new PublicKey(s).toBytes()); } catch { return false; } };
const need = (cond, msg) => { if (!cond) { const e = new Error(msg); e.code = 400; throw e; } };
async function jget(url, ms = 9000) { const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { accept: 'application/json' } }); if (!r.ok) throw new Error(url.split('/')[2] + ' ' + r.status); return r.json(); }

async function tokenInfo(mints) {
  const out = {};
  for (let i = 0; i < mints.length; i += 100) {
    const part = mints.slice(i, i + 100);
    try { const arr = await jget(`${JUP}/tokens/v2/search?query=${part.join(',')}`); for (const t of arr || []) out[t.id] = { sym: t.symbol, name: t.name, icon: t.icon, usd: t.usdPrice ?? null, mcap: t.mcap ?? null, holders: t.holderCount ?? null, verified: !!t.isVerified, dev: t.dev || null, launchpad: t.launchpad || null }; } catch { }
  }
  const missing = mints.filter(m => !out[m] || out[m].usd == null);
  for (let i = 0; i < missing.length; i += 50) {
    try { const p = await jget(`${JUP}/price/v3?ids=${missing.slice(i, i + 50).join(',')}`); for (const [k, v] of Object.entries(p || {})) { out[k] = out[k] || {}; out[k].usd = v && v.usdPrice != null ? v.usdPrice : out[k].usd ?? null; } } catch { }
  }
  return out;
}

async function sns(w) {
  const base = 'https://sns-api.bonfida.com/v2/user';
  const res = { fav: null, names: [], ok: false };
  const pick = (j, many) => { if (!j || typeof j !== 'object') return many ? [] : null; let v = j[w] ?? j.result ?? null; if (v && typeof v === 'object' && !Array.isArray(v)) v = v[w] ?? Object.values(v)[0]; if (many) return (Array.isArray(v) ? v : v ? [v] : []).map(x => typeof x === 'string' ? x : x && (x.domain || x.name)).filter(Boolean); return Array.isArray(v) ? v[0] || null : typeof v === 'string' ? v : v && (v.domain || v.name) || null; };
  const [f, d] = await Promise.all([jget(`${base}/fav-domains/${w}`, 6000).catch(() => undefined), jget(`${base}/domains/${w}`, 6000).catch(() => undefined)]);
  if (f !== undefined || d !== undefined) res.ok = true;
  const fav = pick(f, false); if (fav) res.fav = /\.sol$/.test(fav) ? fav : fav + '.sol';
  res.names = pick(d, true).slice(0, 12).map(n => /\.sol$/.test(n) ? n : n + '.sol');
  if (res.fav && !res.names.includes(res.fav)) res.names.unshift(res.fav);
  return res;
}

// ------------------------------------------------------------------ account
async function acct(w) {
  const one = (m, p) => rpc(m, p).catch(() => null);
  const [bal, info, t1, t2] = await Promise.all([
    one('getBalance', [w, { commitment: 'confirmed' }]),
    one('getAccountInfo', [w, { encoding: 'base64', dataSlice: { offset: 0, length: 0 } }]),
    one('getTokenAccountsByOwner', [w, { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, { encoding: 'jsonParsed' }]),
    one('getTokenAccountsByOwner', [w, { programId: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' }, { encoding: 'jsonParsed' }]),
  ]);
  if (!bal && !info && !t1 && !t2) throw new Error('the Solana RPC did not answer. try again in a moment');
  const accts = [...((t1 && t1.value) || []), ...((t2 && t2.value) || [])];
  const held = new Map(); let empty = 0;
  for (const a of accts) { const i = a.account.data.parsed && a.account.data.parsed.info; if (!i) continue; const amt = +i.tokenAmount.uiAmount || 0; if (!amt) { empty++; continue; } held.set(i.mint, (held.get(i.mint) || 0) + amt); }
  const mints = [...held.keys()];
  const meta = await tokenInfo([SOL_MINT, ...mints.slice(0, 300)]);
  const solUsd = meta[SOL_MINT] && meta[SOL_MINT].usd;
  const tokens = mints.map(m => { const t = meta[m] || {}; const amount = held.get(m); return { mint: m, sym: t.sym || null, name: t.name || null, icon: t.icon || null, amount, usd: t.usd != null ? amount * t.usd : null, verified: !!t.verified }; })
    .sort((a, b) => (b.usd || 0) - (a.usd || 0));
  const sol = (bal && bal.value || 0) / 1e9; const v = info && info.value;
  const names = await sns(w);
  return { w, sol, solUsd, usd: (solUsd ? sol * solUsd : 0) + tokens.reduce((s, t) => s + (t.usd || 0), 0), exists: !!v || sol > 0 || accts.length > 0, program: !!(v && v.executable), owner: v ? v.owner : null, onCurve: onCurve(w),
    tokens: tokens.slice(0, 40), tokenCount: tokens.length, tokensRead: !!(t1 || t2), emptyAccounts: empty, nftish: tokens.filter(t => t.amount === 1 && !t.usd).length, names };
}

// ------------------------------------------------------------------ history
async function sigs(w, before, limit = 1000) {
  const r = await rpc('getSignaturesForAddress', [w, { limit: Math.min(1000, limit), ...(before ? { before } : {}), commitment: 'confirmed' }]);
  return (r || []).map(x => ({ s: x.signature, t: x.blockTime || null, e: x.err ? 1 : 0 }));
}

function summarize(tx, sig, w) {
  if (!tx) return { s: sig, missing: 1 };
  const m = tx.transaction.message, meta = tx.meta || {};
  const keys = m.accountKeys.map(k => typeof k === 'string' ? k : k.pubkey);
  const payer = keys[0];
  const idx = keys.indexOf(w);
  const signers = m.accountKeys.filter(k => k.signer).map(k => k.pubkey);
  const sol = idx >= 0 ? (meta.postBalances[idx] - meta.preBalances[idx]) : 0;
  const tokOwner = {}; for (const b of [...(meta.preTokenBalances || []), ...(meta.postTokenBalances || [])]) if (b.owner) tokOwner[keys[b.accountIndex]] = b.owner;
  const tokMint = {}; for (const b of [...(meta.preTokenBalances || []), ...(meta.postTokenBalances || [])]) tokMint[keys[b.accountIndex]] = b.mint;
  const all = [...m.instructions]; for (const g of meta.innerInstructions || []) all.push(...g.instructions);
  const progs = new Set(); const xfers = []; let memo = null, create = null;
  for (const ix of all) {
    const pid = ix.programId; const name = PROGRAMS[pid]; if (name) progs.add(name); else if (name === undefined && pid) progs.add('other:' + pid);
    const p = ix.parsed;
    if (ix.program === 'spl-memo' && typeof p === 'string') memo = p;
    if (ix.program === 'system' && p && (p.type === 'transfer' || p.type === 'transferWithSeed')) {
      const i = p.info; if (i.source === w && i.destination !== w) xfers.push({ a: i.destination, dir: 'out', k: 'sol', amt: i.lamports / 1e9 }); else if (i.destination === w && i.source !== w) xfers.push({ a: i.source, dir: 'in', k: 'sol', amt: i.lamports / 1e9 });
    }
    if ((ix.program === 'spl-token' || ix.program === 'spl-token-2022') && p && (p.type === 'transfer' || p.type === 'transferChecked')) {
      const i = p.info; const so = tokOwner[i.source] || i.authority || i.multisigAuthority, de = tokOwner[i.destination] || null; const mint = i.mint || tokMint[i.source] || tokMint[i.destination] || null;
      const amt = i.tokenAmount ? +i.tokenAmount.uiAmount : null;
      if (so === w && de && de !== w) xfers.push({ a: de, dir: 'out', k: 'tok', mint, amt }); else if (de === w && so && so !== w) xfers.push({ a: so, dir: 'in', k: 'tok', mint, amt });
    }
    if (pid === '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P' && Array.isArray(ix.accounts) && signers.includes(w) && (meta.logMessages || []).some(l => /Instruction: Create(V2)?$/.test(l))) create = create || ix.accounts[0];
  }
  for (const x of xfers) x.wallet = onCurve(x.a);
  const named = [...progs].filter(p => !p.startsWith('other:'));
  return { s: sig, t: tx.blockTime || null, payer, signer: signers.includes(w), sol: sol / 1e9, fee: (meta.fee || 0) / 1e9, err: meta.err ? 1 : 0, progs: named, other: [...progs].filter(p => p.startsWith('other:')).length,
    swap: named.some(p => SWAPPY.has(p)), xfers: xfers.slice(0, 30), memo: memo ? memo.slice(0, 120) : null, create };
}
async function txs(w, list) {
  const res = await rpcMany(list.map(s => ['getTransaction', [s, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]]), 20);
  return list.map((s, i) => summarize(res[i], s, w));
}

// first SOL into a wallet: its funder
async function firstFunding(w, maxPages = 3) {
  let before = null, all = [], pages = 0;
  while (pages < maxPages) { const p = await sigs(w, before, 1000); pages++; all = all.concat(p); if (p.length < 1000) break; before = p[p.length - 1].s; }
  const busy = all.length >= maxPages * 1000;
  if (busy || !all.length) return { w, count: all.length, busy, first: null, funder: null };
  const oldest = all.slice(-8).reverse();
  const sum = await txs(w, oldest.map(x => x.s));
  let hit = null; for (const s of sum) { const x = (s.xfers || []).find(x => x.dir === 'in' && x.k === 'sol' && x.amt > 0); if (x) { hit = { ...x, s: s.s, t: s.t }; break; } }
  if (!hit) for (const s of sum) { if (s.payer && s.payer !== w && s.sol > 0) { hit = { a: s.payer, amt: s.sol, s: s.s, t: s.t, k: 'payer' }; break; } }
  return { w, count: all.length, busy: false, first: all[all.length - 1].t, funder: hit ? hit.a : null, amt: hit ? hit.amt : null, sig: hit ? hit.s : null, at: hit ? hit.t : null };
}
async function trace(w, hops = 4) {
  const chain = []; let cur = w; const seen = new Set();
  for (let i = 0; i < hops; i++) {
    if (seen.has(cur)) break; seen.add(cur);
    const f = await cached('ff:' + cur, 300000, () => firstFunding(cur));
    chain.push(f);
    if (f.busy || !f.funder) break;
    cur = f.funder;
  }
  const last = chain[chain.length - 1];
  if (last && !last.busy && last.funder && !seen.has(last.funder)) { const n = await cached('cnt:' + last.funder, 300000, () => sigs(last.funder, null, 1000)); chain.push({ w: last.funder, count: n.length, busy: n.length >= 1000, partial: true }); }
  return chain;
}

// ------------------------------------------------------------------ drop: encrypted wallet-to-wallet notes, indexed on-chain through TAG
async function index() {
  return cached('idx', 15000, async () => {
    const list = await sigs(TAG.toBase58(), null, 300);
    const ok = list.filter(x => !x.e);
    const res = await rpcMany(ok.map(x => ['getTransaction', [x.s, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }]]), 20);
    const keys = {}, msgs = [];
    ok.forEach((x, i) => { const tx = res[i]; if (!tx) return; const s = summarize(tx, x.s, TAG.toBase58()); const memo = (() => { const m = tx.transaction.message; for (const ix of m.instructions) if (ix.program === 'spl-memo' && typeof ix.parsed === 'string') return ix.parsed; return null; })();
      if (!memo || !memo.startsWith('pr1v1|')) return; const p = memo.split('|'); const from = s.payer;
      if (p[1] === 'k' && p[2] && !keys[from]) keys[from] = { pub: p[2], sig: x.s, t: x.t };
      if (p[1] === 'm' && p.length >= 6 && isAddr(p[2])) msgs.push({ from, to: p[2], eph: p[3], nonce: p[4], box: p[5], sig: x.s, t: x.t }); });
    return { tag: TAG.toBase58(), keys, msgs, n: ok.length, at: Date.now() };
  });
}
async function buildMemoTx(from, memo) {
  const fp = new PublicKey(from);
  const { blockhash, lastValidBlockHeight } = await rpc('getLatestBlockhash', [{ commitment: 'confirmed' }]);
  const tx = new Transaction({ feePayer: fp, blockhash, lastValidBlockHeight });
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 120000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 20000 }));
  tx.add(SystemProgram.transfer({ fromPubkey: fp, toPubkey: TAG, lamports: 0 }));
  tx.add(new TransactionInstruction({ keys: [{ pubkey: fp, isSigner: true, isWritable: false }], programId: MEMO, data: Buffer.from(memo, 'utf8') }));
  const raw = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  need(raw.length <= 1232, 'that note is too long for one transaction. make it shorter');
  return { tx: raw.toString('base64'), bytes: raw.length };
}
const b64ok = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max && /^[A-Za-z0-9+/=]+$/.test(s);


// ------------------------------------------------------------------ trenches: live pump.fun coins from Jupiter's token feed, with what is public about each dev
const slim = t => ({ mint: t.id, sym: t.symbol, name: t.name, icon: t.icon || null, dev: t.dev || null, pad: t.launchpad || null, mcap: t.mcap ?? null, liq: t.liquidity ?? null, holders: t.holderCount ?? null, usd: t.usdPrice ?? null,
  created: (t.firstPool && t.firstPool.createdAt) || t.createdAt || null, organic: t.organicScore ?? null, organicL: t.organicScoreLabel || null,
  s5: t.stats5m ? { pc: t.stats5m.priceChange ?? null, bv: t.stats5m.buyVolume ?? 0, sv: t.stats5m.sellVolume ?? 0, b: t.stats5m.numBuys ?? 0, s: t.stats5m.numSells ?? 0, tr: t.stats5m.numTraders ?? 0 } : null,
  s1h: t.stats1h ? { pc: t.stats1h.priceChange ?? null, v: (t.stats1h.buyVolume || 0) + (t.stats1h.sellVolume || 0), tr: t.stats1h.numTraders ?? 0 } : null,
  audit: t.audit ? { devPct: t.audit.devBalancePercentage ?? null, devMints: t.audit.devMints ?? null, devGrad: t.audit.devMigrations ?? null, topPct: t.audit.topHoldersPercentage ?? null } : null,
  x: t.twitter || null, web: t.website || null, tg: t.telegram || null, tags: (t.tags || []).slice(0, 6) });
const isPump = t => t && (t.launchpad === 'pump.fun' || /pump$/.test(t.id || ''));
async function trenches(tab) {
  const path = { new: 'recent', hot: 'toptrending/5m?limit=80', organic: 'toporganicscore/5m?limit=80', traded: 'toptraded/5m?limit=80' }[tab] || 'recent';
  return cached('tr:' + tab, tab === 'new' ? 3500 : 9000, async () => { const arr = await jget(`${JUP}/tokens/v2/${path}`, 8000); return { tab, at: Date.now(), coins: (arr || []).filter(isPump).map(slim) }; });
}
async function token(m) { const arr = await jget(`${JUP}/tokens/v2/search?query=${m}`, 8000); const t = (arr || []).find(x => x.id === m); return t ? slim(t) : null; }
async function dev(w) {
  const first = await cached('ff1:' + w, 300000, () => firstFunding(w, 2));
  const list = await cached('cnt:' + w, 120000, () => sigs(w, null, 1000));
  const recent = list.filter(x => !x.e).slice(0, 40);
  const sum = recent.length ? await txs(w, recent.map(x => x.s)) : [];
  const creates = [...new Set(sum.filter(x => x.create).map(x => x.create))];
  let funder = null;
  if (first.funder) { const fl = await cached('cnt:' + first.funder, 300000, () => sigs(first.funder, null, 1000)); funder = { w: first.funder, count: fl.length, busy: fl.length >= 1000, amt: first.amt, at: first.at, sig: first.sig }; }
  const meta = creates.length ? await tokenInfo(creates.slice(0, 20)) : {};
  const out = new Map(); for (const t of sum) for (const x of t.xfers || []) if (x.wallet && x.dir === 'out' && !t.swap) out.set(x.a, (out.get(x.a) || 0) + 1);
  return { w, count: list.length, busy: list.length >= 1000, first: first.first || (list.length && list.length < 1000 ? list[list.length - 1].t : null), last: list[0] ? list[0].t : null,
    funder, creates: creates.map(m => ({ mint: m, sym: meta[m] && meta[m].sym || null, mcap: meta[m] && meta[m].mcap || null })), sends: [...out.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([a, n]) => ({ a, n })),
    apps: [...new Set(sum.filter(x => x.signer).flatMap(x => x.progs))].slice(0, 8) };
}

// ------------------------------------------------------------------ holders: the 20 biggest token accounts, who owns them, and which ones are programs (curves, pools)
async function holders(m) {
  let sup, big; try { [sup, big] = await Promise.all([rpc('getTokenSupply', [m]), rpc('getTokenLargestAccounts', [m, { commitment: 'confirmed' }])]); }
  catch (e) { const tk = await token(m).catch(() => null); if (!tk) throw e; return { mint: m, sym: tk.sym, dev: tk.dev, fallback: true, holders: tk.holders, topPct: tk.audit && tk.audit.topPct, devPct: tk.audit && tk.audit.devPct, top: [] }; }
  const list = (big && big.value || []).slice(0, 20); const supply = +(sup && sup.value && sup.value.uiAmount) || 0;
  const infos = list.length ? await rpc('getMultipleAccounts', [list.map(x => x.address), { encoding: 'jsonParsed' }]) : { value: [] };
  const t = await token(m).catch(() => null);
  const top = list.map((x, i) => { const inf = infos.value && infos.value[i]; const owner = inf && inf.data && inf.data.parsed && inf.data.parsed.info && inf.data.parsed.info.owner || null; const amt = +x.uiAmount || 0;
    return { acct: x.address, owner, amt, pct: supply ? amt / supply * 100 : null, wallet: owner ? onCurve(owner) : null, dev: !!(t && t.dev && owner === t.dev) }; });
  return { mint: m, sym: t && t.sym || null, dev: t && t.dev || null, supply, top };
}

// ------------------------------------------------------------------ http
async function body(req) { if (req.body && typeof req.body === 'object') return req.body; let s = ''; for await (const c of req) s += c; try { return JSON.parse(s || '{}'); } catch { return {}; } }
module.exports = async (req, res) => {
  const q = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const a = q.a;
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('content-type', 'application/json; charset=utf-8');
  if (req.method === 'OPTIONS') { res.setHeader('access-control-allow-headers', 'content-type'); res.statusCode = 204; return res.end(); }
  const send = (code, v, maxAge = 0) => { res.statusCode = code; if (maxAge) res.setHeader('cache-control', `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 4}`); else res.setHeader('cache-control', 'no-store'); res.end(JSON.stringify(v)); };
  try {
    if (a === 'acct') { need(isAddr(q.w), 'that is not a Solana address'); return send(200, await cached('acct:' + q.w, 30000, () => acct(q.w)), 20); }
    if (a === 'sigs') { need(isAddr(q.w), 'that is not a Solana address'); need(!q.before || /^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(q.before), 'bad cursor'); return send(200, await sigs(q.w, q.before, +q.limit || 1000), 20); }
    if (a === 'txs') { need(isAddr(q.w), 'that is not a Solana address'); const list = String(q.s || '').split(',').filter(x => /^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(x)).slice(0, 40); need(list.length, 'no transactions given'); return send(200, await txs(q.w, list), 300); }
    if (a === 'trace') { need(isAddr(q.w), 'that is not a Solana address'); return send(200, await cached('tr:' + q.w, 300000, () => trace(q.w, Math.min(5, +q.hops || 4))), 120); }
    if (a === 'count') { need(isAddr(q.w), 'that is not a Solana address'); const n = await cached('cnt:' + q.w, 300000, () => sigs(q.w, null, 1000)); return send(200, { w: q.w, count: n.length, busy: n.length >= 1000, last: n[0] ? n[0].t : null }, 120); }
    if (a === 'sns') { need(isAddr(q.w), 'that is not a Solana address'); return send(200, await cached('sns:' + q.w, 300000, () => sns(q.w)), 120); }
    if (a === 'idx') return send(200, await index(), 10);
    if (a === 'trenches') return send(200, await trenches(String(q.tab || 'new')), 3);
    if (a === 'holders') { need(isAddr(q.m), 'that is not a token address'); return send(200, await cached('hold:' + q.m, 20000, () => holders(q.m)), 15); }
    if (a === 'token') { need(isAddr(q.m), 'that is not a token address'); const t = await cached('tok:' + q.m, 15000, () => token(q.m)); need(t, 'Jupiter does not know that token'); return send(200, t, 10); }
    if (a === 'dev') { need(isAddr(q.w), 'that is not a Solana address'); return send(200, await cached('dev:' + q.w, 120000, () => dev(q.w)), 60); }
    if (a === 'coin') { const ca = process.env.PR1V_CA || null, x = process.env.PR1V_X || null; if (!ca) return send(200, { ca: null, x }, 30); const m = await cached('coin', 20000, () => tokenInfo([ca])); return send(200, { ca, x, ...(m[ca] || {}) }, 15); }
    if (a === 'status') { const sig = String(q.sig || ''); need(/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(sig), 'bad signature'); const r = await rpc('getSignatureStatuses', [[sig], { searchTransactionHistory: true }]); const s = r && r.value && r.value[0]; return send(200, !s ? { status: 'pending' } : s.err ? { status: 'failed', err: JSON.stringify(s.err) } : { status: s.confirmationStatus || 'processed' }); }
    if (req.method === 'POST') {
      const b = await body(req);
      if (a === 'bkey') { need(isAddr(b.from), 'connect a wallet first'); need(b64ok(b.pub, 48), 'bad key'); return send(200, await buildMemoTx(b.from, `pr1v1|k|${b.pub}`)); }
      if (a === 'bmsg') { need(isAddr(b.from) && isAddr(b.to), 'bad address'); need(b64ok(b.eph, 48) && b64ok(b.nonce, 40) && b64ok(b.box, 640), 'that note is too long. keep it under 280 characters'); return send(200, await buildMemoTx(b.from, `pr1v1|m|${b.to}|${b.eph}|${b.nonce}|${b.box}`)); }
      if (a === 'send') { need(b64ok(b.tx, 2000), 'bad transaction'); const sig = await rpc('sendTransaction', [b.tx, { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 3 }]); cache.delete('idx'); return send(200, { sig }); }
    }
    return send(404, { error: 'unknown action' });
  } catch (e) { return send(e.code || 500, { error: String(e.message || e).slice(0, 300) }); }
};
