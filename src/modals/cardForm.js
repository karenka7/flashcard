import { $, esc } from "../dom.js";
import { REC_MAX_S, SND_MAX, dropSounds, putSound, sndUrls } from "../media.js";
import { S, cardsOf, curDeck, filt, ownCards, parseBulk, save, uid } from "../state.js";
import { cardSoundKeys, closeModal, showModal, toast } from "../ui.js";

/* Images picked in the card form, as data URIs, until the card is saved */
let draft = {q:null, a:null};
/* Sounds picked or recorded in the card form: a stored key (kept), a Blob (new), or null */
let draftSnd = {q:null, a:null}, rec = null;
export function stopRec(){ if (rec && rec.mr.state !== "inactive") rec.mr.stop(); }
function drawSndFields(){
  $("#modal").querySelectorAll("[data-sndf]").forEach(el => {
    const side = el.dataset.sndf, v = draftSnd[side], where = side === "q" ? "front" : "back";
    const url = v instanceof Blob ? (v._url ||= URL.createObjectURL(v)) : v ? sndUrls.get(v) : null;
    const recording = rec && rec.side === side;
    el.innerHTML = recording
      ? `<span><span class="rec-dot"></span>Recording… <b data-t>0:00</b></span><button class="btn sm" type="button" data-stoprec>Stop</button>`
      : (url ? `<audio controls preload="metadata" src="${url}"></audio>` : "")
        + `<label class="btn ghost sm upl">${v ? "Replace sound" : "Upload sound"}<input type="file" accept="audio/*" hidden></label>`
        + (navigator.mediaDevices && window.MediaRecorder && !rec ? `<button class="btn ghost sm" type="button" data-rec>● Record</button>` : "")
        + (v ? `<button class="btn ghost sm textred" type="button" data-rm>Remove</button>` : `<span class="note">Optional sound for the ${where}</span>`);
    if (recording){
      el.querySelector("[data-stoprec]").onclick = stopRec;
      const t = el.querySelector("[data-t]"), tick = () => { if (!rec || rec.side !== side) return;
        const sec = Math.floor((Date.now() - rec.t0) / 1000); t.textContent = `${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}`;
        if (sec >= REC_MAX_S) stopRec(); else setTimeout(tick, 250); };
      tick(); return;
    }
    el.querySelector("input").onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      if (!f.type.startsWith("audio/")){ toast("That isn't an audio file. Try MP3, M4A, WAV or OGG."); return; }
      if (f.size > SND_MAX){ toast(`That sound is ${(f.size/1048576).toFixed(1)} MB. Keep sounds under ${SND_MAX/1048576} MB.`); return; }
      draftSnd[side] = f; drawSndFields();
    };
    const rb = el.querySelector("[data-rec]"); if (rb) rb.onclick = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({audio:true}), mr = new MediaRecorder(stream), chunks = [];
        rec = {side, mr, t0:Date.now()};
        mr.ondataavailable = e => e.data.size && chunks.push(e.data);
        mr.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          const b = new Blob(chunks, {type: mr.mimeType || "audio/webm"}); rec = null;
          if (b.size){ draftSnd[side] = b; } drawSndFields();
        };
        mr.start(); drawSndFields();
      } catch(err){ rec = null; toast("Couldn't use the microphone. Check that this site is allowed to use it."); drawSndFields(); }
    };
    const rm = el.querySelector("[data-rm]"); if (rm) rm.onclick = () => { draftSnd[side] = null; drawSndFields(); };
  });
}
/* Store new sounds from the form. Returns {sndQ, sndA, added:[keys]} or throws. */
async function commitSounds(){
  if (rec) throw new Error("Stop the recording first");
  const out = {added:[]};
  for (const side of ["q","a"]){
    const v = draftSnd[side], f = side === "q" ? "sndQ" : "sndA";
    if (v instanceof Blob){ const k = await putSound(v); out[f] = k; out.added.push(k); }
    else out[f] = v || null;
  }
  return out;
}
const SOUND_FAIL = "Couldn't save the sound in this browser (storage may be full or blocked). The card wasn't saved.";
/* Uploaded photos are shrunk to at most 1000px and saved as JPEG so they fit in browser storage */
function shrinkImage(file){
  return new Promise((ok, fail) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1000 / Math.max(im.width, im.height)), cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(im.width * k)); cv.height = Math.max(1, Math.round(im.height * k));
      const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(im, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url); ok(cv.toDataURL("image/jpeg", 0.8));
    };
    im.onerror = () => { URL.revokeObjectURL(url); fail(); };
    im.src = url;
  });
}
function drawImgFields(){
  $("#modal").querySelectorAll("[data-imgf]").forEach(el => {
    const side = el.dataset.imgf, src = draft[side], where = side === "q" ? "front" : "back";
    el.innerHTML = (src ? `<img src="${esc(src)}" alt="Image on the ${where}">` : "")
      + `<label class="btn ghost sm upl">${src ? "Replace image" : "Upload image"}<input type="file" accept="image/*" hidden></label>`
      + (src ? `<button class="btn ghost sm textred" type="button" data-rm>Remove</button>` : `<span class="note">Optional picture for the ${where}</span>`);
    el.querySelector("input").onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { draft[side] = await shrinkImage(f); drawImgFields(); }
      catch(err){ toast("Couldn't read that file. Try a JPG or PNG image."); }
    };
    const rm = el.querySelector("[data-rm]"); if (rm) rm.onclick = () => { draft[side] = null; drawImgFields(); };
  });
}
export const STORAGE_FULL = "This browser's storage is full, so the card wasn't saved. Try a smaller image or remove some images.";
function cardFields(c = {}){
  draft = {q:c.imgQ || null, a:c.imgA || null};
  stopRec(); draftSnd = {q:c.sndQ || null, a:c.sndA || null};
  return `<label class="fl">Front <span>(question)</span><textarea id="cQ" rows="2">${esc(c.q)}</textarea></label>
    <div class="imgf" data-imgf="q"></div>
    <div class="sndf" data-sndf="q"></div>
    <label class="fl">Back <span>(answer)</span><textarea id="cA" rows="2">${esc(c.a)}</textarea></label>
    <div class="imgf" data-imgf="a"></div>
    <div class="sndf" data-sndf="a"></div>
    <label class="fl">Explanation <span>(optional, shown under the answer)</span><textarea id="cW" rows="2">${esc(c.why)}</textarea></label>
    <label class="fl">Source <span>(optional: a textbook, page, lecture or link)</span><input id="cS" maxlength="300" value="${esc(c.src)}" placeholder="e.g. Lewis Med-Surg, ch. 34"></label>`;
}
export function openAddCards(mode = "one"){
  const d = curDeck(), own = ownCards(d);
  showModal(`<h3>Add cards to ${esc(d.name)}</h3>
    <div class="seg"><button data-m="one" class="${mode === "one" ? "on" : ""}">One card</button><button data-m="many" class="${mode === "many" ? "on" : ""}">Paste many</button></div>
    ${mode === "one" ? cardFields() + `<p class="note" style="margin:8px 0 0">${cardsOf(d).length} card${cardsOf(d).length === 1 ? "" : "s"} in this deck${d.builtin ? `, ${own.length} added by you` : ""}. <kbd>Ctrl</kbd>+<kbd>Enter</kbd> adds and starts the next one.</p>`
      : `<label class="fl">Cards<textarea id="cBulk" rows="8" placeholder="One card per line: question | answer | explanation (optional)"></textarea></label>
         <p class="note" style="margin:6px 0 0">Use | or a tab between parts. Tab-separated exports from Quizlet or Anki paste straight in.</p>`}
    <div class="actions"><button class="btn ghost sm" id="mDone">Done</button><button class="btn sm" id="mAdd">${mode === "one" ? "Add card" : "Add cards"}</button></div>`);
  $("#modal").querySelectorAll("[data-m]").forEach(b => b.onclick = () => openAddCards(b.dataset.m));
  $("#mDone").onclick = closeModal;
  if (mode === "one"){
    $("#cQ").focus(); drawImgFields(); drawSndFields();
    const add = async () => {
      const q = $("#cQ").value.trim(), a = $("#cA").value.trim(), why = $("#cW").value.trim();
      const hasQ = q || draft.q || draftSnd.q, hasA = a || draft.a || draftSnd.a;
      if (!hasQ || !hasA){ toast("A card needs a front and a back (text, an image or a sound)"); (hasQ ? $("#cA") : $("#cQ")).focus(); return; }
      const src = $("#cS").value.trim();
      let snd; try { snd = await commitSounds(); } catch(err){ toast(rec ? "Stop the recording first" : SOUND_FAIL); return; }
      own.push({id:uid("u"), q, a, why, ...(src ? {src} : {}), ...(draft.q ? {imgQ:draft.q} : {}), ...(draft.a ? {imgA:draft.a} : {}),
        ...(snd.sndQ ? {sndQ:snd.sndQ} : {}), ...(snd.sndA ? {sndA:snd.sndA} : {})});
      if (!save()){ own.pop(); dropSounds(snd.added); toast(STORAGE_FULL); return; }
      toast(`Card added · ${cardsOf(d).length} in ${d.name}`);
      openAddCards("one");
    };
    $("#mAdd").onclick = add;
    $("#modal").onkeydown = e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)){ e.preventDefault(); add(); } };
  } else {
    $("#cBulk").focus();
    $("#mAdd").onclick = () => {
      const {cards, skipped} = parseBulk($("#cBulk").value);
      if (!cards.length){ toast("No cards found. Use question | answer, one per line."); return; }
      own.push(...cards); if (!save()){ own.splice(own.length - cards.length); toast(STORAGE_FULL); return; } closeModal();
      toast(`Added ${cards.length} card${cards.length === 1 ? "" : "s"}${skipped ? ` · ${skipped} line${skipped === 1 ? "" : "s"} skipped` : ""}`);
    };
  }
}
export function openEditCard(id){
  const d = curDeck(), c = ownCards(d).find(x => x.id === id); if (!c) return;
  showModal(`<h3>Edit card</h3>${cardFields(c)}
    <div class="actions"><button class="btn ghost sm" id="mCancel">Cancel</button><button class="btn sm" id="mSave">Save</button></div>`);
  drawImgFields(); drawSndFields();
  $("#mCancel").onclick = closeModal;
  $("#mSave").onclick = async () => {
    const q = $("#cQ").value.trim(), a = $("#cA").value.trim();
    if ((!q && !draft.q && !draftSnd.q) || (!a && !draft.a && !draftSnd.a)){ toast("A card needs a front and a back (text, an image or a sound)"); return; }
    let snd; try { snd = await commitSounds(); } catch(err){ toast(rec ? "Stop the recording first" : SOUND_FAIL); return; }
    const before = {...c};
    c.q = q; c.a = a; c.why = $("#cW").value.trim();
    const src = $("#cS").value.trim(); if (src) c.src = src; else delete c.src;
    if (draft.q) c.imgQ = draft.q; else delete c.imgQ;
    if (draft.a) c.imgA = draft.a; else delete c.imgA;
    if (snd.sndQ) c.sndQ = snd.sndQ; else delete c.sndQ;
    if (snd.sndA) c.sndA = snd.sndA; else delete c.sndA;
    if (!save()){ Object.keys(c).forEach(k => delete c[k]); Object.assign(c, before); dropSounds(snd.added); toast(STORAGE_FULL); return; }
    dropSounds(cardSoundKeys(before).filter(k => k !== c.sndQ && k !== c.sndA));
    closeModal(); toast("Card saved");
  };
}
export function openDeleteCard(id){
  const d = curDeck(), c = ownCards(d).find(x => x.id === id); if (!c) return;
  showModal(`<h3>Delete this card?</h3><p class="note">“${esc(c.q.length > 120 ? c.q.slice(0,120) + "…" : c.q || (c.imgQ ? "Image card" : "Sound card"))}” and its review history will be removed. This can't be undone.</p>
    <div class="actions"><button class="btn ghost sm" id="mCancel">Cancel</button><button class="btn danger sm" id="mDel">Delete card</button></div>`);
  $("#mCancel").onclick = closeModal;
  $("#mDel").onclick = () => {
    dropSounds(cardSoundKeys(c));
    const own = ownCards(d), i = own.findIndex(x => x.id === id); if (i >= 0) own.splice(i, 1); delete S.cards[id]; delete S.flags[id];
    if (filt.open === id) filt.open = null; save(); closeModal(); toast("Card deleted");
  };
}
