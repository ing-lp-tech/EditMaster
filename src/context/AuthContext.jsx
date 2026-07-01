import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

const SUPER_ADMIN_EMAIL = 'ing.lp.tech@gmail.com';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function AuthProvider({ children }) {
  const [user, setUser]             = useState(null);
  const [perfil, setPerfil]         = useState(null);
  const [permisos, setPermisos]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [perfilError, setPerfilError] = useState(false);
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
          setPerfilError(false);
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

  // fetchAll reintenta unas veces: con varias pestañas del sitio abiertas a la
  // vez, Supabase puede rechazar esta consulta por contención del lock de
  // sesión ("Lock ... was released because another request stole it") — es
  // transitorio, no un problema real de la cuenta, así que no hay que
  // rendirse en el primer intento.
  async function fetchAll(authUser, attempt = 1) {
    const MAX_ATTEMPTS = 3;
    const email = authUser.email?.toLowerCase() ?? '';
    const isSuperAdminUser = email === SUPER_ADMIN_EMAIL;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('fetchAll timeout')), 8_000)
    );

    try {
      if (isSuperAdminUser) {
        const { data } = await Promise.race([
          supabase
            .from('perfiles')
            .select('id, nombre, apellido, email, telefono, rol, activo, created_at')
            .eq('id', authUser.id)
            .single(),
          timeoutPromise,
        ]);
        if (!data) throw new Error('perfil vacío');
        setPerfil(data);
        setPermisos(null);
      } else {
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
        if (perfilRes.error || !perfilRes.data) throw perfilRes.error || new Error('perfil vacío');
        setPerfil(perfilRes.data);
        setPermisos(permRes?.data ?? null);
      }
      setPerfilError(false);
      setLoading(false);
    } catch (err) {
      if (attempt < MAX_ATTEMPTS) {
        await sleep(500 * attempt); // 500ms, luego 1000ms
        return fetchAll(authUser, attempt + 1);
      }
      console.error('[AuthContext] No se pudo cargar el perfil tras reintentos:', err?.message);
      setPerfilError(true);
      setLoading(false);
    }
  }

  function retryPerfil() {
    if (!user) return;
    setLoading(true);
    setPerfilError(false);
    fetchAll(user);
  }

  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password });
  }

  async function signOut(e) {
    if (e?.preventDefault) e.preventDefault();
    setUser(null);
    setPerfil(null);
    setPermisos(null);
    setPerfilError(false);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[AuthContext] signOut falló (posible contención de sesión con varias pestañas), limpio local:', err?.message);
    }
    // Aunque signOut() haya fallado del lado del servidor, borramos el token
    // guardado en localStorage a mano — si no, la sesión vieja queda activa
    // y el usuario sigue viéndose "logueado" pese a haber tocado "Salir".
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
        .forEach(k => localStorage.removeItem(k));
    } catch {}
    window.location.href = '/login';
  }

  const isSuperAdmin = user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
  const isAdmin =
    isSuperAdmin ||
    perfil?.rol === 'admin' ||
    (!!permisos && permisos.activo !== false) ||
    (ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(user?.email?.toLowerCase()));

  return (
    <AuthContext.Provider value={{ user, perfil, permisos, loading, perfilError, retryPerfil, isAdmin, isSuperAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
