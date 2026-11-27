import { $, app, esc } from "../dom.js";
import { openAiMaker } from "../modals/aiMaker.js";
import { openAddCards } from "../modals/cardForm.js";
import { openDeleteDeck, openEditMeta, openRename } from "../modals/decks.js";
import { S, askConf, buckets, cardsOf, curDeck, dayKey, dk, dueToday, endOfDay, filt, flaggedIn, now, prog, save } from "../state.js";
import { bindDeckBar, deckBar, deckDesc, greet, toast } from "../ui.js";
import { startSession } from "./study.js";

/* Heatmap: one calendar month of S.hist; hmOff is -1, 0 or +1 months from the current month */
let hmOff = 0;
const hmLevel = v => !v ? 0 : v < 10 ? 1 : v < 25 ? 2 : v < 50 ? 3 : 4;
function heatmap(){
  const t = new Date(now()), first = new Date(t.getFullYear(), t.getMonth() + hmOff, 1);
  const y = first.getFullYear(), m = first.getMonth(), days = new Date(y, m + 1, 0).getDate();
  const todayK = dayKey(now()), eod = endOfDay();
  let total = 0, cells = "<span></span>".repeat(first.getDay());
  for (let n = 1; n <= days; n++){
    const k = y + "-" + (m + 1) + "-" + n, v = (S.hist[k] || 0) + (S.sample[k] || 0), fut = new Date(y, m, n).getTime() > eod;
    const lbl = new Date(y, m, n).toLocaleDateString(undefined, {month:"short", day:"numeric"});
    total += v;
    cells += `<span class="hm-c ${fut ? "fut" : "l" + hmLevel(v)} ${k === todayK ? "today" : ""}" title="${lbl}: ${fut ? "upcoming" : v + (v === 1 ? " card" : " cards") + " studied"}">${n}</span>`;
  }
  return `<div class="hm">
    <div class="hm-head">
      <button id="hmPrev" aria-label="Previous month" ${hmOff <= -1 ? "disabled" : ""}>‹</button>
      <div class="hm-title">${first.toLocaleDateString(undefined, {month:"long", year:"numeric"})}</div>
      <button id="hmNext" aria-label="Next month" ${hmOff >= 1 ? "disabled" : ""}>›</button>
    </div>
    <div class="hm-grid">${["S","M","T","W","T","F","S"].map(x => `<span class="hm-dow">${x}</span>`).join("")}${cells}</div>
    <div class="hm-foot"><span><b style="color:var(--ink)">${total}</b> studied</span>
      <span class="hm-leg">Less ${["var(--line2)","#c7d2fe","#818cf8","#4f46e5","#312e81"].map(c => `<i style="background:${c}"></i>`).join("")} More</span></div>
    ${Object.keys(S.sample).length ? `<div class="hint" style="font-size:11.5px;color:var(--faint);margin-top:6px">Includes sample activity for the demo</div>` : ""}
  </div>`;
}
const howText = () => S.gradeMode === "two" && !askConf()
  ? `Show the answer, then tap <b>Missed it</b> or <b>Got it</b>; each button shows when the card comes back. A new card returns about 10 minutes after you first get it, and moves to tomorrow once you get it again. Shortcuts: <kbd>Space</kbd> to reveal, then <kbd>1</kbd> Missed it or <kbd>2</kbd> Got it.`
  : S.gradeMode === "two"
  ? `Before the answer, say how sure you are (Low, Medium, High). After it, tap <b>Missed it</b> or <b>Got it</b>; each button shows when the card comes back. A new card returns about 10 minutes after you first get it, and moves to tomorrow once you get it again. Got it with High confidence skips ahead a few days. Shortcuts: <kbd>1</kbd>–<kbd>3</kbd> for confidence, then <kbd>1</kbd> Missed / <kbd>2</kbd> Got it.`
  : `Answer, then rate how well you knew it. Each button shows when you'll see the card again. A new card needs Good twice (about 10 minutes apart) to move to tomorrow; Easy skips ahead a few days. Shortcuts: <kbd>Space</kbd> to reveal, <kbd>1</kbd>–<kbd>4</kbd> to rate.`;

