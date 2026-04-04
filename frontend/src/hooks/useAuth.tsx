"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  getSession,
} from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  register: (email: string, password: string, name: string) => Promise<string | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const initAuth = async () => {
      const { session, error } = await getSession();
      if (!error && session?.user) {
        setToken(session.access_token);
        setUser({
          id: session.user.id,
          email: session.user.email || "",
          name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "",
        });
      }
      setLoading(false);
    };

    initAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        setToken(session.access_token);
        setUser({
          id: session.user.id,
          email: session.user.email || "",
          name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "",
        });
      } else {
        setUser(null);
        setToken(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await signIn(email, password);
    if (error) return (error as any).message || "Login failed";
    if (data?.session) {
      setToken(data.session.access_token);
      setUser({
        id: data.session.user.id,
        email: data.session.user.email || "",
        name: data.session.user.user_metadata?.name || data.session.user.email?.split("@")[0] || "",
      });
      return null;
    }
    return "Login failed";
  };

  const register = async (email: string, password: string, name: string) => {
    const { data, error } = await signUp(email, password, name);
    if (error) return (error as any).message || "Registration failed";
    if (data?.user) {
      // Auto-login after signup
      return await login(email, password);
    }
    return null;
  };

  const logout = async () => {
    await signOut();
    setUser(null);
    setToken(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
