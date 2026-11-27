import { AI_MODELS, aiCfg, aiSaveCfg } from "../ai.js";
import { $, esc } from "../dom.js";
import { DAY } from "../scheduler.js";
import { S, curDeck, dk, fresh, makeSample, replaceState, save } from "../state.js";
import { closeModal, showModal, toast } from "../ui.js";

export function openSettings(confirmReset){
  const d = curDeck(), k = dk(d.id);
  showModal(confirmReset ? `
      <h3>Reset all progress?</h3>
      <p class="note">This clears every card's schedule, your streak and flags in this browser. Your own decks and their cards are kept. It can't be undone.</p>
      <div class="actions"><button class="btn ghost sm" id="mBack">Cancel</button><button class="btn danger sm" id="mReset">Reset progress</button></div>`
    : `
      <h3>Settings</h3>
      <p class="note" style="margin:0">Progress and your decks are saved in this browser only.</p>
      <div class="sec"><h4>Grading style</h4>
        <select id="mGrade">
          <option value="two" ${S.gradeMode === "two" ? "selected" : ""}>Two-step: confidence, then Missed it / Got it</option>
          <option value="four" ${S.gradeMode === "four" ? "selected" : ""}>Four buttons: Again / Hard / Good / Easy</option>
        </select>
        <label class="shuf" id="mConfWrap" ${S.gradeMode === "two" ? "" : "hidden"}><input type="checkbox" id="mConf" ${S.askConf !== false ? "checked" : ""}> Ask how sure I am before showing the answer</label>
        <p class="note" style="margin:8px 0 0">Two-step maps Got it + Low/Medium/High confidence to Hard/Good/Easy, so the schedule is the same either way.</p></div>
      <div class="sec"><h4>Card order · ${esc(d.name)}</h4>
        <label class="shuf"><input type="checkbox" id="mShuf" ${k.shuffle ? "checked" : ""}> Shuffle cards</label>
        <p class="note" style="margin:6px 0 0">On: new cards are picked at random and reviews come in random order. Off: deck order.</p></div>
      <div class="sec"><h4>New cards per day · ${esc(d.name)}</h4>
        <select id="mLimit">${[0,5,10,15,20,25,30,40,50,75,100].map(n => `<option ${n === k.newLimit ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      <div class="sec"><h4>AI card maker</h4>
        <p class="note" style="margin:0 0 8px">Paste your own Anthropic API key to use “Make cards with AI” on the Cards page. It's saved in this browser only and sent only to Anthropic. Don't use this on a shared computer.</p>
        <input id="mAiKey" type="password" autocomplete="off" placeholder="${aiCfg().key ? "Key saved · paste a new one to replace it" : "sk-ant-..."}" style="width:100%">
        <select id="mAiModel" style="margin-top:8px">${AI_MODELS.map(([v,l]) => `<option value="${v}" ${(aiCfg().model || AI_MODELS[0][0]) === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        <div style="margin-top:8px"><button class="btn ghost sm" id="mAiSave">Save key</button>${aiCfg().key ? ` <button class="btn ghost sm textred" id="mAiDel">Remove key</button>` : ""}</div></div>
      <div class="sec"><h4>Demo clock</h4>
        <p class="note" style="margin:0 0 10px">Jump ahead to see cards come back for review. ${S.offset ? `Currently +${Math.round(S.offset/DAY)} day(s).` : ""}</p>
        <button class="btn ghost sm" id="mJump">Jump ahead 1 day</button>
        ${S.offset ? `<button class="btn ghost sm" id="mNow">Back to real time</button>` : ""}</div>
      <div class="sec"><h4>Sample activity</h4>
        <p class="note" style="margin:0 0 10px">Made-up study counts that give the Home heatmap some colour for demos. Real activity is counted separately.</p>
        <button class="btn ghost sm" id="mSample">${Object.keys(S.sample).length ? "Remove sample activity" : "Add sample activity"}</button></div>
      <div class="sec"><h4>Reset</h4>
        <button class="btn ghost sm textred" id="mAsk">Reset all progress…</button></div>
      <div class="actions"><button class="btn sm" id="mClose">Done</button></div>`);
  if (confirmReset){
    $("#mBack").onclick = () => openSettings(false);
    $("#mReset").onclick = () => { replaceState(Object.assign(fresh(), {decks:S.decks, extra:S.extra || {}, deck:S.deck, gradeMode:S.gradeMode, askConf:S.askConf, meta:S.meta, cart:S.cart, sample:S.sample})); save(); closeModal(); toast("Progress reset"); };
  } else {
    $("#mGrade").onchange = e => { S.gradeMode = e.target.value; save(); $("#mConfWrap").hidden = S.gradeMode !== "two"; };
    $("#mConf").onchange = e => { S.askConf = e.target.checked; save(); };
    $("#mAiModel").onchange = e => { aiSaveCfg({...aiCfg(), model:e.target.value}); toast("AI model saved"); };
    $("#mAiSave").onclick = () => { const k = $("#mAiKey").value.trim();
      if (!k){ toast("Paste your API key first"); return; }
      if (!/^sk-ant-/.test(k)){ toast("That doesn't look like an Anthropic API key (it starts with sk-ant-)"); return; }
      aiSaveCfg({...aiCfg(), key:k, model:$("#mAiModel").value}); toast("API key saved in this browser"); openSettings(); };
    const aiDel = $("#mAiDel"); if (aiDel) aiDel.onclick = () => { const c = aiCfg(); delete c.key; aiSaveCfg(c); toast("API key removed"); openSettings(); };
    $("#mLimit").onchange = e => { k.newLimit = +e.target.value; save(); };
    $("#mShuf").onchange = e => { k.shuffle = e.target.checked; save(); };
    $("#mJump").onclick = () => { S.offset = (S.offset || 0) + DAY; save(); closeModal(); toast("Moved the demo clock ahead 1 day"); };
    $("#mNow") && ($("#mNow").onclick = () => { S.offset = 0; save(); closeModal(); toast("Back to real time"); });
    $("#mSample").onclick = () => { const on = Object.keys(S.sample).length; S.sample = on ? {} : makeSample(); save(); closeModal(); toast(on ? "Sample activity removed" : "Sample activity added"); };
    $("#mAsk").onclick = () => openSettings(true);
    $("#mClose").onclick = closeModal;
  }
}
$("#settingsBtn").onclick = () => openSettings(false);
