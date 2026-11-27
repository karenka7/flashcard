import { app, esc } from "../dom.js";
import { DAY } from "../scheduler.js";
import { S, cardsOf, curDeck, endOfDay, now, prog } from "../state.js";
import { bindDeckBar, deckBar } from "../ui.js";

export function viewProgress(){
  const d = curDeck(), cs = cardsOf(d);
  const ph = {new:0, learning:0, young:0, mature:0};
  cs.forEach(c => { const s = prog(c.id);
    if (s.phase === "new") ph.new++; else if (s.phase !== "review") ph.learning++; else if (s.ivl >= 21) ph.mature++; else ph.young++; });
  const learned = ph.young + ph.mature, pctL = cs.length ? Math.round(100*learned/cs.length) : 0;
  const days = [...Array(7)].map((_,i) => {
    const start = i === 0 ? 0 : endOfDay(now() + (i-1)*DAY) + 1, end = endOfDay(now() + i*DAY);
    const n = cs.filter(c => { const s = prog(c.id); return s.phase !== "new" && s.due >= start && s.due <= end; }).length;
    const lbl = i === 0 ? "Today" : new Date(now() + i*DAY).toLocaleDateString(undefined,{weekday:"short"});
    return {n, lbl, today:i === 0};
  });
  const max = Math.max(1, ...days.map(x => x.n));
  const rowBar = (name, color, pct, right) => `<div class="area" style="grid-template-columns:10px 1fr 48px">
      <span class="dot" style="background:${color}"></span>
      <div><div class="name">${name}</div><div class="bar"><i style="width:${pct}%;background:${color}"></i></div></div>
      <b style="text-align:right;font-size:14px">${right}</b></div>`;
  const leftPanel = d.topics
    ? `<h2>Readiness by exam area</h2>${Object.entries(d.topics).map(([k,t]) => {
        const tc = cs.filter(c => c.t === k), l = tc.filter(c => prog(c.id).phase === "review").length, pct = Math.round(100*l/tc.length);
        return rowBar(t.name, t.color, pct, pct + "%"); }).join("")}`
    : `<h2>Card stages</h2>${cs.length ? [["Not started",ph.new,"#94a3b8"],["Learning",ph.learning,"#dc2626"],["Young (under 21 days)",ph.young,"#16a34a"],["Mature (21+ days)",ph.mature,d.color]]
        .map(([n,v,col]) => rowBar(n, col, Math.round(100*v/cs.length), v)).join("") : `<p class="note">No cards yet.</p>`}`;

  app.innerHTML = `
    <h1>Progress</h1>
    <p class="sub">${esc(d.name)} · readiness and what's coming up this week.</p>
    ${deckBar(d)}
    <div class="kpis">
      <div class="panel pad kpi"><div class="k">Learned</div><div class="v">${pctL}%</div></div>
      <div class="panel pad kpi"><div class="k">Learning now</div><div class="v">${ph.learning}</div></div>
      <div class="panel pad kpi"><div class="k">Not started</div><div class="v">${ph.new}</div></div>
      <div class="panel pad kpi"><div class="k">Total reviews (all decks)</div><div class="v">${S.total || 0}</div></div>
    </div>
    <div class="grid2">
      <section class="panel pad">${leftPanel}
        <p class="note" style="margin:12px 0 0">“Learned” means you've passed a card's learning steps and it's now on a review schedule (1 day or longer).</p></section>
      <aside class="side"><div class="panel pad"><h2>Reviews due, next 7 days</h2>
        <div class="fc">${days.map(x => `<div class="col"><span class="n">${x.n}</span><div class="b ${x.today ? "today" : ""}" style="height:${Math.round(100*x.n/max)}px"></div><span class="d">${x.lbl}</span></div>`).join("")}</div>
        <p class="note" style="margin:12px 0 0">New cards aren't counted here; they're added each day up to your daily limit.</p></div></aside>
    </div>`;
  bindDeckBar();
}
