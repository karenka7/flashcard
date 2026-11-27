import { supabase } from "./supabase.js";

/* Who is signed in. Progress is still saved in the browser (state.js);
   moving it to the database is the next step. */
let user = null, student = null;
const listeners = new Set();

export const authAvailable = () => !!supabase;
export const currentUser = () => user;
export const currentStudent = () => student;
export const onAuthChange = fn => listeners.add(fn);

/* Short label for the header: initials from the name, or the email's first letter. */
export function initials(){
  const name = (student && student.display_name) || (user && user.email) || "";
  const words = name.split(/[\s._@-]+/).filter(Boolean);
  return ((words[0] || "?")[0] + (words.length > 1 && student && student.display_name ? words[1][0] : "")).toUpperCase();
}

async function loadStudent(){
  if (!user){ student = null; return; }
  // Row-level security returns only this person's row.
  const { data, error } = await supabase.from("students").select("id, display_name, time_zone").maybeSingle();
  student = error ? null : data;
}

export function initAuth(){
  if (!supabase) return;
  supabase.auth.onAuthStateChange((event, session) => {
    const next = session ? session.user : null;
    if (event === "TOKEN_REFRESHED" || (next && user && next.id === user.id && event !== "USER_UPDATED")) return;
    user = next;
    // Supabase advises against awaiting its own calls inside this callback, so load the student row just after.
    setTimeout(async () => { await loadStudent(); listeners.forEach(fn => fn(event)); }, 0);
  });
}

/* Email a sign-in link. New addresses get an account on first sign-in.
   The link brings people back to this same page (it must be in the
   project's allowed redirect URLs). */
export async function sendSignInLink(email){
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  return error;
}

export async function signOut(){
  const { error } = await supabase.auth.signOut();
  return error;
}
