/* =========================================================
   SYNC — keeps the signed-in student's data in Supabase.

   The browser keeps working from its local copy (S in state.js,
   saved to localStorage), so the app stays fast and works offline.
   This module mirrors that copy to the database:

   - Every save() schedules a push: the local state is turned into
     table rows, compared with what the server last had ("base"),
     and only the differences are sent (upserts and deletes).
   - On sign-in (and each page load while signed in) it pulls the
     student's rows and merges them three ways: local copy, base,
     server. A side that didn't change takes the other side's
     version; if both changed a card's schedule, the newer answer
     wins; for other rows the local change wins.
   - The first sign-in on a device has no base, so progress made
     before signing in is uploaded to the account.
   - Each answer is also logged to reviews (append-only), queued
     locally until it's sent.

   Synced: own decks and cards (and cards added to built-in decks),
   card schedules and flags, per-deck new-card limit and shuffle,
   grading settings, deck descriptions, heatmap history, streak and
   total. Device-only: demo clock, today's counters, cart, sample
   heatmap, the open deck, recorded sounds (only their keys sync).
   ========================================================= */
import { supabase } from "./supabase.js";
import { S, allDecks, fresh, now, replaceState, setSaveHook } from "./state.js";

const META_KEY = "flick-sync";      // {owner: students.id, base: {rowKey: row}, at: last sync time}
const REV_KEY = "flick-reviews";    // answers waiting to be sent
const PAGE = 1000, CHUNK = 500, REV_CAP = 5000;

let sid = null, wanted = null, timer = null, busy = false, again = false;   // wanted: the student we should be syncing for
let meta = loadMeta();
let status = {state: "off", at: meta.at || null, error: null};
const listeners = new Set();
export const onSyncStatus = fn => listeners.add(fn);
export const syncStatus = () => ({...status, pending: loadRev().length});
const setStatus = (state, error = null) => {
  status = {state, at: state === "ok" ? Date.now() : status.at, error};
  listeners.forEach(fn => fn(syncStatus()));
};

function loadMeta(){ try { return JSON.parse(localStorage.getItem(META_KEY)) || {owner: null, base: {}}; } catch(e){ return {owner: null, base: {}}; } }
function saveMeta(){ try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch(e){} }
function loadRev(){ try { return JSON.parse(localStorage.getItem(REV_KEY)) || []; } catch(e){ return []; } }
function saveRev(list){ try { localStorage.setItem(REV_KEY, JSON.stringify(list.slice(-REV_CAP))); } catch(e){} }

/* JSON with sorted keys, so rows compare equal whatever order the database returns keys in. */
const stable = v => v === undefined ? undefined : JSON.stringify(v, (k, x) =>
  x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(y => [y, x[y]])) : x);
const nz = v => (v === undefined || v === "" ? null : v);
const round2 = x => Math.round(x * 100) / 100;
const iso = t => t ? new Date(t).toISOString() : null;
const builtinDecks = () => allDecks().filter(d => d.builtin);

/* ---------- local state <-> rows ----------
   Row keys: "deck:<id>", "card:<id>", "state:<cardId>", "dset:<deckId>", "settings".
   Rows leave out owner_id / student_id; they're added when sending. */
