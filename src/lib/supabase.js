import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://nhtxpinnvuqpfwnatqre.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5odHhwaW5udnVxcGZ3bmF0cXJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNTM1MDEsImV4cCI6MjA3OTkyOTUwMX0.214hDg97grdATQsnMMVtHHX--TH1O_1fee_4ou6spRk";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseAnonKey, 
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'bettys-auth'
    }
  }
);
