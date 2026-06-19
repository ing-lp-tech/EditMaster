import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

const SUPER_ADMIN_EMAIL = 'ing.lp.tech@gmail.com';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null);
  const [perfil, setPerfil]     = useState(null);
  const [permisos, setPermisos] = useState(null);
  const [loading, setLoading]   = useState(true);
  const initDone = useRef(false);

  useEffect(() => {
    const safetyTimeout = setTimeout(() => setLoading(false), 10_000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(safetyTimeout);
      initDone.current = true;
      setUser(session?.user ?? null);
      if (session?.user) fetchAll(session.user);
      else setLoading(false);
    }).catch(() => {
      clearTimeout(safetyTimeout);
      initDone.current = true;
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') return;
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchAll(session.user);
        } else {
          setPerfil(null);
          setPermisos(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  // Auto-logout por inactividad (30 min)
  useEffect(() => {
    if (!user) return;
    const TIMEOUT_MS = 30 * 60 * 1000;
    let timer = setTimeout(() => signOut(), TIMEOUT_MS);
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => signOut(), TIMEOUT_MS); };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [user]);

  async function fetchAll(authUser) {
    const email = authUser.email?.toLowerCase() ?? '';
    const isSuperAdminUser = email === SUPER_ADMIN_EMAIL;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('fetchAll timeout')), 8_000)
    );

    try {
      if (isSuperAdminUser) {
        // Super admin: solo necesita su perfil, tiene acceso total
        const { data } = await Promise.race([
          supabase
            .from('perfiles')
            .select('id, nombre, apellido, email, telefono, rol, activo, created_at')
            .eq('id', authUser.id)
            .single(),
          timeoutPromise,
        ]);
        if (data) setPerfil(data);
        setPermisos(null); // null = acceso completo
      } else {
        // Posible sub-admin: cargar perfil y permisos en paralelo
        const [perfilRes, permRes] = await Promise.race([
          Promise.all([
            supabase
              .from('perfiles')
              .select('id, nombre, apellido, email, telefono, rol, activo, created_at')
              .eq('id', authUser.id)
              .single(),
            supabase
              .from('admin_permisos')
              .select('*')
              .eq('email', email)
              .maybeSingle(),
          ]),
          timeoutPromise,
        ]);
        if (!perfilRes.error && perfilRes.data) setPerfil(perfilRes.data);
        // permRes.data es null si no hay registro → acceso completo (admin viejo sin restricciones)
        setPermisos(permRes?.data ?? null);
      }
    } catch {
      // Timeout o error de red: continuar sin permisos granulares
      setPermisos(null);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password });
  }

  async function signOut(e) {
    if (e?.preventDefault) e.preventDefault();
    setUser(null);
    setPerfil(null);
    setPermisos(null);
    try { await supabase.auth.signOut(); } catch {}
    window.location.href = '/login';
  }

  const isSuperAdmin = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
  const isAdmin =
    isSuperAdmin ||
    perfil?.rol === 'admin' ||
    (!!permisos && permisos.activo !== false) ||
    (ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(user?.email?.toLowerCase()));

  return (
    <AuthContext.Provider value={{ user, perfil, permisos, loading, isAdmin, isSuperAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
