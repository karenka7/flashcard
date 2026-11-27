import { $, app, esc } from "../dom.js";
import { openDeleteCard, openEditCard } from "../modals/cardForm.js";
import { S, cardsOf, curDeck, filt, flaggedIn, isOwnCard, save, statusOf, topicOf } from "../state.js";
import { bindDeckBar, cardImg, cardSnd, deckBar, deckDesc, deckInstr, srcHtml } from "../ui.js";
import { startSession } from "./study.js";
import { bindDeckActions } from "./today.js";

export function viewCards(){
  const d = curDeck(), nFlag = flaggedIn(d).length;
  if (filt.topic !== "all" && filt.topic !== "flag" && !(d.topics && d.topics[filt.topic])) filt.topic = "all";
  const chips = [["all","All"], ...(d.topics ? Object.entries(d.topics).map(([k,t]) => [k,t.name]) : []), ["flag",`⚑ Flagged${nFlag ? ` (${nFlag})` : ""}`]]
    .map(([k,n]) => `<button class="chip ${filt.topic === k ? "on" : ""}" data-chip="${k}">${n}</button>`).join("");
  app.innerHTML = `
    <div class="head-row">
      <div><h1>Cards</h1>
        <p class="sub" style="margin-bottom:2px">${esc(d.name)} · ${esc(deckDesc(d))}</p>
        <p class="sub">${esc(deckInstr(d))}</p></div>
      <div class="btn-row"><button class="btn sm" data-addcards>+ Add cards</button><button class="btn ghost sm" data-aimaker>✨ Make cards with AI</button><button class="btn ghost sm" data-editmeta>Edit description</button>${d.builtin ? "" : `<button class="btn ghost sm" data-rename>Rename</button><button class="btn ghost sm textred" data-deldeck>Delete deck</button>`}</div>
    </div>
    ${deckBar(d)}
    <div class="toolbar"><input class="search" id="q" placeholder="Search questions and answers…" value="${esc(filt.q)}"></div>
    <div class="chips">${chips}</div>
    ${filt.topic === "flag" && nFlag ? `<div class="btn-row" style="margin:-6px 0 14px"><button class="btn sm" id="studyFlag">Review ${nFlag} flagged card${nFlag === 1 ? "" : "s"}</button></div>` : ""}
    <section class="panel pad" id="list"></section>`;
  const q = $("#q");
  q.oninput = () => { filt.q = q.value; drawList(); };
  app.querySelectorAll("[data-chip]").forEach(b => b.onclick = () => { filt.topic = b.dataset.chip; filt.open = null; viewCards(); });
  $("#studyFlag") && ($("#studyFlag").onclick = () => startSession({flagged:true}));
  bindDeckBar(); bindDeckActions();
  drawList();
}
function drawList(){
  const d = curDeck(), term = filt.q.trim().toLowerCase();
  const rows = cardsOf(d).filter(c =>
    (filt.topic === "all" || (filt.topic === "flag" ? S.flags[c.id] : c.t === filt.topic)) &&
    (!term || (c.q + " " + c.a + " " + (c.why||"") + " " + (c.src||"") + " " + (c.opts||[]).join(" ")).toLowerCase().includes(term)));
  const list = $("#list");
  if (!rows.length){
    list.innerHTML = `<div class="empty">${filt.topic === "flag" ? "No flagged cards. Tap ⚑ Flag on any card during a session (or press F) to save it here."
      : !cardsOf(d).length ? `This deck has no cards yet.<div style="margin-top:12px"><button class="btn sm" data-addcards>+ Add cards</button></div>` : "No cards match."}</div>`;
    bindDeckActions(); return;
  }
  list.innerHTML = `<div class="note" style="margin-bottom:6px">${rows.length} card${rows.length === 1 ? "" : "s"}</div>` + rows.map(c => {
    const st = statusOf(c), open = filt.open === c.id, t = topicOf(c, d);
    return `<div class="row" data-row="${c.id}">
      <div class="row-top"><span class="dot" style="background:${t.color}"></span>
        <div class="rq">${esc(c.q) || (c.imgQ ? "(image only)" : "(sound only)")}</div>
        ${c.imgQ || c.imgA ? `<span class="imgtag">Image</span>` : ""}
        ${c.sndQ || c.sndA ? `<span class="imgtag">Sound</span>` : ""}
        ${S.flags[c.id] ? `<span class="flagmark">⚑</span>` : ""}
        <span class="status ${st.cls}">${st.txt}</span></div>
      ${open ? `<div class="row-body" data-stop>
        ${cardImg(c.imgQ, "Front image")}${cardSnd(c.sndQ, "Front sound")}
        ${c.opts ? `<ol type="A">${c.opts.map((o,i) => `<li class="${c.ans.includes(i) ? "ok" : ""}">${esc(o)}${c.ans.includes(i) ? " ✓" : ""}</li>`).join("")}</ol>` : ""}
        <div class="ans">${esc(c.a)}</div>${cardImg(c.imgA, "Back image")}${cardSnd(c.sndA, "Back sound")}${c.why ? `<div class="why">${esc(c.why)}</div>` : ""}
        ${c.src ? `<div class="src">Source: ${srcHtml(c.src)}</div>` : ""}
        <div class="btn-row">
          <button class="btn ghost sm" data-flagrow="${c.id}">${S.flags[c.id] ? "Remove flag" : "⚑ Flag"}</button>
          ${!isOwnCard(c, d) ? "" : `<button class="btn ghost sm" data-edit="${c.id}">Edit</button><button class="btn ghost sm textred" data-del="${c.id}">Delete</button>`}
        </div></div>` : ""}
    </div>`;
  }).join("");
  list.querySelectorAll("[data-row]").forEach(r => r.onclick = e => {
    if (e.target.closest("[data-stop]")) return;
    filt.open = filt.open === r.dataset.row ? null : r.dataset.row; drawList();
  });
  list.querySelectorAll("[data-flagrow]").forEach(b => b.onclick = () => {
    const id = b.dataset.flagrow; if (S.flags[id]) delete S.flags[id]; else S.flags[id] = true; save();
    if (filt.topic === "flag") viewCards(); else drawList();
  });
  list.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openEditCard(b.dataset.edit));
  list.querySelectorAll("[data-del]").forEach(b => b.onclick = () => openDeleteCard(b.dataset.del));
}
