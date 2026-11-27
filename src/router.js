import { $ } from "./dom.js";
import { DAY } from "./scheduler.js";
import { S, resetFilt, rollDay, save } from "./state.js";
import { viewCards } from "./views/cards.js";
import { viewMerch } from "./views/merch.js";
import { viewProgress } from "./views/progress.js";
import { viewToday } from "./views/today.js";

export function switchDeck(id){ S.deck = id; resetFilt(); save(); route(); }
export function route(){
  rollDay();
  const v = (location.hash || "#today").slice(1);
  const view = ["today","cards","progress","merch"].includes(v) ? v : "today";
  document.querySelectorAll("[data-v]").forEach(a => a.classList.toggle("on", a.dataset.v === view));
  ({today:viewToday, cards:viewCards, progress:viewProgress, merch:viewMerch})[view]();
  const c = $("#clock");
  if (S.offset > 0){ c.hidden = false; c.textContent = "Demo clock +" + Math.round(S.offset/DAY) + "d"; } else c.hidden = true;
  window.scrollTo(0,0);
}
