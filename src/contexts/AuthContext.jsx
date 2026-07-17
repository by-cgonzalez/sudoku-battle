import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isFirebaseConfigured } from "../lib/firebase";
import { onAuthChange } from "../lib/auth";
import { RankingService } from "../lib/ranking";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured();
  const rankingService = useMemo(() => (configured ? new RankingService() : null), [configured]);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    const unsub = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await rankingService.ensurePlayerProfile(firebaseUser);
      }
      setLoading(false);
    });

    return unsub;
  }, [configured, rankingService]);

  return (
    <AuthContext.Provider value={{ user, loading, configured, rankingService }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
