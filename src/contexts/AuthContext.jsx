import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isFirebaseConfigured } from "../lib/firebase";
import { getCurrentUser, onAuthChange } from "../lib/auth";
import { RankingService } from "../lib/ranking";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileRevision, setProfileRevision] = useState(0);
  const configured = isFirebaseConfigured();
  const rankingService = useMemo(() => (configured ? new RankingService() : null), [configured]);

  const refreshUser = useCallback(async () => {
    const current = getCurrentUser();
    if (!current) {
      setUser(null);
      return null;
    }
    await current.reload();
    setUser(getCurrentUser());
    setProfileRevision((n) => n + 1);
    return getCurrentUser();
  }, []);

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
    <AuthContext.Provider
      value={{ user, loading, configured, rankingService, refreshUser, profileRevision }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
