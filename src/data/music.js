import { svgUri } from "./svg.js";

/* =========================================================
   MUSIC NOTES demo deck — 13 treble-clef notes, middle C (C4)
   to A5. Front: the note on a staff (inline SVG). Back: the
   letter and the note's sound. The sounds are made in the
   browser (see toneUrl in SOUNDS), keyed "tone:<note>", so
   there are no audio files to ship.
   ========================================================= */
const TREBLE_CLEF = `<path d='M96 252 C84 256 74 248 78 238 C82 228 98 230 98 242 C99 258 76 262 70 246
 M98 242 L100 200 L104 120 C106 96 112 72 122 58 C130 46 126 34 116 42 C100 56 92 84 94 110
 C96 132 120 140 122 160 C124 186 104 200 86 198 C66 196 58 176 70 160 C80 146 100 148 106 162
 C110 172 102 182 92 180'
 fill='none' stroke='#0f172a' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/>
 <circle cx='80' cy='242' r='7' fill='#0f172a'/>`;
function staffSvg(steps){ // step 0 = E4, the bottom line; each step is one line or space. An array draws a chord on one stem.
  steps = [].concat(steps);
  const lo = Math.min(...steps), hi = Math.max(...steps), x = 290, yOf = st => 190 - st*10, ln = (x1, x2, y1, y2, w = 2) => `<line x1='${x1}' x2='${x2}' y1='${y1}' y2='${y2}' stroke='#0f172a' stroke-width='${w}'/>`;
  let s = "";
  for (let i = 0; i < 5; i++) s += ln(40, 440, 110 + i*20, 110 + i*20);
  s += ln(40, 40, 110, 190) + ln(440, 440, 110, 190);
  for (let ly = 210; ly <= yOf(lo); ly += 20) s += ln(x-22, x+22, ly, ly);   // ledger lines below
  for (let ly = 90; ly >= yOf(hi); ly -= 20) s += ln(x-22, x+22, ly, ly);    // ledger lines above
  s += TREBLE_CLEF + steps.map(st => `<ellipse cx='${x}' cy='${yOf(st)}' rx='12.5' ry='9' transform='rotate(-20 ${x} ${yOf(st)})' fill='#0f172a'/>`).join("");
  // stem up when the notes sit mostly below the middle line (B4, step 4), down otherwise; it spans the whole chord
  s += (lo + hi) / 2 < 4 ? ln(x+11, x+11, yOf(lo)-3, yOf(hi)-70, 2.5) : ln(x-11, x-11, yOf(hi)+3, yOf(lo)+70, 2.5);
  return svgUri(s);
}
const NOTE_INFO = {
  C4:[-2,"Middle C. It sits on its own short ledger line just below the staff."],
  D4:[-1,"D hangs in the space just below the bottom line."],
  E4:[0,"E is the bottom line. Lines from the bottom: Every Good Boy Does Fine (E G B D F)."],
  F4:[1,"F is the first space. Spaces from the bottom spell FACE."],
  G4:[2,"G is the second line. The treble clef's curl wraps around this line, which is why it's also called the G clef."],
  A4:[3,"A is the second space (F-A-C-E). This A is the tuning note, 440 Hz."],
  B4:[4,"B is the middle line. From here up, stems point down."],
  C5:[5,"C is the third space (F-A-C-E), one octave above middle C."],
  D5:[6,"D is the fourth line (Every Good Boy Does Fine)."],
  E5:[7,"E is the top space, the last letter of FACE."],
  F5:[8,"F is the top line, the last word of Every Good Boy Does Fine."],
  G5:[9,"G sits on top of the staff, just above the top line."],
  A5:[10,"A is on the first ledger line above the staff."]
};
const MUSIC_CARDS = ["G4","C4","E5","A4","F4","D5","B4","G5","E4","C5","A5","D4","F5"].map(n => ({
  id:"mu" + n, imgQ:staffSvg(NOTE_INFO[n][0]), q:"Name this note.",
  a:n[0], sndA:"tone:" + n, why:NOTE_INFO[n][1] + ` (${n})`
}));
/* Two-note chords: hear both notes together, see them stacked on the staff, name them. */
const NOTE_PLACE = {C4:"on the ledger line below the staff", D4:"just below the bottom line", E4:"on the bottom line", F4:"in the first space",
  G4:"on the second line", A4:"in the second space", B4:"on the middle line", C5:"in the third space", D5:"on the fourth line"};
const CHORDS = [["C4","E4","a major third"],["E4","G4","a minor third"],["C4","G4","a perfect fifth"],["F4","A4","a major third"],["D4","F4","a minor third"],
  ["G4","D5","a perfect fifth"],["A4","C5","a minor third"],["E4","C5","a minor sixth"],["G4","B4","a major third"],["D4","A4","a perfect fifth"]];
CHORDS.forEach(([lo, hi, iv]) => MUSIC_CARDS.push({
  id:"mc" + lo + hi, imgQ:staffSvg([NOTE_INFO[lo][0], NOTE_INFO[hi][0]]), sndQ:`tone:${lo}+${hi}`,
  q:"Play the chord. Which two notes are in it?", a:`${lo[0]} and ${hi[0]}`,
  why:`${lo[0]} is ${NOTE_PLACE[lo]} and ${hi[0]} is ${NOTE_PLACE[hi]}. Together they make ${iv}. (${lo} + ${hi})`
}));
export const MUSIC = {id:"music", name:"Music Notes", builtin:true, color:"#ca8a04", cards:MUSIC_CARDS,
  sub:"Demo deck: 13 treble-clef notes (middle C to A5) with their sounds, and 10 two-note chords to hear and name"};
