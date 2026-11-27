import { KIND_LABEL, TOPICS } from "../data/nclex.js";
import { $, esc } from "../dom.js";
import { route } from "../router.js";
import { CONF, DAY, MIN, fmt, gotGrade, plan } from "../scheduler.js";
import { S, askConf, buckets, cardsOf, curDeck, dayKey, dk, endOfDay, flaggedIn, newLeft, now, prog, rollDay, save, topicOf } from "../state.js";
import { cardImg, cardSnd, closeModal, srcHtml, toast } from "../ui.js";

/* =========================================================
   STUDY SESSION
   Q    = reviews and new cards, in order
   pend = learning cards; each is shown once its timer is up,
          or early if nothing else is left in the session
   ========================================================= */
let Q = [], pend = [], cur = null, revealed = false, picked = new Set(), conf = null, sess = null;
export const study = $("#study"), sBody = $("#sBody"), sFoot = $("#sFoot");

/* Fisher–Yates shuffle, returns a new array */
const shuffled = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export function startSession(o = {}){
  rollDay();
  const d = curDeck(), mix = !!dk(d.id).shuffle; Q = []; pend = [];
  if (o.flagged){ Q = mix ? shuffled(flaggedIn(d)) : flaggedIn(d).slice(); }
  else {
    const b = buckets(d, o.topic);
    const nNew = o.topic ? Math.min(b.fresh.length, Math.max(newLeft(d), 5)) : Math.min(newLeft(d), b.fresh.length);
    // Shuffle on: today's new cards are picked at random from the unseen ones, and reviews come in random order.
    // Learning cards always come back by their timer.
    const reviews = mix ? shuffled(b.review) : b.review, news = (mix ? shuffled(b.fresh) : b.fresh).slice(0, nNew);
    pend = b.learning.slice();
    // Interleave: one new card after every two reviews
    let i = 0, j = 0;
    while (i < reviews.length || j < news.length){
      if (i < reviews.length) Q.push(reviews[i++]);
      if (i < reviews.length) Q.push(reviews[i++]);
      if (j < news.length) Q.push(news[j++]);
    }
  }
  if (!Q.length && !pend.length){ toast(o.flagged ? "No flagged cards in this deck." : "Nothing due here right now."); return; }
  sess = {done:0, grades:[0,0,0,0], topic:o.topic, flagged:!!o.flagged, ids:new Set(), confWrong:0, deck:d};
  study.hidden = false; document.body.style.overflow = "hidden";
  next();
}

let waitTimer = null, waiting = false;
function next(force){
  clearInterval(waitTimer); waiting = false;
  const t = now(); let c = null;
  pend.sort((x,y) => prog(x.id).due - prog(y.id).due);
  if (pend.length && prog(pend[0].id).due <= t) c = pend.shift();
  else if (Q.length) c = Q.shift();
  else if (pend.length){ if (force) c = pend.shift(); else return drawWait(); }
  if (!c) return finish();
  cur = c; revealed = false; picked = new Set(); conf = null; frontOpen = false;
  drawCard();
}
/* Only learning cards are left and none is due yet: show a short wait instead of repeating a card immediately */
function drawWait(){
  cur = null; waiting = true;
  const k = counts(), pct = Math.round(100*sess.done/(sess.done + pend.length));
  $("#sBar").style.width = pct + "%";
  $("#sLeft").innerHTML = `<span class="cn"><span class="dot" style="background:#dc2626;width:8px;height:8px"></span><b>${k.l}</b><span class="w">learning</span></span>`;
  sBody.innerHTML = `<div class="done">
    <div class="check" style="background:var(--indigo-50);color:var(--indigo)"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div>
    <h1>Caught up for now</h1>
    <p class="sub" style="margin:0 0 6px">${pend.length} learning card${pend.length === 1 ? "" : "s"} come${pend.length === 1 ? "s" : ""} back in <b id="wTime" style="color:var(--ink)"></b>.</p>
    <p class="note" style="margin:0 0 10px">A few minutes' gap is what makes it stick. Wait here (the next card opens on its own), review early, or finish now: they stay in today's count.</p>
  </div>`;
  sFoot.innerHTML = `<div class="btn-row" style="justify-content:center"><button class="btn ghost" id="wNow">Review now <kbd>Space</kbd></button><button class="btn" id="wEnd">Finish for now</button></div>`;
  $("#wNow").onclick = () => next(true);
  $("#wEnd").onclick = () => { waiting = false; clearInterval(waitTimer); finish(); };
  const tick = () => {
    const ms = prog(pend[0].id).due - now();
    if (ms <= 0) return next();
    const s = Math.ceil(ms/1000); $("#wTime").textContent = Math.floor(s/60) + ":" + String(s%60).padStart(2,"0");
  };
  tick(); waitTimer = setInterval(tick, 1000);
}

