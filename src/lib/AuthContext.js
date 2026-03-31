"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "./supabase";

const AuthContext = createContext({});

// Map page slugs to their route paths.  Slug → path.
const SLUG_TO_PATH = {
  overview: "/",
  sales: "/sales",
  marketing: "/marketing",
  menu: "/menu",
  products: "/products",
  payouts: "/platform-payouts",
  reviews: "/reviews",
  calendar: "/calendar",
  "my-payroll": "/my-payroll",
  payroll: "/payroll",
  settings: "/settings",
};

// Reverse lookup: path → slug
const PATH_TO_SLUG = Object.fromEntries(
  Object.entries(SLUG_TO_PATH).map(([slug, path]) => [path, slug])
);

// Pages that are never shown to employees regardless of page_permissions
const ADMIN_ONLY_SLUGS = new Set(["payroll", "settings"]);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [permissions, setPermissions] = useState(null); // string[] of page slugs, or null while loading
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const router = useRouter();
  const pathname = usePathname();

  // Hold the latest session from onAuthStateChange so the profile-fetch
  // effect can validate auth state WITHOUT calling getSession() — which
  // acquires the same internal lock that INITIAL_SESSION processing holds.
  const sessionRef = useRef(null);

  useEffect(() => {
    let timeoutId;

    if (loading && pathname !== "/login" && !pathname.startsWith("/tv-display")) {
      timeoutId = setTimeout(() => {
        if (loading) {
          handleSignOut("Session timed out. Please log in again.");
          setLoading(false);
        }
      }, 10000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loading, pathname]);

  // Auth listener — synchronous callback only (no async, no DB calls).
  // _notifyAllSubscribers awaits every callback; if this were async and
  // touched getSession() (directly or via a .from() query), it would
  // deadlock against the lock held by _emitInitialSession.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        sessionRef.current = session;

        if (session?.user) {
          setUser((prev) =>
            prev?.id === session.user.id ? prev : session.user
          );
        } else {
          setUser(null);
          setProfile(null);
          setPermissions(null);
          setLoading(false);
          if (pathname !== "/login" && !pathname.startsWith("/tv-display")) {
            router.push("/login");
          }
        }
      }
    );
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Profile fetch — runs in a separate effect AFTER React commits the
  // new user state, guaranteeing that onAuthStateChange has returned and
  // any auth-internal locks have been released.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const fetchProfile = async () => {
      try {
        // Validate we have a real access token before hitting the DB.
        // We read from the ref (set synchronously in onAuthStateChange)
        // instead of calling getSession(), which would acquire the auth
        // lock a second time (the .from() query already acquires it
        // internally via _getAccessToken → getSession).
        //
        // Also catches the edge case where access_token is "" — the
        // Supabase client's _getAccessToken uses ?? (not ||), so an
        // empty string passes through and the gateway rejects with {}.
        const token = sessionRef.current?.access_token;
        if (!token) {
          if (!cancelled) {
            setUser(null);
            setProfile(null);
            setLoading(false);
            router.push("/login");
          }
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error(
            'Profile fetch error:',
            JSON.stringify(error),
            '| If this is "{}", the request likely ran without a valid session token.'
          );
          await supabase.auth.signOut();
          router.push('/login?error=Unable+to+load+your+account');
          return;
        }

        if (!data) {
          console.error('No profile row found for user', user.id);
          await supabase.auth.signOut();
          router.push('/login?error=Unable+to+load+your+account');
          return;
        }

        if (!data.is_active) {
          await supabase.auth.signOut();
          router.push('/login?error=Your+account+has+been+disabled');
          return;
        }

        // Fetch page permissions for non-admin users
        let pageSlugs = [];
        if (data.role !== "admin") {
          const { data: perms, error: permsError } = await supabase
            .from("page_permissions")
            .select("page_slug")
            .eq("user_id", user.id);

          if (permsError) {
            console.error("Permission fetch error:", JSON.stringify(permsError));
          }
          pageSlugs = (perms || []).map((p) => p.page_slug);
        }

        if (cancelled) return;

        setProfile(data);
        setPermissions(pageSlugs);

        // AuthProvider handles all post-login navigation — redirect
        // away from the login page once the profile is loaded.
        if (pathname === "/login") {
          router.push(data.role === "admin" ? "/" : "/calendar");
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        if (!cancelled) {
          await supabase.auth.signOut();
          router.push('/login?error=Unable+to+load+your+account');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProfile();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Route guard — redirect employees away from pages they can't access.
  useEffect(() => {
    if (!profile || !permissions) return;
    if (profile.role === "admin") return;
    if (pathname === "/login") return;

    const slug = PATH_TO_SLUG[pathname];
    if (!slug) return; // unknown route, let Next.js handle 404

    if (ADMIN_ONLY_SLUGS.has(slug) || !permissions.includes(slug)) {
      setToast("You don't have access to this page");
      router.push("/calendar");
    }
  }, [pathname, profile, permissions, router]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const handleSignOut = async (message = null) => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setPermissions(null);
    if (message) {
      router.push(`/login?error=${encodeURIComponent(message)}`);
    } else {
      router.push("/login");
    }
  };

  // Helper: check if a page slug should be visible for the current user
  const canAccess = (slug) => {
    if (!profile) return false;
    if (profile.role === "admin") return true;
    if (ADMIN_ONLY_SLUGS.has(slug)) return false;
    return permissions?.includes(slug) ?? false;
  };

  const value = {
    user,
    profile,
    permissions,
    loading,
    toast,
    canAccess,
    signOut: handleSignOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
