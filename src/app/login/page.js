"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { Loader2 } from "lucide-react";
import LoginBackdrop from "./LoginBackdrop";

// useSearchParams opts the subtree out of prerendering, so the form sits behind
// its own boundary and the page shell can still be static.
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-canvas flex items-center justify-center text-subtle">
          <Loader2 size={24} className="animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(errorParam || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError("Invalid login credentials");
      // On success, AuthProvider's onAuthStateChange handles the redirect.
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const field =
    "w-full h-10 px-3 border border-line rounded-md bg-surface text-[13px] text-ink placeholder:text-faint outline-none focus:border-ink-strong transition-colors";

  return (
    <div className="relative min-h-screen bg-canvas overflow-hidden flex flex-col justify-center px-4 py-12">
      <LoginBackdrop />
      <div className="relative mx-auto w-full max-w-[380px]">
        <div className="flex flex-col items-center gap-4 mb-8">
          <Image
            src="/images/betty_logo.png"
            alt="Betty's"
            width={48}
            height={48}
            className="w-12 h-12 object-contain rounded-lg"
          />
          <div className="text-center">
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] leading-tight">
              Betty&apos;s Crispy Chicken
            </h1>
            <p className="mt-1.5 font-mono text-[10px] tracking-[0.06em] text-subtle uppercase">
              Dashboard · Limassol
            </p>
          </div>
        </div>

        <div
          className="bg-surface border border-line rounded-xl p-6"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <form className="flex flex-col gap-3.5" onSubmit={handleLogin}>
            <div>
              <label
                htmlFor="email"
                className="block font-mono text-[10px] tracking-[0.06em] text-muted uppercase mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
                placeholder="you@bettyscrispy.cy"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block font-mono text-[10px] tracking-[0.06em] text-muted uppercase mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={field}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-[12px] text-danger bg-[rgba(238,0,0,0.04)] border border-[rgba(238,0,0,0.15)] rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 h-10 w-full flex items-center justify-center rounded-md bg-ink-strong text-surface text-[13px] font-medium hover:bg-ink disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-[12px] text-subtle">
          Ask Betty if you need an account.
        </p>
      </div>
    </div>
  );
}