function counts(){
  let n = 0, l = 0, r = 0;
  for (const c of [cur, ...Q, ...pend]){ if (!c) continue; const p = prog(c.id).phase; if (p === "new") n++; else if (p === "review") r++; else l++; }
  return {n, l, r};
}

function drawCard(){
  const c = cur, d = sess.deck, kind = c.kind || "recall", t = topicOf(c, d), two = S.gradeMode === "two";
  const left = Q.length + pend.length + 1, pct = Math.round(100*sess.done/(sess.done + left));
  const k = counts();
  $("#sBar").style.width = pct + "%";
  $("#sLeft").innerHTML = `<span class="cn" title="New"><span class="dot" style="background:#4f46e5;width:8px;height:8px"></span><b>${k.n}</b><span class="w">new</span></span>
    <span class="cn" title="Learning"><span class="dot" style="background:#dc2626;width:8px;height:8px"></span><b>${k.l}</b><span class="w">learning</span></span>
    <span class="cn" title="Review"><span class="dot" style="background:#16a34a;width:8px;height:8px"></span><b>${k.r}</b><span class="w">review</span></span>`;

  const ph = prog(c.id).phase;
  const phaseTag = ph === "new" ? "New card" : ph === "review" ? "Review" : "Learning · seen today";
  let verdict = "", right = null;
  if (revealed && c.opts && picked.size){
    right = picked.size === c.ans.length && c.ans.every(i => picked.has(i));
    verdict = `<span class="verdict ${right ? "y" : "n"}">${right ? "Correct" : "Not quite"}</span>`;
  }
  if (revealed && two && conf !== null) verdict += `<span class="verdict c">Confidence: ${CONF[conf].l}</span>`;
  const opts = c.opts ? `<ul class="opts">${c.opts.map((o,i) => {
    let cls = "";
    if (revealed){ if (c.ans.includes(i)) cls = "ok"; else if (picked.has(i)) cls = "bad"; }
    else if (picked.has(i)) cls = "picked";
    return `<li><button class="opt ${cls}" data-opt="${i}" ${revealed ? "disabled" : ""}><span class="lt">${"ABCDE"[i]}</span><span>${esc(o)}</span></button></li>`;
  }).join("")}</ul>` : "";

  // The front: question, front image and sound, and (before the answer) the options to pick from.
  // Once the card is turned over only the back shows; "Show front" brings the question back.
  const front = `<div class="q">${esc(c.q)}</div>
    ${cardImg(c.imgQ, "Image for this question")}
    ${cardSnd(c.sndQ, "Sound for this question")}
    ${revealed ? "" : opts}`;
  sBody.innerHTML = `<div class="card">
    <div class="c-meta">
      <span class="tag"><span class="dot" style="background:${t.color};width:8px;height:8px"></span>${esc(t.name)}</span>
      <span class="tag kind">${KIND_LABEL[kind]}</span>
      <span class="tag phase">${phaseTag}</span>
      <button class="flag ${S.flags[c.id] ? "on" : ""}" id="flagBtn" title="Save this card to your Flagged list (F)">⚑ ${S.flags[c.id] ? "Flagged" : "Flag"}</button>
    </div>
    ${!revealed ? front
      : `<button class="showfront" id="showFront" aria-expanded="${frontOpen}">${frontOpen ? "Hide front ▴" : "Show front ▾"}</button>
         ${frontOpen ? `<div class="front-peek">${front}</div>` : ""}
         ${opts}`}
    ${revealed ? `<div class="answer back">${verdict ? `<div>${verdict}</div>` : ""}
      <div class="a-lbl">Answer</div><div class="a">${esc(c.a)}</div>${cardImg(c.imgA, "Image for this answer")}
      ${cardSnd(c.sndA, "Sound for this answer")}
      ${c.sndQ && !c.sndA && !frontOpen ? cardSnd(c.sndQ, "Sound from the front of this card") : ""}
      ${c.why ? `<div class="why"><b>Why: </b>${esc(c.why)}</div>` : ""}
      ${c.src ? `<div class="src">Source: ${srcHtml(c.src)}</div>` : ""}</div>` : ""}
  </div>`;

  const s = prog(c.id);
  if (!revealed && two && askConf()){
    sFoot.innerHTML = `<div class="foot-in"><div class="foot-q">${c.opts && !picked.size ? "Pick your answer, then: how sure are you?" : "How sure are you?"}</div>
      <div class="conf-row">${CONF.map((x,i) => `<button class="cb" data-c="${i}"><span class="cl">${x.l}</span><span class="ci">${x.i}</span><kbd>${i+1}</kbd></button>`).join("")}</div>
      <button class="foot-skip" id="skipConf">Just show the answer</button></div>`;
    sFoot.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { conf = +b.dataset.c; reveal(); });
    $("#skipConf").onclick = reveal;
  } else if (!revealed){
    sFoot.innerHTML = `<button class="btn reveal" id="revealBtn">${c.opts && picked.size ? "Check answer" : "Show answer"} <kbd style="background:transparent;color:#c7d2fe;border-color:#818cf8">Space</kbd></button>`;
    $("#revealBtn").onclick = reveal;
  } else if (two){
    const gg = gotGrade(conf);
    sFoot.innerHTML = `<div class="grades two">
      <button class="g again ${right === false ? "sug" : ""}" data-g="0"><span class="gl">Missed it</span><span class="gi">Again in ${fmt(plan(s,0).ms)}</span><kbd>1</kbd></button>
      <button class="g good ${right === true ? "sug" : ""}" data-g="${gg}"><span class="gl">Got it</span><span class="gi">Next in ${fmt(plan(s,gg).ms)}</span><kbd>2</kbd></button></div>`;
    sFoot.querySelectorAll("[data-g]").forEach(b => b.onclick = () => grade(+b.dataset.g));
  } else {
    const names = ["Again","Hard","Good","Easy"], cls = ["again","hard","good","easy"];
    sFoot.innerHTML = `<div class="grades">${names.map((n,g) =>
      `<button class="g ${cls[g]}" data-g="${g}"><span class="gl">${n}</span><span class="gi">${fmt(plan(s,g).ms)}</span><kbd>${g+1}</kbd></button>`).join("")}</div>`;
    sFoot.querySelectorAll("[data-g]").forEach(b => b.onclick = () => grade(+b.dataset.g));
  }
  sBody.querySelectorAll("[data-opt]").forEach(b => b.onclick = () => {
    const i = +b.dataset.opt;
    if (c.kind === "mc"){ picked = picked.has(i) ? new Set() : new Set([i]); }
    else picked.has(i) ? picked.delete(i) : picked.add(i);
    drawCard();
  });
  $("#flagBtn").onclick = toggleFlag;
  const sf = $("#showFront"); if (sf) sf.onclick = () => { frontOpen = !frontOpen; drawCard(); };
  sBody.scrollTop = 0;
}

