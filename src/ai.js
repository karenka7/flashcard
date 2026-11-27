/* =========================================================
   AI CARD MAKER — turn a document, an image or pasted text
   (e.g. a video transcript) into suggested cards with Claude.
   v1 is "bring your own key": the person's Anthropic API key
   is kept in this browser only (localStorage "flick-ai") and
   the page calls the API directly. Everything that talks to
   the API is in aiMakeCards(), so moving to a backend later
   only changes that function.
   ========================================================= */
const AI_KEY = "flick-ai", AI_MAX_FILE = 25 * 1024 * 1024;
export const AI_MODELS = [["claude-sonnet-5-5","Sonnet 5.5 (balanced, recommended)"],["claude-haiku-5-5","Haiku 5.5 (fastest, cheapest)"],["claude-opus-5-5","Opus 5.5 (most capable)"]];
export const aiCfg = () => { try { return JSON.parse(localStorage.getItem(AI_KEY)) || {}; } catch(e){ return {}; } };
export const aiSaveCfg = c => { try { localStorage.setItem(AI_KEY, JSON.stringify(c)); return true; } catch(e){ return false; } };

/* Read a file into something Claude can take: a PDF or image as base64, text as text.
   Word (.docx) files are zip archives; the text is pulled from word/document.xml. */
const b64 = buf => { let s = "", u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
async function docxText(buf){
  const v = new DataView(buf), u = new Uint8Array(buf);
  let e = buf.byteLength - 22; while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("not a zip");
  let p = v.getUint32(e + 16, true), n = v.getUint16(e + 10, true);
  for (let i = 0; i < n; i++){
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true),
          xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true),
          name = new TextDecoder().decode(u.subarray(p + 46, p + 46 + nl));
    if (name === "word/document.xml"){
      const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true), data = u.subarray(start, start + size);
      const raw = method === 0 ? data : new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
      const xml = new TextDecoder().decode(raw);
      return xml.replace(/<w:tab\/>/g, "\t").replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, "")
        .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&").trim();
    }
    p += 46 + nl + xl + cl;
  }
  throw new Error("no document.xml");
}
export async function aiReadFile(f){
  const name = f.name, ext = (name.split(".").pop() || "").toLowerCase();
  if (f.size > AI_MAX_FILE) throw new Error(`That file is ${(f.size/1048576).toFixed(1)} MB. Keep files under ${AI_MAX_FILE/1048576} MB.`);
  if (ext === "pdf" || f.type === "application/pdf")
    return {block:{type:"document", source:{type:"base64", media_type:"application/pdf", data:b64(await f.arrayBuffer())}, title:name}, name};
  if (/^image\/(png|jpeg|gif|webp)$/.test(f.type))
    return {block:{type:"image", source:{type:"base64", media_type:f.type, data:b64(await f.arrayBuffer())}}, name};
  if (ext === "docx"){
    let t; try { t = await docxText(await f.arrayBuffer()); } catch(e){ throw new Error("Couldn't read that Word file. Try saving it as PDF."); }
    if (!t) throw new Error("That Word file has no text in it.");
    return {block:{type:"text", text:`<document title="${name}">\n${t}\n</document>`}, name};
  }
  if (["txt","md","csv","tsv","srt","vtt","html","htm","json"].includes(ext) || f.type.startsWith("text/"))
    return {block:{type:"text", text:`<document title="${name}">\n${await f.text()}\n</document>`}, name};
  if (ext === "doc" || ext === "pptx" || ext === "ppt") throw new Error("That file type isn't supported yet. Save it as PDF and upload that.");
  if (f.type.startsWith("audio/") || f.type.startsWith("video/")) throw new Error("Audio and video files aren't supported yet. Paste a transcript instead.");
  throw new Error("That file type isn't supported. Use PDF, Word (.docx), text or an image.");
}

/* The one function that talks to the AI. Returns [{q, a, why, src}]. */
export async function aiMakeCards({block, sourceName, count, focus}, signal){
  const cfg = aiCfg();
  if (!cfg.key) throw new Error("Add your Anthropic API key in Settings first.");
  const howMany = count ? `Make about ${count} cards.` : "Make as many cards as the material supports well (usually 10 to 30), without padding.";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST", signal,
    headers:{"content-type":"application/json", "x-api-key":cfg.key, "anthropic-version":"2023-06-01", "anthropic-dangerous-direct-browser-access":"true"},
    body: JSON.stringify({
      model: cfg.model || AI_MODELS[0][0], max_tokens: 16000,
      system: "You write study flashcards for students (often nursing and health-science students). Each card tests one fact or idea. "
        + "The front is a clear question; the back is a short, direct answer; the explanation adds the why in one to three sentences. "
        + "Use only what the material says; don't invent facts, doses or numbers. Skip filler such as course logistics. "
        + "For each card, give where in the material it came from (a page, slide, section heading or timestamp) if you can tell. "
        + "Write in the language of the material.",
      output_config: {format: {type:"json_schema", schema:{type:"object", additionalProperties:false, required:["cards"], properties:{
        cards:{type:"array", items:{type:"object", additionalProperties:false, required:["q","a","why","where"], properties:{
          q:{type:"string", description:"Front: the question"}, a:{type:"string", description:"Back: the answer"},
          why:{type:"string", description:"Short explanation, or empty"}, where:{type:"string", description:"Page, slide, section or timestamp, or empty if unknown"}}}}}}}},
      messages: [{role:"user", content:[block, {type:"text", text:
        `Make flashcards from this material. ${howMany}${focus ? `\nFocus on: ${focus}` : ""}`}]}]
    })
  });
  if (!res.ok){
    let msg = ""; try { msg = (await res.json()).error.message; } catch(e){}
    if (res.status === 401) throw new Error("The API key wasn't accepted. Check it in Settings.");
    if (res.status === 429) throw new Error("Too many requests or no API credit left. Wait a minute, or check your Anthropic account.");
    if (res.status === 413) throw new Error("That file is too big for one request. Try a shorter document or split it.");
    if (res.status === 529 || res.status >= 500) throw new Error("The AI service is busy. Try again in a minute.");
    throw new Error(msg || `The AI request failed (${res.status}).`);
  }
  const data = await res.json(), txt = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  if (data.stop_reason === "refusal") throw new Error("The AI declined to make cards from this material.");
  let parsed;
  try { parsed = JSON.parse(txt); }
  catch(e){ throw new Error(data.stop_reason === "max_tokens" ? "The answer was too long and got cut off. Ask for fewer cards, or use a shorter document." : "The AI's answer couldn't be read. Try again."); }
  const cards = parsed && Array.isArray(parsed.cards) ? parsed.cards : [];
  return cards.filter(c => c && c.q && c.a).map(c => ({q:String(c.q).trim(), a:String(c.a).trim(), why:String(c.why || "").trim(),
    src:[sourceName, c.where].filter(Boolean).join(", ")}));
}
