"use client";

// ===== app/lib/user-context.tsx =====
// Fachada sobre la sesión de Supabase. Mantiene la forma que useUser() tenía
// con el auth falso de SPEC 01, pero el usuario ya no sale de localStorage:
// sale de supabase.auth y el nombre visible de la tabla public.profiles.
//
// Las puntuaciones siguen en localStorage (av_scores) hasta la SPEC 05.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "./supabase/client";

export interface User {
  id: string; // uuid de auth.users
  name: string; // profiles.username, ya en mayúsculas y de ≤10 caracteres
}

export interface StoredScore {
  game: string;
  score: number;
  name: string;
  at: number;
}

interface UserContextValue {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  saveScore: (entry: Omit<StoredScore, "at">) => void;
}

// Residuo del auth falso de SPEC 01: ya no se lee, solo se borra.
const LEGACY_USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Limpia la clave del auth falso para que no queden usuarios fantasma en
  // navegadores que ya visitaron la versión anterior.
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_USER_KEY);
    } catch {
      // localStorage puede estar deshabilitado (modo privado): da igual.
    }
  }, []);

  useEffect(() => {
    // Evita escribir estado si el efecto ya se limpió (el usuario navegó).
    let vigente = true;

    async function sincronizar(authUserId: string | undefined) {
      if (!authUserId) {
        if (vigente) setUser(null);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", authUserId)
        .maybeSingle();

      // El trigger on_auth_user_created siempre crea el perfil, pero si por lo
      // que sea no está, es mejor un nombre de reserva que dejar la sesión sin
      // reflejar en el Nav.
      const username: string = data?.username ?? "JUGADOR";
      if (vigente) setUser({ id: authUserId, name: username });
    }

    // Sesión inicial. getUser() valida el token contra Supabase, a diferencia
    // de getSession(), que se fía de la cookie.
    void supabase.auth.getUser().then(async ({ data }) => {
      await sincronizar(data.user?.id);
      if (vigente) setLoading(false);
    });

    // Altas, bajas y refrescos de token posteriores.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, session) => {
      void sincronizar(session?.user?.id);
    });

    return () => {
      vigente = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // onAuthStateChange también lo hará, pero así el Nav reacciona al instante.
    setUser(null);
  }, [supabase]);

  const saveScore = useCallback((entry: Omit<StoredScore, "at">) => {
    try {
      const all: StoredScore[] = JSON.parse(
        localStorage.getItem(SCORES_KEY) || "[]",
      );
      all.push({ ...entry, at: Date.now() });
      localStorage.setItem(SCORES_KEY, JSON.stringify(all));
    } catch {
      // Ignorar: el guardado es cosmético.
    }
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, signOut, saveScore }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser debe usarse dentro de <UserProvider>");
  return ctx;
}