/* Showing the answer turns the card over: it rotates to edge-on, the back is drawn, then it
   rotates back to face you. Skipped for people who ask their system for reduced motion. */
let flipping = false, frontOpen = false;
function reveal(){
  if (revealed || flipping) return;
  const card = sBody.querySelector(".card");
  if (!card || matchMedia("(prefers-reduced-motion: reduce)").matches){ revealed = true; drawCard(); return; }
  flipping = true;
  card.classList.add("flip-out");
  setTimeout(() => {
    flipping = false;
    if (study.hidden || sBody.querySelector(".card") !== card) return;   // session closed or card changed meanwhile
    revealed = true; drawCard();
    const back = sBody.querySelector(".card"); back.classList.add("flip-in");
    back.addEventListener("animationend", () => back.classList.remove("flip-in"), {once:true});
  }, 170);
}
function toggleFlag(){
  if (S.flags[cur.id]) delete S.flags[cur.id]; else S.flags[cur.id] = true;
  save(); drawCard(); toast(S.flags[cur.id] ? "Flagged · find it under Today → Flagged, or Cards → ⚑ Flagged" : "Flag removed");
}

function grade(g){
  if (!revealed) return;
  rollDay();
  const d = sess.deck, s0 = prog(cur.id), wasNew = s0.phase === "new";
  const {ms, s} = plan(s0, g);
  s.due = now() + ms; s.reps = (s.reps || 0) + 1;
  S.cards[cur.id] = s;
  if (wasNew) dk(d.id).newSeen++;
  S.today.reviewed++; S.total = (S.total || 0) + 1;
  S.hist[S.day] = (S.hist[S.day] || 0) + 1;
  if (g >= 2 || (S.gradeMode === "two" && g >= 1)) S.today.good++;
  if (S.gradeMode === "two" && g === 0 && conf === 2) sess.confWrong++;
  if (S.lastDay !== S.day){ S.streak = S.lastDay === dayKey(now() - DAY) ? (S.streak || 0) + 1 : 1; S.lastDay = S.day; }
  sess.done++; sess.grades[g]++; sess.ids.add(cur.id);
  // Short intervals come back in this same session, once their timer is up
  if (ms <= 20*MIN) pend.push(cur);
  save(); next();
}

