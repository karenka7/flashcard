import { uid } from "./state.js";

/* =========================================================
   SOUNDS — audio on the front (sndQ) or back (sndA) of a card.
   Audio is too big for localStorage, so the card only stores a
   key; the audio itself lives in IndexedDB ("flick-media"). In
   the real app this becomes a file in S3 / Supabase Storage and
   the key becomes its path.
   ========================================================= */
export const SND_MAX = 3 * 1024 * 1024, REC_MAX_S = 60;
export const sndUrls = new Map();   // key -> object URL, filled at start-up
let mediaDb = null;
function openMedia(){
  return new Promise((ok, fail) => {
    if (!window.indexedDB) return fail(new Error("no indexedDB"));
    const r = indexedDB.open("flick-media", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("sounds");
    r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error);
  });
}
function mediaTx(mode, fn){
  return new Promise((ok, fail) => {
    if (!mediaDb) return fail(new Error("media storage unavailable"));
    const tx = mediaDb.transaction("sounds", mode), st = tx.objectStore("sounds"), out = fn(st);
    tx.oncomplete = () => ok(out && out.result); tx.onerror = tx.onabort = () => fail(tx.error);
  });
}
export async function putSound(blob){
  const key = uid("snd");
  await mediaTx("readwrite", st => st.put(blob, key));
  sndUrls.set(key, URL.createObjectURL(blob));
  return key;
}
export function dropSounds(keys){
  keys = keys.filter(Boolean); if (!keys.length || !mediaDb) return;
  keys.forEach(k => { const u = sndUrls.get(k); if (u) URL.revokeObjectURL(u); sndUrls.delete(k); });
  mediaTx("readwrite", st => keys.forEach(k => st.delete(k))).catch(() => {});
}
export async function loadSounds(){
  try {
    mediaDb = await openMedia();
    await new Promise((ok, fail) => {
      const r = mediaDb.transaction("sounds").objectStore("sounds").openCursor();
      r.onsuccess = () => { const c = r.result; if (!c) return ok(); sndUrls.set(c.key, URL.createObjectURL(c.value)); c.continue(); };
      r.onerror = () => fail(r.error);
    });
  } catch(e){ mediaDb = mediaDb || null; }
}

/* Built-in note sounds: a short piano-like tone (a few harmonics that fade),
   made once per note as a WAV and cached as an object URL. */
const NOTE_HZ = {C:261.63, D:293.66, E:329.63, F:349.23, G:392.00, A:440.00, B:493.88};
function toneUrl(notes){ // "C4" or a chord such as "C4+E4"
  const hzs = notes.split("+").map(n => NOTE_HZ[n[0]] * Math.pow(2, +n.slice(1) - 4)), rate = 22050, len = Math.round(rate * 1.6), mix = 1 / hzs.length;
  const amps = [1, .45, .25, .12, .06, .03], buf = new ArrayBuffer(44 + len*2), v = new DataView(buf);
  const str = (o, t) => [...t].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0,"RIFF"); v.setUint32(4, 36 + len*2, true); str(8,"WAVEfmt "); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,rate,true); v.setUint32(28,rate*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true); str(36,"data"); v.setUint32(40,len*2,true);
  for (let i = 0; i < len; i++){
    const t = i / rate, att = Math.min(1, t / .006), rel = Math.min(1, (len - i) / (rate * .05));
    let x = 0; hzs.forEach(hz => amps.forEach((a, k) => { x += a * Math.exp(-t * (2.2 + k*1.3)) * Math.sin(2*Math.PI*hz*(k+1)*t); })); x *= mix;
    v.setInt16(44 + i*2, Math.max(-1, Math.min(1, x * .45 * att * rel)) * 32767, true);
  }
  return URL.createObjectURL(new Blob([buf], {type:"audio/wav"}));
}
export function sndUrl(key){
  if (!sndUrls.has(key) && /^tone:[A-G][0-8](\+[A-G][0-8])*$/.test(key)) sndUrls.set(key, toneUrl(key.slice(5)));
  return sndUrls.get(key);
}
