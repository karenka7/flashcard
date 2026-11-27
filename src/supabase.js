import { createClient } from "@supabase/supabase-js";

/* The Supabase client. URL and key come from .env (public values).
   null when they're missing, so the app still works as a local-only demo. */
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/* Read before the client removes it from the address bar: true when this page
   load is someone coming back from the emailed sign-in link. */
export const cameFromSignInLink = new URLSearchParams(location.search).has("code");

export const supabase = url && key
  ? createClient(url, key, {
      auth: {
        // PKCE: the sign-in link comes back with ?code=… in the query string,
        // which stays clear of the app's #today / #cards routing.
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null;
