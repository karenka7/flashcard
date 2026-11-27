import { $, app, esc } from "./dom.js";
import { sndUrl } from "./media.js";
import { stopRec } from "./modals/cardForm.js";
import { openNewDeck } from "./modals/decks.js";
import { route, switchDeck } from "./router.js";
import { S, allDecks, dueToday, now, ownCards } from "./state.js";

export const greet = () => { const h = new Date(now()).getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
export function deckBar(d){
  return `<div class="decks">${allDecks().map(x => {
    const n = dueToday(x).total;
    return `<button class="deck ${x.id === d.id ? "on" : ""}" data-deck="${x.id}"><span class="dot" style="background:${x.color}"></span>${esc(x.name)}${n ? `<span class="dn" title="${n} due today">${n}</span>` : ""}</button>`;
  }).join("")}<button class="deck add" data-newdeck>+ New deck</button></div>`;
}
export function bindDeckBar(){
  app.querySelectorAll("[data-deck]").forEach(b => b.onclick = () => switchDeck(b.dataset.deck));
  app.querySelectorAll("[data-newdeck]").forEach(b => b.onclick = openNewDeck);
}
const ownNote = d => d.builtin && ownCards(d).length ? ` + ${ownCards(d).length} of yours` : "";
export const deckSub = d => d.sub ? d.sub + ownNote(d) : d.builtin
  ? (d.topics ? `Demo deck of ${d.cards.length} cards across ${Object.keys(d.topics).length} exam areas` : `Demo deck of ${d.cards.length} cards, ${d.cards.filter(c => c.imgQ || c.imgA).length} with diagrams` + ownNote(d))
  : `Your deck · ${d.cards.length} card${d.cards.length === 1 ? "" : "s"}`;
/* Deck description (Home + Cards) and instructions (Cards): the defaults above/below
   apply until someone edits them on the Cards page; edits are kept in S.meta[deckId]. */
export const DEFAULT_INSTR = "Browse the deck, check answers and see when each card is due.";
export const deckDesc = d => (S.meta[d.id] && S.meta[d.id].desc) || deckSub(d);
export const deckInstr = d => (S.meta[d.id] && S.meta[d.id].instr) || DEFAULT_INSTR;
export const cardImg = (src, alt) => src ? `<img class="c-img" src="${esc(src)}" alt="${alt}">` : "";
export const cardSnd = (key, label) => key
  ? (sndUrl(key) ? `<audio class="c-snd" controls preload="metadata" src="${sndUrl(key)}" aria-label="${label}"></audio>`
                      : `<div class="note c-snd">(Sound not available in this browser)</div>`)
  : "";
export const cardSoundKeys = c => [c.sndQ, c.sndA];
export const srcHtml = s => /^https?:\/\/\S+$/.test(s) ? `<a href="${esc(s)}" target="_blank" rel="noopener noreferrer">${esc(s)}</a>` : esc(s);
/* =========================================================
   MODALS: decks, cards, settings
   ========================================================= */
export function showModal(html){
  const m = $("#modal");
  m.innerHTML = `<div class="sheet" role="dialog">${html}</div>`;
  m.hidden = false;
  m.onclick = e => { if (e.target === m) closeModal(); };
  m.onkeydown = null;
  return m;
}
export function closeModal(){ stopRec(); $("#modal").hidden = true; route(); }

let tt;
export function toast(msg){ const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 2600); }
