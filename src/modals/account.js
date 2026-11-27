import { $, esc } from "../dom.js";
import { authAvailable, currentStudent, currentUser, initials, sendSignInLink, signOut } from "../auth.js";
import { closeModal, showModal, toast } from "../ui.js";

/* Header button: "Sign in" when signed out, initials when signed in. */
export function renderAccount(){
  const box = $("#acct"); if (!box) return;
  if (!authAvailable()){ box.innerHTML = `<div class="avatar" title="Demo student">RN</div>`; return; }
  const u = currentUser();
  box.innerHTML = u
    ? `<button class="avatar" id="acctBtn" title="Signed in as ${esc(u.email)}" aria-label="Account">${esc(initials())}</button>`
    : `<button class="btn ghost sm" id="acctBtn">Sign in</button>`;
  $("#acctBtn").onclick = () => currentUser() ? openAccount() : openSignIn();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function openSignIn(){
  showModal(`<h3>Sign in</h3>
    <p class="note">We'll email you a link. Open it on this device and you're signed in, no password needed. New here? The same link creates your account.</p>
    <label class="fl">Email<input id="aEmail" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com"></label>
    <div class="note textred" id="aErr" hidden></div>
    <div class="actions"><button class="btn ghost sm" id="mCancel">Cancel</button><button class="btn sm" id="aSend">Email me a link</button></div>`);
  const email = $("#aEmail"), btn = $("#aSend"), err = $("#aErr");
  email.focus();
  $("#mCancel").onclick = closeModal;
  email.onkeydown = e => { if (e.key === "Enter") btn.click(); };
  btn.onclick = async () => {
    const v = email.value.trim();
    if (!EMAIL_RE.test(v)){ err.textContent = "Enter a valid email address."; err.hidden = false; email.focus(); return; }
    btn.disabled = true; btn.textContent = "Sending…"; err.hidden = true;
    const e = await sendSignInLink(v);
    if (e){
      btn.disabled = false; btn.textContent = "Email me a link";
      err.textContent = signInError(e); err.hidden = false; return;
    }
    showModal(`<h3>Check your email</h3>
      <p class="note">We sent a sign-in link to <b>${esc(v)}</b>. Open it on this device. It can take a minute to arrive; check spam too.</p>
      <div class="actions"><button class="btn sm" id="mDone">OK</button></div>`);
    $("#mDone").onclick = closeModal;
  };
}

function signInError(e){
  const m = String(e.message || e);
  if (e.status === 429 || /rate limit/i.test(m)) return "Too many sign-in emails for now. Wait a while and try again.";
  if (/not authorized/i.test(m)) return "This address can't get sign-in emails yet: during testing, only members of the Supabase project can sign in.";
  return "Couldn't send the link: " + m;
}

export function openAccount(){
  const u = currentUser(), s = currentStudent();
  showModal(`<h3>Your account</h3>
    <p>Signed in as <b>${esc(u.email)}</b>${s && s.display_name ? ` (${esc(s.display_name)})` : ""}</p>
    <p class="note">${s ? "Your account is connected." : "Signed in, but your student record didn't load. Try again later."}
      Progress and decks are still saved in this browser for now; syncing them to your account comes next.</p>
    <div class="actions"><button class="btn ghost sm" id="aOut">Sign out</button><button class="btn sm" id="mDone">Done</button></div>`);
  $("#mDone").onclick = closeModal;
  $("#aOut").onclick = async () => {
    const e = await signOut();
    closeModal();
    toast(e ? "Couldn't sign out: " + e.message : "Signed out");
  };
}
