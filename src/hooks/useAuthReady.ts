import { useEffect, useState } from "react";
import type { ApiUser as User } from "@/lib/api-client";
import { supabase } from "@/lib/api-client";
import { withTimeout } from "@/lib/supabase-timeout";

export function useAuthReady() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    withTimeout(supabase.auth.getSession(), "Opening your session", 3_500)
      .then(({ data }) => {
        if (!active) return;
        setUser(data.session?.user ?? null);
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
      })
      .finally(() => {
        if (active) setReady(true);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, ready };
}