export function viewToday(){
  const d = curDeck(), D = dueToday(d), cs = cardsOf(d), k = dk(d.id);
  const learned = cs.filter(c => prog(c.id).phase === "review").length;
  const nFlag = flaggedIn(d).length;
  const acc = S.today.reviewed ? Math.round(100*S.today.good/S.today.reviewed) : null;

  let left;
  if (d.topics){
    left = `<section class="panel pad"><h2>Study by exam area</h2>${Object.entries(d.topics).map(([key,t]) => {
      const tc = cs.filter(c => c.t === key), l = tc.filter(c => prog(c.id).phase === "review").length;
      const b = buckets(d, key), due = b.learning.length + b.review.length;
      return `<div class="area">
        <span class="dot" style="background:${t.color}"></span>
        <div><div class="name">${t.name}</div>
          <div class="meta">${due ? `<b style="color:var(--ink2)">${due} due</b> · ` : ""}${l}/${tc.length} learned${b.fresh.length ? ` · ${b.fresh.length} new` : ""}</div>
          <div class="bar"><i style="width:${Math.round(100*l/tc.length)}%;background:${t.color}"></i></div></div>
        <button class="btn ghost sm" data-study="${key}" ${due + b.fresh.length ? "" : "disabled"}>Study</button>
      </div>`;
    }).join("")}</section>`;
  } else {
    left = `<section class="panel pad"><h2>${esc(d.name)}</h2>
      ${cs.length ? `<div class="area" style="grid-template-columns:10px 1fr"><span class="dot" style="background:${d.color}"></span>
          <div><div class="name">${learned}/${cs.length} learned</div>
          <div class="meta">${cs.filter(c => prog(c.id).phase === "new").length} not started</div>
          <div class="bar"><i style="width:${Math.round(100*learned/cs.length)}%;background:${d.color}"></i></div></div></div>`
        : `<p class="note" style="margin:0 0 4px">This deck is empty. Add cards one at a time, or paste a list (works with text exported from Quizlet or Anki).</p>`}
      <div class="btn-row" style="margin-top:14px">
        <button class="btn sm" data-addcards>+ Add cards</button>
        <a class="btn ghost sm" href="#cards" style="text-decoration:none">Browse cards</a>
        ${d.builtin ? "" : `<button class="btn ghost sm" data-rename>Rename</button>
        <button class="btn ghost sm textred" data-deldeck>Delete deck</button>`}
      </div></section>`;
  }

  app.innerHTML = `
    <h1>${greet()}</h1>
    <p class="sub">${esc(d.name)} · ${esc(deckDesc(d))}</p>
    ${deckBar(d)}

    <section class="hero">
      <div>
        <div class="due-row">
          <div>
            <div class="due-num">${D.total}</div>
            <div class="due-label">${D.total === 1 ? "card" : "cards"} due today</div>
          </div>
          <div class="sizer">
            <div class="lbl">Today's size · new cards per day</div>
            <div class="step">
              <button id="minus" aria-label="Fewer new cards">−</button>
              <span class="val">${k.newLimit}</span>
              <button id="plus" aria-label="More new cards">+</button>
            </div>
            <div class="hint">${k.newSeen} new seen today · reviews are never capped</div>
            <label class="shuf" title="Study this deck's cards in random order instead of deck order"><input type="checkbox" id="shufToday" ${k.shuffle ? "checked" : ""}> Shuffle cards</label>
          </div>
        </div>
        <div class="split">
          <span class="pill" title="Cards on a schedule of a day or more that are due again"><b>${D.review}</b> review</span>
          <span class="pill" title="Cards you've started today that come back within minutes"><b>${D.learning}</b> learning</span>
          <span class="pill" title="Cards you haven't seen yet, up to today's limit"><b>${D.newc}</b> new</span>
        </div>
        <p class="hero-note">${D.learning
          ? `<b>${D.learning} learning</b> = cards you've started today. Each comes back about 10 minutes after you first get it right, and leaves today's count after the second time.`
          : `New cards come back a few minutes after you first see them, then move to a schedule of days.`}</p>
        ${D.total
          ? `<button class="btn" id="startBtn">Start studying <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>`
          : !cs.length
            ? `<button class="btn" data-addcards>+ Add cards</button>`
            : `<button class="btn" disabled>All done for today</button>
               <div class="note" style="margin-top:10px">${D.freshAll ? "Raise today's size to add more new cards." : "You've seen every card. Come back tomorrow for reviews."}</div>`}
      </div>
      ${heatmap()}
    </section>

    <div class="grid2">
      ${left}
      <aside class="side">
        <div class="panel pad">
          <div class="streak"><div class="flame">🔥</div>
            <div><div class="stat-big">${S.streak || 0}</div><div class="note" style="margin-top:-4px">day streak</div></div></div>
          <div class="stat-row"><span>Reviewed today</span><b>${S.today.reviewed}</b></div>
          <div class="stat-row"><span>${S.gradeMode === "two" ? "Got it" : "Good or Easy"}</span><b>${acc === null ? "–" : acc + "%"}</b></div>
          <div class="stat-row"><span>Cards learned</span><b>${learned} / ${cs.length}</b></div>
        </div>
        <div class="panel pad">
          <div class="flagbig"><div class="fi">⚑</div>
            <div><div style="font-weight:700">${nFlag} flagged</div><div class="note">Cards you marked to revisit or check</div></div></div>
          <div class="btn-row">
            <button class="btn sm" id="studyFlag" ${nFlag ? "" : "disabled"}>Review flagged</button>
            <button class="btn ghost sm" id="seeFlag">See list</button>
          </div>
        </div>
        <div class="panel pad">
          <h2 style="margin-bottom:8px">How it works</h2>
          <p class="note" style="margin:0">${howText()}</p>
        </div>
      </aside>
    </div>`;

  bindDeckBar();
  $("#startBtn") && ($("#startBtn").onclick = () => startSession());
  $("#shufToday").onchange = e => { k.shuffle = e.target.checked; save(); toast(k.shuffle ? `Shuffle on for ${d.name}` : `Shuffle off: ${d.name} in deck order`); };
  $("#minus").onclick = () => { k.newLimit = Math.max(0, k.newLimit - 5); save(); viewToday(); };
  $("#plus").onclick = () => { k.newLimit = Math.min(100, k.newLimit + 5); save(); viewToday(); };
  $("#hmPrev").onclick = () => { hmOff = Math.max(-1, hmOff - 1); viewToday(); };
  $("#hmNext").onclick = () => { hmOff = Math.min(1, hmOff + 1); viewToday(); };
  $("#studyFlag").onclick = () => startSession({flagged:true});
  $("#seeFlag").onclick = () => { filt.topic = "flag"; filt.open = null; location.hash = "#cards"; };
  app.querySelectorAll("[data-study]").forEach(b => b.onclick = () => startSession({topic:b.dataset.study}));
  bindDeckActions();
}
export function bindDeckActions(){
  app.querySelectorAll("[data-addcards]").forEach(b => b.onclick = () => openAddCards());
  app.querySelectorAll("[data-aimaker]").forEach(b => b.onclick = () => openAiMaker());
  app.querySelectorAll("[data-rename]").forEach(b => b.onclick = openRename);
  app.querySelectorAll("[data-deldeck]").forEach(b => b.onclick = openDeleteDeck);
  app.querySelectorAll("[data-editmeta]").forEach(b => b.onclick = openEditMeta);
}
