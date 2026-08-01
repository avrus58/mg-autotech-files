"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  homepageSessionEvent,
  type HomepageSessionDetail,
} from "@/lib/homepageSessionEvents";

function publishSession(email: string | null) {
  window.dispatchEvent(
    new CustomEvent<HomepageSessionDetail>(homepageSessionEvent, {
      detail: { email },
    })
  );
}

export function HomepageSessionBridge() {
  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) publishSession(data.session?.user.email ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) publishSession(session?.user.email ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
