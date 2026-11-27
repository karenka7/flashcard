import { ANAT } from "./data/anatomy.js";
import { MUSIC } from "./data/music.js";
import { RN } from "./data/nclex.js";
import { fmt } from "./scheduler.js";

const KEY = "flick-nclex-v1";
export const PALETTE = ["#0891b2","#db2777","#16a34a","#ea580c","#7c3aed","#ca8a04","#475569","#0d9488"];

/* =========================================================
   STATE — saved in localStorage (per browser). In the real app
   this moves to a backend database.
   v2 adds user decks, per-deck daily new-card limits and the
   grading style. v1 progress is carried over.
   ========================================================= */
export const fresh = () => ({v:2, cards:{}, flags:{}, offset:0, day:null,
  today:{reviewed:0,good:0}, streak:0, lastDay:null, total:0,
  deck:"rn", decks:[], dk:{}, gradeMode:"two",
  meta:{},   // per-deck text edited on the Cards page: {desc, instr}
  hist:{},   // cards studied per day (all decks), keyed by dayKey; feeds the heatmap
  cart:{},   // merch demo cart: {productId: qty}
  sample:null}); // made-up daily counts so the heatmap has colour in demos; null = not seeded yet, {} = removed
export const S = load() || fresh();
/* Sample heatmap activity: invented counts from the 1st of last month up to yesterday.
   Kept apart from S.hist (real counts) so it can be removed in Settings without touching real history. */
export function makeSample(){
  const t = new Date(Date.now()), out = {}; let seed = 20261116;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let d = new Date(t.getFullYear(), t.getMonth() - 1, 1); d < new Date(t.getFullYear(), t.getMonth(), t.getDate()); d.setDate(d.getDate() + 1)){
    const wk = d.getDay() === 0 || d.getDay() === 6, r = rnd(), size = rnd();
    if (r < (wk ? 0.45 : 0.18)) continue;                       // rest days, more often at weekends
    out[d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate()] = Math.round(4 + size * size * (wk ? 35 : 62));
  }
  return out;
}
if (!S.sample){ S.sample = makeSample(); }
function load(){
  try {
    const r = localStorage.getItem(KEY); if (!r) return null;
    const o = JSON.parse(r), s = Object.assign(fresh(), o);
    if ((o.v || 1) < 2){
      s.dk = {rn:{newLimit: o.newLimit ?? 20, newSeen: (o.today && o.today.newSeen) || 0}};
      delete s.newLimit; s.v = 2;
    }
    s.today = Object.assign({reviewed:0,good:0}, s.today);
    if (!Array.isArray(s.decks)) s.decks = [];
    // History started with the heatmap: carry over the one day we already have a count for
    if (!o.hist && s.day && s.today.reviewed) s.hist[s.day] = s.today.reviewed;
    return s;
  } catch(e){ return null; }
}
/* sync.js registers here to hear about every save (kept as a hook so state.js doesn't import it). */
let saveHook = null;
export const setSaveHook = fn => { saveHook = fn; };
export function save(){
  let ok;
  try { localStorage.setItem(KEY, JSON.stringify(S)); ok = true; } catch(e){ ok = false; }
  if (saveHook) saveHook();
  return ok;
}

export const now = () => Date.now() + (S.offset || 0);
export const dayKey = t => { const d = new Date(t); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); };
export const endOfDay = (t = now()) => { const d = new Date(t); d.setHours(23,59,59,999); return d.getTime(); };
export function rollDay(){
  const k = dayKey(now());
  if (S.day !== k){ S.day = k; S.today = {reviewed:0,good:0}; Object.values(S.dk).forEach(x => x.newSeen = 0); save(); }
}
export const prog = id => S.cards[id] || {phase:"new", step:0, ivl:0, ease:2.5, due:0, lapses:0, reps:0};
export const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2,6);

/* ---------- decks ---------- */
export const allDecks = () => [RN, ANAT, MUSIC, ...S.decks];
export function curDeck(){ const d = allDecks().find(x => x.id === S.deck); if (!d){ S.deck = "rn"; return RN; } return d; }
/* Cards a person adds to a built-in deck are stored in S.extra[deckId];
   for their own decks they live in the deck itself. */
export const ownCards = d => d.builtin ? ((S.extra ||= {})[d.id] ||= []) : d.cards;
export const cardsOf = d => d.builtin ? [...d.cards, ...ownCards(d)] : d.cards;
export const isOwnCard = (c, d) => ownCards(d).includes(c);
export const dk = id => (S.dk[id] ||= {newLimit:20, newSeen:0});
export const topicOf = (c, d) => (d.topics && c.t && d.topics[c.t]) || {name:d.name, color:d.color};
export const flaggedIn = d => cardsOf(d).filter(c => S.flags[c.id]);
/* Two-step grading can skip the "How sure are you?" step (Settings). Then Got it counts as Good. */
export const askConf = () => S.gradeMode === "two" && S.askConf !== false;

export function buckets(d, topic){
  const eod = endOfDay(), b = {learning:[], review:[], fresh:[]};
  for (const c of cardsOf(d)){
    if (topic && c.t !== topic) continue;
    const s = prog(c.id);
    if (s.phase === "new") b.fresh.push(c);
    else if (s.due <= eod) (s.phase === "review" ? b.review : b.learning).push(c);
  }
  const byDue = (x,y) => prog(x.id).due - prog(y.id).due;
  b.learning.sort(byDue); b.review.sort(byDue);
  return b;
}
export const newLeft = d => Math.max(0, dk(d.id).newLimit - dk(d.id).newSeen);
export function dueToday(d, topic){
  const b = buckets(d, topic), n = Math.min(newLeft(d), b.fresh.length);
  return {learning:b.learning.length, review:b.review.length, newc:n, total:b.learning.length + b.review.length + n, freshAll:b.fresh.length};
}
export function statusOf(c){
  const s = prog(c.id);
  if (s.phase === "new") return {txt:"New", cls:""};
  if (s.phase !== "review") return {txt:"Learning", cls:"learn"};
  if (s.due <= endOfDay()) return {txt:"Due today", cls:"due"};
  return {txt:"In " + fmt(s.due - now()), cls:"rev"};
}

/* Parse pasted cards: one per line, "question | answer | explanation" or tab-separated */
export function parseBulk(text){
  const cards = []; let skipped = 0;
  for (const raw of String(text).split(/\r?\n/)){
    const line = raw.trim(); if (!line) continue;
    const parts = (line.includes("\t") ? line.split("\t") : line.split("|")).map(x => x.trim());
    if (parts.length < 2 || !parts[0] || !parts[1]){ skipped++; continue; }
    cards.push({id:uid("u"), q:parts[0], a:parts[1], why:parts.slice(2).filter(Boolean).join(" ")});
  }
  return {cards, skipped};
}
/* Shared filters for the Cards page; reset in place so importers keep the same object. */
export const filt = {q:"", topic:"all", open:null};
export const resetFilt = () => Object.assign(filt, {q:"", topic:"all", open:null});
/* Replace the whole state in place (Reset progress), so every module keeps the same S. */
export function replaceState(next){ for (const k of Object.keys(S)) delete S[k]; Object.assign(S, next); }
