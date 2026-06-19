import React, { useState } from 'react';
import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to: '/admin',               label: 'Dashboard',    icon: 'dashboard',              perm: 'perm_dashboard' },
  { to: '/admin/estudiantes',   label: 'Estudiantes',  icon: 'school',                 perm: 'perm_estudiantes' },
  { to: '/admin/recursos',      label: 'Recursos',     icon: 'video_library',          perm: 'perm_recursos' },
  { to: '/admin/pedidos',       label: 'Pedidos',      icon: 'movie_edit',             perm: 'perm_pedidos' },
  { to: '/admin/finanzas',      label: 'Finanzas',     icon: 'account_balance_wallet', perm: 'perm_finanzas' },
  { to: '/admin/cupones',       label: 'Cupones',      icon: 'confirmation_number',    perm: 'perm_cupones' },
  { to: '/admin/certificados',  label: 'Certificados', icon: 'workspace_premium',      perm: 'perm_certificados' },
  { to: '/admin/tablero',       label: 'Tablero',      icon: 'view_kanban',            perm: 'perm_tablero' },
  { to: '/admin/configuracion', label: 'Configuración', icon: 'tune',                  perm: 'perm_configuracion' },
];

export default function AdminLayout() {
  const { isAdmin, loading, signOut, permisos, isSuperAdmin } = useAuth();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="material-symbols-outlined text-primary text-4xl animate-spin">refresh</span>
    </div>
  );
  if (!isAdmin) return <Navigate to="/login" replace />;

  // Protección de ruta: si el sub-admin navega a una sección sin permiso → redirigir
  const currentNavItem = NAV.find(n => n.to === pathname);
  if (permisos && !isSuperAdmin && currentNavItem && permisos[currentNavItem.perm] === false) {
    return <Navigate to="/admin" replace />;
  }
  if ((pathname === '/admin/papelera' || pathname === '/admin/perfiles') && !isSuperAdmin) {
    return <Navigate to="/admin" replace />;
  }

  // Filtrar ítems del menú según permisos
  // permisos = null → acceso completo (super admin o admin sin restricciones)
  // permisos = objeto → mostrar solo secciones habilitadas
  const visibleNav = NAV.filter(item =>
    !permisos || isSuperAdmin || permisos[item.perm] !== false
  );

  const pageLabel =
    pathname === '/admin/papelera'  ? 'Papelera' :
    pathname === '/admin/perfiles'  ? 'Gestión de Perfiles' :
    NAV.find(n => n.to === pathname)?.label || 'Admin';

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-surface-container border-r border-outline-variant/20 flex flex-col transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex items-center gap-2 px-6 py-5 border-b border-outline-variant/20">
          <span className="material-symbols-outlined text-primary">movie_edit</span>
          <span className="font-headline font-black text-lg text-primary uppercase tracking-tighter">EDIT MASTER</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {visibleNav.map(item => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-headline text-sm font-bold uppercase tracking-wide transition-all ${
                pathname === item.to
                  ? 'bg-primary/20 text-primary'
                  : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              {item.label}
            </Link>
          ))}

          {isSuperAdmin && (
            <>
              <Link
                to="/admin/perfiles"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-headline text-sm font-bold uppercase tracking-wide transition-all ${
                  pathname === '/admin/perfiles'
                    ? 'bg-secondary/20 text-secondary'
                    : 'text-on-surface-variant hover:bg-secondary/10 hover:text-secondary'
                }`}
              >
                <span className="material-symbols-outlined text-xl">manage_accounts</span>
                Perfiles
              </Link>
              <Link
                to="/admin/papelera"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-headline text-sm font-bold uppercase tracking-wide transition-all ${
                  pathname === '/admin/papelera'
                    ? 'bg-error/20 text-error'
                    : 'text-error/60 hover:bg-error/10 hover:text-error'
                }`}
              >
                <span className="material-symbols-outlined text-xl">delete_sweep</span>
                Papelera
              </Link>
            </>
          )}
        </nav>

        <div className="px-4 py-4 border-t border-outline-variant/20 space-y-1">
          <Link
            to="/"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-on-surface-variant hover:bg-secondary/10 hover:text-secondary font-headline text-sm font-bold uppercase tracking-wide transition-all"
          >
            <span className="material-symbols-outlined text-xl">open_in_new</span>
            Ver sitio público
          </Link>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-on-surface-variant hover:bg-error/10 hover:text-error font-headline text-sm font-bold uppercase tracking-wide transition-all"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        <header className="h-16 bg-surface-container border-b border-outline-variant/20 flex items-center justify-between px-6 sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-on-surface-variant">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <h1 className="font-headline font-bold uppercase tracking-wide text-sm lg:hidden flex-1 ml-3">{pageLabel}</h1>
          <h1 className="font-headline font-bold uppercase tracking-wide text-sm hidden lg:block">{pageLabel}</h1>
          <div className="flex items-center gap-3">
            <Link to="/" className="lg:hidden text-on-surface-variant hover:text-secondary transition-colors" title="Ver sitio público">
              <span className="material-symbols-outlined text-xl">open_in_new</span>
            </Link>
            <span className="material-symbols-outlined text-primary">admin_panel_settings</span>
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest hidden lg:block">
              {isSuperAdmin ? 'Super Admin' : 'Admin'}
            </span>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