const cardRow = (c, deckId, position) => ({
  id: c.id, deck_id: deckId, position, kind: c.kind || "recall", topic: nz(c.t),
  question: c.q, answer: c.a, explanation: nz(c.why), source: nz(c.src),
  options: c.opts || null, correct: c.ans || null,
  image_front: nz(c.imgQ), image_back: nz(c.imgA), sound_front: nz(c.sndQ), sound_back: nz(c.sndA),
});
const fromCard = r => {
  const c = {id: r.id, q: r.question, a: r.answer};
  if (r.kind && r.kind !== "recall") c.kind = r.kind;
  for (const [k, f] of [["t","topic"],["why","explanation"],["src","source"],["opts","options"],["ans","correct"],
                        ["imgQ","image_front"],["imgA","image_back"],["sndQ","sound_front"],["sndA","sound_back"]])
    if (r[f] != null && r[f] !== "") c[k] = r[f];
  return c;
};
const deckRow = (d, position, m = {}) => ({id: d.id, name: d.name, color: d.color, description: nz(m.desc), instructions: nz(m.instr), position});
const stateRow = (id, p, flagged) => ({
  card_id: id, phase: (p && p.phase) || "new", step: (p && p.step) || 0, interval_days: Math.round((p && p.ivl) || 0),
  ease: round2(p && p.ease != null ? p.ease : 2.5), due_at: iso(p && p.due), lapses: (p && p.lapses) || 0,
  reps: (p && p.reps) || 0, flagged: !!flagged,
});
const fromState = r => ({phase: r.phase, step: r.step, ivl: r.interval_days, ease: r.ease, due: r.due_at ? Date.parse(r.due_at) : 0, lapses: r.lapses, reps: r.reps});
const settingsRow = o => ({
  gradeMode: o.gradeMode || "two", askConf: o.askConf !== false, meta: o.meta || {}, hist: o.hist || {},
  streak: o.streak || 0, lastDay: o.lastDay || null, total: o.total || 0,
});

/* Server rows in exactly the shape localRows() produces, so the two compare. */
function normalize(key, r){
  if (key.startsWith("card:")) return cardRow(fromCard(r), r.deck_id, r.position);
  if (key.startsWith("deck:")) return deckRow(r, r.position, {desc: r.description, instr: r.instructions});
  if (key.startsWith("state:")) return stateRow(r.card_id, fromState(r), r.flagged);
  if (key.startsWith("dset:")) return {deck_id: r.deck_id, new_per_day: r.new_per_day, shuffle: !!r.shuffle};
  return settingsRow(r || {});
}

function localRows(){
  const rows = {}, known = new Set(), decks = new Set();
  for (const d of builtinDecks()){
    decks.add(d.id); d.cards.forEach(c => known.add(c.id));
    ((S.extra || {})[d.id] || []).forEach((c, i) => { known.add(c.id); rows["card:" + c.id] = cardRow(c, d.id, i); });
  }
  S.decks.forEach((d, i) => {
    decks.add(d.id); rows["deck:" + d.id] = deckRow(d, i, S.meta[d.id]);
    d.cards.forEach((c, j) => { known.add(c.id); rows["card:" + c.id] = cardRow(c, d.id, j); });
  });
  // Schedules for cards that still exist (a deleted card's leftovers would break the upload)
  const ids = new Set([...Object.keys(S.cards), ...Object.keys(S.flags).filter(k => S.flags[k])]);
  for (const id of ids) if (known.has(id)) rows["state:" + id] = stateRow(id, S.cards[id], S.flags[id]);
  for (const [id, k] of Object.entries(S.dk))
    if (decks.has(id) && (k.newLimit !== 20 || k.shuffle))
      rows["dset:" + id] = {deck_id: id, new_per_day: Math.max(0, Math.min(999, k.newLimit ?? 20)), shuffle: !!k.shuffle};
  const builtinMeta = Object.fromEntries(Object.entries(S.meta).filter(([id]) => builtinDecks().some(d => d.id === id)));
  rows.settings = settingsRow({...S, meta: builtinMeta});
  return rows;
}

/* Combine settings field by field: preferences from one side, history from both. */
function mergeSettings(l, r, prefsFrom){
  const p = prefsFrom === "l" ? l : r, hist = {...r.hist};
  for (const [d, n] of Object.entries(l.hist)) hist[d] = Math.max(hist[d] || 0, n);
  const lastDay = [l.lastDay, r.lastDay].filter(Boolean).sort((a, b) => Date.parse(a.replace(/-/g, "/")) - Date.parse(b.replace(/-/g, "/"))).pop() || null;
  return settingsRow({gradeMode: p.gradeMode, askConf: p.askConf, meta: {...r.meta, ...l.meta}, hist,
    streak: Math.max(l.streak, r.streak), lastDay, total: Math.max(l.total, r.total)});
}

