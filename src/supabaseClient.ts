// src/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://upehnoqllzmotyzddeoh.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwZWhub3FsbHptb3R5emRkZW9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MjU0NTcsImV4cCI6MjA3ODEwMTQ1N30.WhTaD5FkAu-tBx3Qrw2T8f6HrRMgUzfhIoP8hiu9hl0";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});
