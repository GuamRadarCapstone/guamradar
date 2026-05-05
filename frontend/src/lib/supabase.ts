import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://emksntzvwxbmkvxbflpe.supabase.co";

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVta3NudHp2d3hibWt2eGJmbHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDM1NzYsImV4cCI6MjA4OTkxOTU3Nn0._Id5yFoqtItKtoqJKTVHtj-GBfUnvQojEfhRQor6T-M";

console.log("SUPABASE URL (prod):", supabaseUrl);
console.log("SUPABASE KEY EXISTS:", !!supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);