import "./styles.css";
import { $ } from "./dom.js";
import { route } from "./router.js";
import { loadSounds, sndUrls } from "./media.js";
import { study } from "./views/study.js";
import "./modals/settings.js";
import { initAuth, onAuthChange, currentUser } from "./auth.js";
import { cameFromSignInLink } from "./supabase.js";
import { renderAccount } from "./modals/account.js";
import { toast } from "./ui.js";

window.addEventListener("hashchange", route);
route();
renderAccount();
onAuthChange(event => {
  renderAccount();
  if (currentUser() && (event === "SIGNED_IN" || (event === "INITIAL_SESSION" && cameFromSignInLink))) toast("Signed in as " + currentUser().email);
});
initAuth();
loadSounds().then(() => { if (sndUrls.size && $("#modal").hidden && study.hidden) route(); });
