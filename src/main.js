import "./styles.css";
import { $ } from "./dom.js";
import { route } from "./router.js";
import { loadSounds, sndUrls } from "./media.js";
import { study } from "./views/study.js";
import "./modals/settings.js";

window.addEventListener("hashchange", route);
route();
loadSounds().then(() => { if (sndUrls.size && $("#modal").hidden && study.hidden) route(); });
