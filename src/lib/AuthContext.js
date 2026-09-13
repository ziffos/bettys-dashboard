"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "./supabase";
import { ADMIN_ONLY_SLUGS, PATH_TO_SLUG, SLUG_TO_PATH, landingSlugFor } from "./access";

const AuthContext = createContext({});

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

    if (loading && pathname !== "/login" && !pathname.startsWith("/tv-display-") && pathname !== "/qr-menu") {
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
          if (pathname !== "/login" && !pathname.startsWith("/tv-display-") && pathname !== "/qr-menu") {
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
          if (data.role === "admin") {
            router.push("/");
          } else {
            const slug = landingSlugFor(pageSlugs);
            if (slug) router.push(SLUG_TO_PATH[slug]);
          }
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
      const landing = landingSlugFor(permissions);
      // Nowhere to send them, so say nothing and let the layout explain. The
      // alternative is bouncing them to a page they also cannot open.
      if (!landing) return;
      const target = SLUG_TO_PATH[landing];
      if (target === pathname) return;
      setToast("You don't have access to this page");
      router.push(target);
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
