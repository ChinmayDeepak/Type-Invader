import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { supabase } from "../api/supabase.js";

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    // Supabase requests inside the auth callback can deadlock its lock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const ticket = ++generation.current;
      if (!session) {
        setUser(null); setLoading(false); setSessionError("");
        return;
      }
      setTimeout(() => {
        if (!active || ticket !== generation.current) return;
        api.me().then(me => {
          if (active && ticket === generation.current) { setUser(me); setSessionError(""); }
        }).catch(error => {
          if (active && ticket === generation.current) { setUser(null); setSessionError(error.message); }
        }).finally(() => {
          if (active && ticket === generation.current) setLoading(false);
        });
      }, 0);
    });
    return () => { active = false; ++generation.current; subscription.unsubscribe(); };
  }, []);
  async function refreshUser() {
    const me = await api.me();
    setUser(me); setSessionError("");
    return me;
  }
  async function login(credentials) {
    await api.login(credentials);
    return refreshUser();
  }
  async function register(form) {
    const data = await api.register(form);
    if (!data.session) return { confirmationRequired: true };
    await refreshUser();
    return { confirmationRequired: false };
  }
  async function logout() {
    if (supabase) {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    }
    ++generation.current; setUser(null); setSessionError("");
  }
  return <AuthContext.Provider value={{ user, loading, sessionError, login, register, logout, refreshUser, isAdmin: user?.role === "ADMIN" }}>
    {children}
  </AuthContext.Provider>;
}
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
