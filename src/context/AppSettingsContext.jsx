import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const DEFAULTS = {
  precio_base: 350000,
  precio_tachado: 500000,
  fecha_inicio: '15 de Abril',
  test_mode_mp: false,
  site_url: 'https://www.editmaster.co',
  plan_prueba_activo: false,
  plan_prueba_precio: 100000,
};

const AppSettingsContext = createContext({ ...DEFAULTS, loaded: false, refetch: () => {} });

function parseSettings(data) {
  const map = Object.fromEntries(data.map(r => [r.id, r.value]));
  const result = {
    precio_base:         map.precio_base         ? Number(map.precio_base)         : DEFAULTS.precio_base,
    precio_tachado:      map.precio_tachado      ? Number(map.precio_tachado)      : DEFAULTS.precio_tachado,
    fecha_inicio:        map.fecha_inicio        || DEFAULTS.fecha_inicio,
    test_mode_mp:        map.test_mode_mp === true || map.test_mode_mp === 'true',
    site_url:            map.site_url            || DEFAULTS.site_url,
    plan_prueba_activo:  map.plan_prueba_activo === true || map.plan_prueba_activo === 'true',
    plan_prueba_precio:  map.plan_prueba_precio  ? Number(map.plan_prueba_precio)  : DEFAULTS.plan_prueba_precio,
  };
  console.log('[AppSettings] parseSettings:', { map, result });
  return result;
}

export function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  const refetch = useCallback(() => {
    supabase
      .from('app_settings')
      .select('id, value')
      .then(({ data }) => {
        if (data) setSettings(parseSettings(data));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return (
    <AppSettingsContext.Provider value={{ ...settings, loaded, refetch }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
