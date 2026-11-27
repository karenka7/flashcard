import "./styles.css";
import { $ } from "./dom.js";
import { route } from "./router.js";
import { loadSounds, sndUrls } from "./media.js";
import { study } from "./views/study.js";
import "./modals/settings.js";
import { initAuth, onAuthChange, currentUser, currentStudent } from "./auth.js";
import { startSync, stopSync, onSyncStatus } from "./sync.js";
import { cameFromSignInLink } from "./supabase.js";
import { renderAccount, syncLine } from "./modals/account.js";
import { toast } from "./ui.js";

window.addEventListener("hashchange", route);
route();
renderAccount();
const idle = () => $("#modal").hidden && study.hidden;   // safe to redraw the screen
onAuthChange(async event => {
  renderAccount();
  if (currentUser() && (event === "SIGNED_IN" || (event === "INITIAL_SESSION" && cameFromSignInLink))) toast("Signed in as " + currentUser().email);
  const s = currentStudent();
  if (!currentUser() || !s){ stopSync(); return; }
  const {uploaded} = await startSync(s.id);
  if (idle()) route();
  if (uploaded) toast("Your progress on this device is now saved to your account");
});
// Keep the account dialog's sync line current while it's open
onSyncStatus(() => { const el = $("#aSync"); if (el && currentStudent()) el.innerHTML = syncLine(); });
initAuth();
loadSounds().then(() => { if (sndUrls.size && $("#modal").hidden && study.hidden) route(); });
