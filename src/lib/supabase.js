import { createClient } from "@supabase/supabase-js";
import { demoClient } from "./demo/client";

const supabaseUrl = "https://nhtxpinnvuqpfwnatqre.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5odHhwaW5udnVxcGZ3bmF0cXJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNTM1MDEsImV4cCI6MjA3OTkyOTUwMX0.214hDg97grdATQsnMMVtHHX--TH1O_1fee_4ou6spRk";

// Demo mode swaps the real client for an in-memory one seeded with synthetic
// data (see ./demo/). It exists so the dashboard can be screenshotted for a
// portfolio without exposing real revenue, payouts, staff wages or customers —
// and because the fake client has no network access, it also makes the
// write-capable screens (menu editor, TV layout editor) safe to click through.
//
//   NEXT_PUBLIC_DEMO=1 npm run dev
//
export const isDemoMode = process.env.NEXT_PUBLIC_DEMO === "1";

export const supabase = isDemoMode
  ? demoClient
  : createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "bettys-auth",
        },
      }
    );