/* Three-way merge. Returns the merged rows and where each came from ("l", "r" or "m" for merged). */
function merge(L, B, R, tLocal, tRemote){
  const out = {}, src = {}, firstSync = !Object.keys(B).length;
  for (const k of new Set([...Object.keys(L), ...Object.keys(B), ...Object.keys(R)])){
    const ls = stable(L[k]), bs = stable(B[k]), rs = stable(R[k]);
    let pick;
    if (ls === bs || ls === rs) pick = "r";            // no local change (or the same change)
    else if (rs === bs) pick = "l";                     // no server change
    else if (k === "settings" && L[k] && R[k]) pick = "m";
    else if (k.startsWith("state:")) pick = (tLocal[k.slice(6)] || 0) > (tRemote[k.slice(6)] || 0) ? "l" : "r";
    else pick = "l";
    const v = pick === "m" ? mergeSettings(L[k], R[k], firstSync ? "r" : "l") : pick === "l" ? L[k] : R[k];
    if (v !== undefined){ out[k] = v; src[k] = pick; }
  }
  return {out, src};
}

/* Write merged rows back into S. Device-only fields are left alone. */
function apply(M, src, tRemote){
  const oldCards = S.cards, builtinIds = new Set(builtinDecks().map(d => d.id));
  const decks = [], extra = {}, cardsByDeck = {}, meta = {};
  for (const [k, r] of Object.entries(M)){
    if (k.startsWith("deck:")){
      decks.push({row: r, deck: {id: r.id, name: r.name, color: r.color, cards: []}});
      if (r.description || r.instructions) meta[r.id] = {...(r.description ? {desc: r.description} : {}), ...(r.instructions ? {instr: r.instructions} : {})};
    } else if (k.startsWith("card:")) (cardsByDeck[r.deck_id] ||= []).push(r);
  }
  decks.sort((a, b) => a.row.position - b.row.position);
  const byPos = list => list.sort((a, b) => a.position - b.position).map(fromCard);
  for (const {deck} of decks) deck.cards = byPos(cardsByDeck[deck.id] || []);
  for (const id of builtinIds) if (cardsByDeck[id]) extra[id] = byPos(cardsByDeck[id]);

  const cards = {}, flags = {};
  for (const [k, r] of Object.entries(M)) if (k.startsWith("state:")){
    const id = r.card_id;
    if (r.phase !== "new" || r.reps > 0){
      const t = src[k] === "l" ? (oldCards[id] && oldCards[id].t) : tRemote[id];
      cards[id] = {...fromState(r), ...(t ? {t} : {})};
    }
    if (r.flagged) flags[id] = true;
  }
  const set = M.settings || settingsRow({});
  const dk = {};
  for (const [id, k] of Object.entries(S.dk)) dk[id] = {...k, newLimit: 20, shuffle: false};
  for (const [k, r] of Object.entries(M)) if (k.startsWith("dset:"))
    dk[r.deck_id] = {...(dk[r.deck_id] || {newSeen: 0}), newLimit: r.new_per_day, shuffle: r.shuffle};

  Object.assign(S, {
    decks: decks.map(x => x.deck), extra, cards, flags, dk, meta: {...set.meta, ...meta},
    gradeMode: set.gradeMode, askConf: set.askConf, hist: set.hist, streak: set.streak, lastDay: set.lastDay, total: set.total,
  });
}

/* ---------- talking to Supabase ---------- */
async function run(q){ const {error} = await q; if (error) throw error; }
async function all(makeQuery){
  const out = [];
  for (let from = 0; ; from += PAGE){
    const {data, error} = await makeQuery().range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < PAGE) return out;
  }
}
const chunks = (list, n = CHUNK) => Array.from({length: Math.ceil(list.length / n)}, (_, i) => list.slice(i * n, i * n + n));

