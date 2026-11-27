import { aiCfg, aiMakeCards, aiReadFile } from "../ai.js";
import { $, esc } from "../dom.js";
import { STORAGE_FULL } from "./cardForm.js";
import { openSettings } from "./settings.js";
import { PALETTE, S, allDecks, curDeck, ownCards, resetFilt, save, uid } from "../state.js";
import { closeModal, showModal, toast } from "../ui.js";

let aiAbort = null;
export function openAiMaker(mode = "file"){
  const cfg = aiCfg(), d = curDeck();
  showModal(`<h3>✨ Make cards with AI</h3>
    ${cfg.key ? "" : `<p class="note warnbox">First add your Anthropic API key in <a href="#" id="aiGoSettings">Settings</a>. It stays in this browser.</p>`}
    <div class="seg"><button data-m="file" class="${mode === "file" ? "on" : ""}">Upload a file</button><button data-m="text" class="${mode === "text" ? "on" : ""}">Paste text</button></div>
    ${mode === "file"
      ? `<label class="fl">File <span>(PDF, Word .docx, text, or an image of a slide or page)</span>
           <input type="file" id="aiFile" accept=".pdf,.docx,.txt,.md,.csv,.srt,.vtt,image/png,image/jpeg,image/webp,image/gif,application/pdf,text/*"></label>`
      : `<label class="fl">Text <span>(notes, an article, or a video transcript)</span><textarea id="aiText" rows="7" placeholder="Paste here"></textarea></label>
         <p class="note" style="margin:6px 0 0">For a YouTube video: under the video, open the description, choose <b>Show transcript</b>, then select the text and copy it here.</p>
         <label class="fl">Where it's from <span>(optional, shown as each card's source)</span><input id="aiSrcName" maxlength="200" placeholder="e.g. a video link or lecture title"></label>`}
    <label class="fl">How many cards<select id="aiCount"><option value="">Let the AI decide</option><option>10</option><option>20</option><option>30</option><option>50</option></select></label>
    <label class="fl">Focus <span>(optional)</span><input id="aiFocus" maxlength="300" placeholder="e.g. drug side effects and nursing actions"></label>
    <p class="note" style="margin:8px 0 0">You'll review the cards and choose a deck before anything is added. AI can make mistakes, so check each card.</p>
    <div class="actions"><button class="btn ghost sm" id="mCancel">Cancel</button><button class="btn sm" id="aiGo" ${cfg.key ? "" : "disabled"}>Make cards</button></div>`);
  $("#modal").querySelectorAll("[data-m]").forEach(b => b.onclick = () => openAiMaker(b.dataset.m));
  $("#mCancel").onclick = closeModal;
  const gs = $("#aiGoSettings"); if (gs) gs.onclick = e => { e.preventDefault(); openSettings(); };
  $("#aiGo").onclick = async () => {
    let input;
    try {
      if (mode === "file"){
        const f = $("#aiFile").files[0]; if (!f){ toast("Choose a file first"); return; }
        const r = await aiReadFile(f); input = {block:r.block, sourceName:r.name};
      } else {
        const t = $("#aiText").value.trim(); if (t.length < 40){ toast("Paste a bit more text first"); $("#aiText").focus(); return; }
        input = {block:{type:"text", text:`<document>\n${t}\n</document>`}, sourceName:$("#aiSrcName").value.trim()};
      }
    } catch(err){ toast(err.message); return; }
    Object.assign(input, {count:+$("#aiCount").value || 0, focus:$("#aiFocus").value.trim()});
    showModal(`<h3>Making cards…</h3><p class="note">Reading ${esc(input.sourceName || "your text")} and writing cards. This can take up to a minute for a long document.</p>
      <div class="spin"></div><div class="actions"><button class="btn ghost sm" id="aiStop">Cancel</button></div>`);
    aiAbort = new AbortController();
    $("#aiStop").onclick = () => { aiAbort.abort(); closeModal(); };
    try {
      const cards = await aiMakeCards(input, aiAbort.signal);
      if ($("#modal").hidden) return;
      if (!cards.length){ showModal(`<h3>No cards made</h3><p class="note">The AI didn't find anything to turn into cards. Try another file, or add a focus.</p><div class="actions"><button class="btn sm" id="mBack">Back</button></div>`); $("#mBack").onclick = () => openAiMaker(mode); return; }
      openAiReview(cards);
    } catch(err){
      if (err.name === "AbortError") return;
      const msg = err instanceof TypeError ? "Couldn't reach the AI service. Check your internet connection." : err.message;
      showModal(`<h3>Couldn't make cards</h3><p class="note">${esc(msg)}</p><div class="actions"><button class="btn ghost sm" id="mCancel">Close</button><button class="btn sm" id="mBack">Try again</button></div>`);
      $("#mCancel").onclick = closeModal; $("#mBack").onclick = () => openAiMaker(mode);
    }
  };
}
function openAiReview(cards){
  const d = curDeck(), keep = cards.map(() => true);
  const decks = allDecks();
  const m = showModal(`<h3>Review ${cards.length} suggested card${cards.length === 1 ? "" : "s"}</h3>
    <p class="note" style="margin:0">Untick any you don't want and fix wording before adding. AI can make mistakes.</p>
    <div class="ai-list">${cards.map((c, i) => `<div class="ai-card" data-i="${i}">
      <label class="ai-keep"><input type="checkbox" checked data-keep="${i}"> Keep</label>
      <textarea data-f="q" rows="2" aria-label="Front">${esc(c.q)}</textarea>
      <textarea data-f="a" rows="2" aria-label="Back">${esc(c.a)}</textarea>
      ${c.why ? `<textarea data-f="why" rows="2" aria-label="Explanation" class="ai-why">${esc(c.why)}</textarea>` : ""}
      ${c.src ? `<div class="note ai-src">Source: ${esc(c.src)}</div>` : ""}</div>`).join("")}</div>
    <label class="fl">Add to deck<select id="aiDeck">${decks.map(x => `<option value="${x.id}" ${x.id === d.id ? "selected" : ""}>${esc(x.name)}${x.builtin ? " (built-in)" : ""}</option>`).join("")}<option value="__new">+ New deck…</option></select></label>
    <label class="fl" id="aiNewWrap" hidden>New deck name<input id="aiNewName" maxlength="60"></label>
    <div class="actions"><button class="btn ghost sm" id="mCancel">Cancel</button><button class="btn sm" id="aiAdd">Add ${cards.length} cards</button></div>`);
  m.querySelector(".sheet").classList.add("wide");
  const upd = () => { const n = keep.filter(Boolean).length; $("#aiAdd").textContent = `Add ${n} card${n === 1 ? "" : "s"}`; $("#aiAdd").disabled = !n; };
  m.querySelectorAll("[data-keep]").forEach(cb => cb.onchange = () => { keep[+cb.dataset.keep] = cb.checked; cb.closest(".ai-card").classList.toggle("off", !cb.checked); upd(); });
  $("#aiDeck").onchange = e => { $("#aiNewWrap").hidden = e.target.value !== "__new"; if (!$("#aiNewWrap").hidden) $("#aiNewName").focus(); };
  $("#mCancel").onclick = closeModal;
  $("#aiAdd").onclick = () => {
    const chosen = [];
    m.querySelectorAll(".ai-card").forEach(el => {
      const i = +el.dataset.i; if (!keep[i]) return;
      const val = f => { const t = el.querySelector(`[data-f="${f}"]`); return t ? t.value.trim() : ""; };
      const q = val("q"), a = val("a"); if (!q || !a) return;
      chosen.push({id:uid("u"), q, a, why:val("why"), ...(cards[i].src ? {src:cards[i].src} : {})});
    });
    if (!chosen.length){ toast("Every kept card needs a front and a back"); return; }
    let target, created = false;
    if ($("#aiDeck").value === "__new"){
      const name = $("#aiNewName").value.trim(); if (!name){ toast("Give the new deck a name"); $("#aiNewName").focus(); return; }
      target = {id:uid("d"), name, color:PALETTE[S.decks.length % PALETTE.length], cards:[], created:Date.now()};
      S.decks.push(target); created = true;
    } else target = allDecks().find(x => x.id === $("#aiDeck").value);
    const own = ownCards(target); own.push(...chosen);
    if (!save()){ own.splice(own.length - chosen.length); if (created) S.decks.pop(); toast(STORAGE_FULL); return; }
    S.deck = target.id; resetFilt(); save();
    closeModal(); toast(`Added ${chosen.length} card${chosen.length === 1 ? "" : "s"} to ${target.name}`);
  };
}
