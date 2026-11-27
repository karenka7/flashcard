export const MIN = 60e3, HOUR = 36e5, DAY = 864e5;
/* =========================================================
   SCHEDULER — simple SM-2 style with learning steps.
   plan() is the single source of truth for both the interval
   labels on the buttons and what grading actually does.
   g: 0 Again, 1 Hard, 2 Good, 3 Easy
   Two-step grading maps onto these: Missed it = Again;
   Got it + Low/Medium/High confidence = Hard/Good/Easy.
   ========================================================= */
export function plan(s0, g){
  const s = {...s0}; let ms;
  if (s.phase === "new" || s.phase === "learning"){
    const step = s.step || 0;
    if (g === 0){ s.phase = "learning"; s.step = 0; ms = MIN; }
    else if (g === 1){ s.phase = "learning"; ms = step === 0 ? 6*MIN : 10*MIN; }
    else if (g === 2){ if (step === 0){ s.phase = "learning"; s.step = 1; ms = 10*MIN; } else { s.phase = "review"; s.ivl = 1; ms = DAY; } }
    else { s.phase = "review"; s.ivl = 4; ms = 4*DAY; }
  } else if (s.phase === "relearning"){
    if (g === 0) ms = MIN;
    else if (g === 1) ms = 10*MIN;
    else if (g === 2){ s.phase = "review"; s.ivl = Math.max(1, s.ivl); ms = s.ivl*DAY; }
    else { s.phase = "review"; s.ivl = Math.max(2, Math.round(s.ivl*1.5)); ms = s.ivl*DAY; }
  } else {
    const iv = s.ivl || 1;
    if (g === 0){ s.phase = "relearning"; s.lapses = (s.lapses||0)+1; s.ease = Math.max(1.3, s.ease-0.2); s.ivl = Math.max(1, Math.round(iv*0.5)); ms = 10*MIN; }
    else if (g === 1){ s.ease = Math.max(1.3, s.ease-0.15); s.ivl = Math.max(iv+1, Math.round(iv*1.2)); ms = s.ivl*DAY; }
    else if (g === 2){ s.ivl = Math.max(iv+1, Math.round(iv*s.ease)); ms = s.ivl*DAY; }
    else { s.ease += 0.15; s.ivl = Math.max(iv+2, Math.round(iv*s.ease*1.3)); ms = s.ivl*DAY; }
  }
  return {ms, s};
}
export function fmt(ms){
  if (ms < HOUR) return Math.max(1, Math.round(ms/MIN)) + " min";
  if (ms < DAY) return Math.round(ms/HOUR) + " hr";
  const d = Math.round(ms/DAY);
  if (d < 30) return d + (d === 1 ? " day" : " days");
  if (d < 365) return Math.round(d/30) + " mo";
  return (d/365).toFixed(1) + " yr";
}
export const CONF = [{l:"Low", i:"Guessing"},{l:"Medium", i:"Think so"},{l:"High", i:"Know it"}];
export const gotGrade = conf => [1,2,3][conf ?? 1];