function finish(){
  const d = sess.deck;
  $("#sBar").style.width = "100%"; $("#sLeft").textContent = "Done";
  const n = sess.done, good = S.gradeMode === "two" ? n - sess.grades[0] : sess.grades[2] + sess.grades[3];
  const tomorrow = cardsOf(d).filter(c => { const s = prog(c.id); return s.phase !== "new" && s.due > endOfDay() && s.due <= endOfDay(now() + DAY); }).length;
  sBody.innerHTML = `<div class="done">
    <div class="check"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
    <h1>Session complete</h1>
    <p class="sub" style="margin:0">${esc(d.name)}${sess.flagged ? " · Flagged cards" : sess.topic ? " · " + TOPICS[sess.topic].name : ""}. Nice work. Your next reviews are scheduled.</p>
    <div class="done-stats">
      <div><b>${sess.ids.size}</b><span>cards</span></div>
      <div><b>${n ? Math.round(100*good/n) : 0}%</b><span>${S.gradeMode === "two" ? "Got it" : "Good or Easy"}</span></div>
      <div><b>${tomorrow}</b><span>due tomorrow</span></div>
    </div>
    ${sess.confWrong ? `<p class="note" style="margin:0 0 20px">You were <b>highly confident but missed ${sess.confWrong}</b> card${sess.confWrong === 1 ? "" : "s"}. Those are the ones most worth flagging and rereading.</p>` : `<div style="height:10px"></div>`}
  </div>`;
  sFoot.innerHTML = `<button class="btn" id="homeBtn">Back to Today</button>`;
  $("#homeBtn").onclick = closeStudy;
  cur = null;
}

function closeStudy(){
  clearInterval(waitTimer); waiting = false;
  study.hidden = true; document.body.style.overflow = ""; sess = null; cur = null;
  if (location.hash !== "#today" && location.hash !== "") location.hash = "#today"; else route();
}

document.addEventListener("keydown", e => {
  if (!$("#modal").hidden){ if (e.key === "Escape") closeModal(); return; }
  if (study.hidden || !sess) return;
  if (e.key === "Escape"){ closeStudy(); return; }
  if (waiting){ if (e.key === " " || e.key === "Enter"){ e.preventDefault(); next(true); } return; }
  if (!cur) { if (e.key === "Enter" || e.key === " "){ e.preventDefault(); closeStudy(); } return; }
  if (e.repeat) return;
  const two = S.gradeMode === "two";
  if (e.key === " " || e.key === "Enter"){ e.preventDefault(); reveal(); return; }
  if (e.key === "f" || e.key === "F"){ toggleFlag(); return; }
  if (e.key === "p" || e.key === "P"){
    const a = [...sBody.querySelectorAll("audio")].pop(); if (a){ if (a.paused){ a.currentTime = 0; a.play(); } else a.pause(); } return;
  }
  if (!revealed && cur.opts && /^[a-e]$/i.test(e.key)){
    const btn = sBody.querySelector(`[data-opt="${"abcde".indexOf(e.key.toLowerCase())}"]`); btn && btn.click(); return;
  }
  if (!revealed && askConf() && ["1","2","3"].includes(e.key)){ conf = +e.key - 1; reveal(); return; }
  if (revealed && two){
    if (e.key === "1") grade(0);
    else if (e.key === "2") grade(gotGrade(conf));
    return;
  }
  if (revealed && ["1","2","3","4"].includes(e.key)) grade(+e.key - 1);
});
$("#closeStudy").onclick = closeStudy;
