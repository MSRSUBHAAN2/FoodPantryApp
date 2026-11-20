import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthState {
  session: Session | null;
  loading: boolean;
}
const Ctx = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });
  const qc = useQueryClient();
  useEffect(() => {
    let prevUser: string | null = null;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ session, loading: false });
      const uid = session?.user.id ?? null;
      if (event === "SIGNED_OUT" || (uid && prevUser && uid !== prevUser)) {
        qc.clear();
        if (prevUser) localStorage.removeItem(`uiu-offline-${prevUser}`);
      }
      prevUser = uid;
    });
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }));
    return () => sub.subscription.unsubscribe();
  }, [qc]);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
export function useUserId(): string {
  // Empty until signed in; queries stay disabled and AppShell shows sign-in.
  return useAuth().session?.user.id ?? "";
}
