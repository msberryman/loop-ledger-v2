import { supabase } from "./lib/supabase";


/**
 * Ensure the logged-in user has rows in `profiles` and `settings`.
 * Safe to call repeatedly (uses upsert).
 */
export async function bootstrapUser() {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId) return;

  await supabase
    .from("profiles")
    .upsert({ user_id: userId }, { onConflict: "user_id" });

  await supabase
    .from("settings")
    .upsert({ user_id: userId }, { onConflict: "user_id" });
}