async function pull(id){
  const [decks, cards, states, dsets, me] = await Promise.all([
    all(() => supabase.from("decks").select("*").eq("owner_id", id).order("id")),
    all(() => supabase.from("cards").select("*").eq("owner_id", id).order("id")),
    all(() => supabase.from("card_states").select("*").eq("student_id", id).order("card_id")),
    all(() => supabase.from("student_deck_settings").select("*").eq("student_id", id).order("deck_id")),
    supabase.from("students").select("settings").eq("id", id).maybeSingle(),
  ]);
  if (me.error) throw me.error;
  const R = {}, tRemote = {};
  decks.forEach(r => { R["deck:" + r.id] = normalize("deck:", r); });
  cards.forEach(r => { R["card:" + r.id] = normalize("card:", r); });
  states.forEach(r => { R["state:" + r.card_id] = normalize("state:", r); tRemote[r.card_id] = Date.parse(r.updated_at) || 0; });
  dsets.forEach(r => { R["dset:" + r.deck_id] = normalize("dset:", r); });
  // A new account has no settings yet: leave them out so this device's choices are kept
  const raw = (me.data && me.data.settings) || {};
  if (Object.keys(raw).length) R.settings = normalize("settings", raw);
  return {R, tRemote};
}

async function push(){
  if (!sid || !supabase) return;
  if (busy){ again = true; return; }
  busy = true; setStatus("syncing");
  try {
    const L = localRows(), B = meta.base, kind = k => k.slice(0, k.indexOf(":")), key = k => k.slice(k.indexOf(":") + 1);
    const up = {deck: [], card: [], dset: [], state: []}, del = {deck: [], card: [], dset: [], state: []};
    let settings = null;
    for (const [k, v] of Object.entries(L)) if (stable(v) !== stable(B[k])){ if (k === "settings") settings = v; else up[kind(k)].push(v); }
    for (const k of Object.keys(B)) if (!(k in L) && k !== "settings") del[kind(k)].push(key(k));

    // Parents before children: decks, cards, then settings and schedules
    for (const c of chunks(up.deck)) await run(supabase.from("decks").upsert(c.map(r => ({...r, owner_id: sid}))));
    for (const c of chunks(up.card)) await run(supabase.from("cards").upsert(c.map(r => ({...r, owner_id: sid}))));
    for (const c of chunks(up.dset)) await run(supabase.from("student_deck_settings").upsert(c.map(r => ({...r, student_id: sid}))));
    for (const c of chunks(up.state)) await run(supabase.from("card_states").upsert(c.map(r => ({...r, student_id: sid}))));
    if (settings) await run(supabase.from("students").update({settings}).eq("id", sid));
    // Children before parents when deleting
    for (const c of chunks(del.state)) await run(supabase.from("card_states").delete().eq("student_id", sid).in("card_id", c));
    for (const c of chunks(del.dset)) await run(supabase.from("student_deck_settings").delete().eq("student_id", sid).in("deck_id", c));
    for (const c of chunks(del.card)) await run(supabase.from("cards").delete().in("id", c));
    for (const c of chunks(del.deck)) await run(supabase.from("decks").delete().in("id", c));

    meta.base = L; meta.at = Date.now(); saveMeta();
    await flushReviews();
    setStatus("ok");
  } catch(e){
    console.warn("Sync failed; will retry", e);
    setStatus("error", e.message || String(e));
  } finally {
    busy = false;
    if (again){ again = false; schedule(); }
  }
}

async function flushReviews(){
  const pending = loadRev(); if (!pending.length) return;
  // Only answers for cards that still exist (others would be refused by the database)
  const known = new Set(allDecks().flatMap(d => [...d.cards, ...(d.builtin ? (S.extra || {})[d.id] || [] : [])]).map(c => c.id));
  const send = pending.filter(r => known.has(r.card_id));
  for (const c of chunks(send))
    await run(supabase.from("reviews").upsert(c.map(r => ({...r, student_id: sid})), {onConflict: "id", ignoreDuplicates: true}));
  const done = new Set(pending.map(r => r.id));
  saveRev(loadRev().filter(r => !done.has(r.id)));   // keep answers logged while we were sending
}

