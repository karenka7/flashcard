import { $, esc } from "../dom.js";
import { dropSounds } from "../media.js";
import { openAddCards } from "./cardForm.js";
import { route } from "../router.js";
import { PALETTE, S, curDeck, parseBulk, resetFilt, save, uid } from "../state.js";
import { DEFAULT_INSTR, cardSoundKeys, closeModal, deckDesc, deckInstr, deckSub, showModal, toast } from "../ui.js";

export function openNewDeck(){
  showModal(`<h3>New deck</h3>
    <p class="note" style="margin:0">Make a deck for a class, an exam or a topic. You can add cards now or later.</p>
    <label class="fl">Deck name<input id="dName" maxlength="60" placeholder="e.g. Med-Surg exam 2"></label>
    <label class="fl">Cards <span>(optional)</span><textarea id="dBulk" rows="6" placeholder="One card per line:&#10;What is normal potassium? | 3.5–5.0 mEq/L&#10;Antidote for heparin? | Protamine sulfate"></textarea></label>
    <p class="note" style="margin:6px 0 0">Put | or a tab between question and answer; add a third part for an explanation. Text exported from Quizlet or Anki (tab-separated) pastes straight in.</p>
    <div class="actions"><button class="btn ghost sm" id="mCancel">Cancel</button><button class="btn sm" id="mCreate">Create deck</button></div>`);
  $("#dName").focus();
  $("#mCancel").onclick = closeModal;
  $("#mCreate").onclick = () => {
    const name = $("#dName").value.trim();
    if (!name){ $("#dName").focus(); toast("Give the deck a name"); return; }
    const {cards, skipped} = parseBulk($("#dBulk").value);
    const id = uid("d"), color = PALETTE[S.decks.length % PALETTE.length];
    S.decks.push({id, name, color, cards, created:Date.now()});
    S.deck = id; resetFilt(); save();
    $("#modal").hidden = true;
    if (cards.length){ location.hash = "#today"; route(); toast(`Created “${name}” with ${cards.length} card${cards.length === 1 ? "" : "s"}${skipped ? ` · ${skipped} line${skipped === 1 ? "" : "s"} skipped` : ""}`); }
    else { location.hash = "#today"; route(); openAddCards(); }
  };
}

export function openRename(){
  const d = curDeck(); if (d.builtin) return;
  showModal(`<h3>Rename deck</h3><label class="fl">Deck name<input id="dName" maxlength="60" value="${esc(d.name)}"></label>
    <div class="actions"><button class="btn ghost sm" id="mCancel">Cancel</button><button class="btn sm" id="mSave">Save</button></div>`);
  $("#dName").select();
  $("#mCancel").onclick = closeModal;
  $("#mSave").onclick = () => { const n = $("#dName").value.trim(); if (!n) return; d.name = n; save(); closeModal(); };
}
export function openEditMeta(){
  const d = curDeck(), def = deckSub(d);
  showModal(`<h3>Edit description</h3>
    <p class="note" style="margin:0">These two lines appear under the page titles for ${esc(d.name)}. Clear a box to go back to the default.</p>
    <label class="fl">Description <span>(Home and Cards pages)</span><input id="mdDesc" maxlength="140" value="${esc(deckDesc(d))}" placeholder="${esc(def)}"></label>
    <label class="fl">Instructions <span>(Cards page)</span><textarea id="mdInstr" rows="2" maxlength="240" placeholder="${esc(DEFAULT_INSTR)}">${esc(deckInstr(d))}</textarea></label>
    <div class="actions"><button class="btn ghost sm" id="mCancel">Cancel</button><button class="btn sm" id="mSave">Save</button></div>`);
  $("#mdDesc").focus();
  $("#mCancel").onclick = closeModal;
  $("#mSave").onclick = () => {
    const desc = $("#mdDesc").value.trim(), instr = $("#mdInstr").value.trim(), m = {};
    // Text left equal to the default isn't stored, so defaults that count cards stay live
    if (desc && desc !== def) m.desc = desc;
    if (instr && instr !== DEFAULT_INSTR) m.instr = instr;
    if (m.desc || m.instr) S.meta[d.id] = m; else delete S.meta[d.id];
    save(); closeModal(); toast("Description saved");
  };
}
export function openDeleteDeck(){
  const d = curDeck(); if (d.builtin) return;
  showModal(`<h3>Delete “${esc(d.name)}”?</h3><p class="note">This removes the deck, its ${d.cards.length} card${d.cards.length === 1 ? "" : "s"} and their review history from this browser. It can't be undone.</p>
    <div class="actions"><button class="btn ghost sm" id="mCancel">Cancel</button><button class="btn danger sm" id="mDel">Delete deck</button></div>`);
  $("#mCancel").onclick = closeModal;
  $("#mDel").onclick = () => {
    d.cards.forEach(c => { delete S.cards[c.id]; delete S.flags[c.id]; dropSounds(cardSoundKeys(c)); });
    S.decks = S.decks.filter(x => x.id !== d.id); delete S.dk[d.id]; delete S.meta[d.id]; S.deck = "rn";
    resetFilt(); save(); closeModal(); toast("Deck deleted");
  };
}