const schedule = () => { if (!sid) return; clearTimeout(timer); timer = setTimeout(push, 1500); };
setSaveHook(schedule);

/* ---------- public ---------- */
const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)));

/* Log one answer. Queued locally; sent with the next push (or at first sign-in). */
export function logReview({card_id, grade, confidence = null, time_ms = null}){
  const list = loadRev();
  list.push({id: uuid(), card_id, card_version: 1, reviewed_at: new Date(now()).toISOString(), grade,
    confidence, time_ms: time_ms == null ? null : Math.max(0, Math.min(Math.round(time_ms), 36e5))});
  saveRev(list);
}

/* Drop the account's data from this browser, keeping device settings. */
function clearLocal(){
  replaceState(Object.assign(fresh(), {offset: S.offset, cart: S.cart, sample: S.sample, deck: "rn"}));
  try { localStorage.setItem("flick-nclex-v1", JSON.stringify(S)); } catch(e){}
  saveRev([]);
  meta = {owner: null, base: {}}; saveMeta();
}

/* Start syncing for a signed-in student: pull, merge, then upload local changes.
   Returns {uploaded: true} when this device's own progress went up for the first time. */
export async function startSync(studentId){
  if (!supabase) return {};
  clearTimeout(timer); sid = null; wanted = studentId; setStatus("syncing");
  if (meta.owner && meta.owner !== studentId) clearLocal();   // someone else's copy: start from the server
  const firstSync = meta.owner !== studentId;
  try {
    const {R, tRemote} = await pull(studentId);
    if (wanted !== studentId) return {};   // signed out (or switched) while loading
    const L = localRows(), tLocal = Object.fromEntries(Object.entries(S.cards).map(([id, p]) => [id, p.t || 0]));
    const {out, src} = merge(L, firstSync ? {} : meta.base, R, tLocal, tRemote);
    apply(out, src, tRemote);
    meta = {owner: studentId, base: R, at: meta.at}; saveMeta();
    try { localStorage.setItem("flick-nclex-v1", JSON.stringify(S)); } catch(e){}
    sid = studentId;
    const uploaded = firstSync && (Object.values(src).includes("l") || loadRev().length > 0);
    await push();
    return {uploaded};
  } catch(e){
    console.warn("Sync: couldn't load your account's data", e);
    setStatus("error", e.message || String(e));
    sid = null;
    setTimeout(() => { if (wanted === studentId) startSync(studentId); }, 30e3);   // try again later; local copy keeps working
    return {};
  }
}

/* Stop syncing without touching local data (session ended on its own). */
export function stopSync(){ clearTimeout(timer); sid = null; wanted = null; setStatus("off"); }

/* Before signing out: send what's pending. True when everything reached the account. */
export async function flushNow(){
  clearTimeout(timer);
  if (!sid) return status.state !== "error";
  await push();
  return status.state === "ok" && !loadRev().length;
}

/* Explicit sign-out: remove the account's data from this browser. */
export function clearAccountData(){ stopSync(); clearLocal(); }

/* After a failure, or back in a tab after a while, pull and merge before sending,
   so this device doesn't overwrite newer answers made on another one. */
const resync = () => { if (wanted && !busy) startSync(wanted); };
setInterval(() => { if (sid && status.state === "error") resync(); else if (sid && loadRev().length) push(); }, 30e3);
window.addEventListener("online", () => { if (sid && status.state === "error") resync(); else if (sid) push(); });
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (!sid && !wanted) return;
  if (document.visibilityState === "hidden"){ hiddenAt = Date.now(); if (sid) push(); }
  else if (Date.now() - hiddenAt > 60e3) resync();
});
