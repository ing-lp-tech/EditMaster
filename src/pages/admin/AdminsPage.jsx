import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAppSettings } from '../../context/AppSettingsContext';
import { supabase } from '../../lib/supabase';

const SECCIONES = [
  { key: 'perm_dashboard',     label: 'Dashboard',    icon: 'dashboard' },
  { key: 'perm_estudiantes',   label: 'Estudiantes',  icon: 'school' },
  { key: 'perm_recursos',      label: 'Recursos',     icon: 'video_library' },
  { key: 'perm_pedidos',       label: 'Pedidos',      icon: 'movie_edit' },
  { key: 'perm_finanzas',      label: 'Finanzas',     icon: 'account_balance_wallet' },
  { key: 'perm_cupones',       label: 'Cupones',      icon: 'confirmation_number' },
  { key: 'perm_certificados',  label: 'Certificados', icon: 'workspace_premium' },
  { key: 'perm_tablero',       label: 'Tablero',      icon: 'view_kanban' },
  { key: 'perm_configuracion', label: 'Configuración', icon: 'tune' },
];

const PAISES = [
  { code: '+54',  flag: '🇦🇷', name: 'Argentina' },
  { code: '+598', flag: '🇺🇾', name: 'Uruguay' },
  { code: '+56',  flag: '🇨🇱', name: 'Chile' },
  { code: '+55',  flag: '🇧🇷', name: 'Brasil' },
  { code: '+52',  flag: '🇲🇽', name: 'México' },
  { code: '+57',  flag: '🇨🇴', name: 'Colombia' },
  { code: '+595', flag: '🇵🇾', name: 'Paraguay' },
  { code: '+51',  flag: '🇵🇪', name: 'Perú' },
  { code: '+593', flag: '🇪🇨', name: 'Ecuador' },
  { code: '+58',  flag: '🇻🇪', name: 'Venezuela' },
  { code: '+34',  flag: '🇪🇸', name: 'España' },
  { code: '+1',   flag: '🇺🇸', name: 'EE.UU. / Canadá' },
];

const DEFAULT_FORM = {
  email:              '',
  nombre:             '',
  password:           '',
  cod_pais:           '+54',
  telefono:           '',
  activo:             true,
  perm_dashboard:     true,
  perm_estudiantes:   true,
  perm_recursos:      true,
  perm_pedidos:       true,
  perm_finanzas:      false,
  perm_cupones:       false,
  perm_certificados:  true,
  perm_tablero:       true,
  perm_configuracion: false,
  puede_eliminar:     false,
};

function Toggle({ checked, onChange, colorOn = 'bg-primary' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? colorOn : 'bg-outline-variant'}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function buildMessage(nombre, email, password, adminUrl) {
  const emailLine = email ? `\nUsuario: ${email}` : '';
  const passwordLine = password ? `\nContraseña: ${password}` : '';
  return `Hola ${nombre || ''}! Te dimos de alta como administrador en Edit Master. Podés ingresar al panel en: ${adminUrl}${emailLine}${passwordLine}`;
}

function buildWhatsappUrl(codPais, telefono, nombre, adminUrl, password, email) {
  const numLimpio = telefono.replace(/\D/g, '').replace(/^0+/, '');
  const fullNum = `${codPais.replace('+', '')}${numLimpio}`;
  const msg = buildMessage(nombre, email, password, adminUrl);
  return `https://wa.me/${fullNum}?text=${encodeURIComponent(msg)}`;
}

export default function AdminsPage() {
  const { isSuperAdmin } = useAuth();
  const { site_url } = useAppSettings();
  const [perfiles, setPerfiles]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [toggling, setToggling]   = useState(null);
  const [deleting, setDeleting]   = useState(null);
  const [modal, setModal]         = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm]           = useState(DEFAULT_FORM);
  const [error, setError]         = useState('');
  const [messageModal, setMessageModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState('');

  useEffect(() => {
    if (isSuperAdmin) fetchPerfiles();
  }, [isSuperAdmin]);

  if (!isSuperAdmin) return <Navigate to="/admin" replace />;

  async function fetchPerfiles() {
    setLoading(true);
    const { data } = await supabase
      .from('admin_permisos')
      .select('*')
      .order('created_at', { ascending: true });
    setPerfiles(data || []);
    setLoading(false);
  }

  function openAdd() {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setError('');
    setModal(true);
  }

  function openEdit(p) {
    setEditingId(p.id);
    setForm({
      email:              p.email,
      password:           p.password || '',
      nombre:             p.nombre || '',
      cod_pais:           p.cod_pais || '+54',
      telefono:           p.telefono || '',
      activo:             p.activo ?? true,
      perm_dashboard:     p.perm_dashboard,
      perm_estudiantes:   p.perm_estudiantes,
      perm_recursos:      p.perm_recursos,
      perm_pedidos:       p.perm_pedidos,
      perm_finanzas:      p.perm_finanzas,
      perm_cupones:       p.perm_cupones,
      perm_certificados:  p.perm_certificados,
      perm_tablero:       p.perm_tablero,
      perm_configuracion: p.perm_configuracion,
      puede_eliminar:     p.puede_eliminar,
    });
    setError('');
    setModal(true);
  }

  async function handleSave() {
    if (!form.email.trim()) { setError('El email es obligatorio.'); return; }
    if (!editingId && !form.password.trim()) { setError('La contraseña es obligatoria.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, email: form.email.trim().toLowerCase() };
      const result = editingId
        ? await supabase.from('admin_permisos').update(payload).eq('id', editingId)
        : await supabase.from('admin_permisos').insert(payload);
      if (result.error) throw result.error;
      
      // Si es nuevo perfil, crear usuario en Supabase Auth
      if (!editingId) {
        try {
          const authResponse = await fetch('/api/create-admin-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: form.email.trim().toLowerCase(),
              password: form.password.trim(),
            }),
          });
          const authData = await authResponse.json();
          if (!authResponse.ok) {
            throw new Error(authData.error || 'Error creando usuario en Auth');
          }
        } catch (authErr) {
          console.error('Error creando usuario en Auth:', authErr);
          setError(`Perfil creado, pero error en Auth: ${authErr.message}`);
          setSaving(false);
          return;
        }
      }
      
      setModal(false);
      await fetchPerfiles();
    } catch (err) {
      setError(
        err.message?.includes('duplicate')
          ? 'Ya existe un perfil con ese email.'
          : err.message || 'Error al guardar.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActivo(p) {
    setToggling(p.id);
    await supabase.from('admin_permisos').update({ activo: !p.activo }).eq('id', p.id);
    setToggling(null);
    await fetchPerfiles();
  }

  async function handleDelete(id, nombre) {
    if (!confirm(`¿Eliminar el perfil de "${nombre || 'este admin'}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(id);
    await supabase.from('admin_permisos').delete().eq('id', id);
    setDeleting(null);
    await fetchPerfiles();
  }

  const activeCount = (p) => SECCIONES.filter(s => p[s.key]).length;
  const hasPhone = (p) => p.telefono?.replace(/\D/g, '').length > 4;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-headline text-2xl font-bold">Gestión de Perfiles</h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Crea perfiles de acceso con permisos específicos por sección. Solo visible para el super admin.
          </p>
        </div>
        <button onClick={openAdd} className="btn-primary shrink-0">
          <span className="material-symbols-outlined text-xl">person_add</span>
          Agregar Perfil
        </button>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined text-primary text-3xl animate-spin">refresh</span>
          </div>
        ) : perfiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant/40">manage_accounts</span>
            <p className="font-headline font-bold text-on-surface">No hay perfiles creados</p>
            <p className="text-on-surface-variant text-sm max-w-xs">
              Agrega perfiles con permisos específicos por sección.
            </p>
            <button onClick={openAdd} className="btn-primary mt-2">
              <span className="material-symbols-outlined text-xl">person_add</span>
              Crear primer perfil
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-outline-variant/20">
                  <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Perfil</th>
                  <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Secciones</th>
                  <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Eliminar</th>
                  <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Activo</th>
                  <th className="text-right px-5 py-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {perfiles.map(p => (
                  <tr key={p.id} className={`transition-colors ${p.activo ? 'hover:bg-surface-variant/30' : 'opacity-50 hover:opacity-70'}`}>

                    {/* Nombre + email + wssp */}
                    <td className="px-5 py-4 min-w-[180px]">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-on-surface">{p.nombre || '—'}</p>
                        <span
                          className={`inline-block w-2 h-2 rounded-full shrink-0 ${p.activo ? 'bg-green-500' : 'bg-error'}`}
                          title={p.activo ? 'Activo' : 'Inactivo'}
                        />
                      </div>
                      <p className="text-on-surface-variant text-xs mt-0.5 break-all">{p.email}</p>
                      {hasPhone(p) && (
                        <p className="text-on-surface-variant/60 text-xs mt-0.5 font-mono">
                          {p.cod_pais} {p.telefono}
                        </p>
                      )}
                    </td>

                    {/* Secciones */}
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {SECCIONES.map(s =>
                          p[s.key] ? (
                            <span key={s.key} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-primary/15 text-primary">
                              {s.label}
                            </span>
                          ) : null
                        )}
                      </div>
                      <p className="text-on-surface-variant/50 text-xs mt-1">{activeCount(p)} de {SECCIONES.length}</p>
                    </td>

                    {/* Puede eliminar */}
                    <td className="px-4 py-4 text-center">
                      {p.puede_eliminar
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-error/15 text-error"><span className="material-symbols-outlined text-sm">delete</span>Sí</span>
                        : <span className="text-on-surface-variant/30 text-xs font-bold">No</span>
                      }
                    </td>

                    {/* Toggle activo */}
                    <td className="px-4 py-4 text-center">
                      {toggling === p.id
                        ? <span className="material-symbols-outlined text-on-surface-variant animate-spin text-lg">refresh</span>
                        : <Toggle checked={p.activo ?? true} onChange={() => handleToggleActivo(p)} colorOn="bg-green-500" />
                      }
                    </td>

                    {/* Acciones: wssp + editar + eliminar */}
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {hasPhone(p) ? (
                          <a
                            href={buildWhatsappUrl(p.cod_pais, p.telefono, p.nombre, site_url, p.password, p.email)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg text-on-surface-variant hover:bg-green-500/10 hover:text-green-500 transition-all"
                            title="Enviar WhatsApp"
                          >
                            {/* WhatsApp SVG icon */}
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </a>
                        ) : (
                          <button
                            onClick={() => {
                              const msg = buildMessage(p.nombre, p.email, p.password, site_url);
                              setSelectedMessage(msg);
                              setMessageModal(true);
                            }}
                            className="p-2 rounded-lg text-on-surface-variant hover:bg-green-500/10 hover:text-green-500 transition-all"
                            title="Ver mensaje para enviar"
                          >
                            {/* WhatsApp SVG icon */}
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(p)}
                          className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-variant hover:text-on-surface transition-all"
                          title="Editar permisos"
                        >
                          <span className="material-symbols-outlined text-xl">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, p.nombre)}
                          disabled={deleting === p.id}
                          className="p-2 rounded-lg text-on-surface-variant hover:bg-error/10 hover:text-error transition-all disabled:opacity-40"
                          title="Eliminar perfil"
                        >
                          <span className={`material-symbols-outlined text-xl ${deleting === p.id ? 'animate-spin' : ''}`}>
                            {deleting === p.id ? 'refresh' : 'delete'}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container rounded-2xl border border-outline-variant/30 w-full max-w-lg max-h-[90vh] flex flex-col">

            <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/20 shrink-0">
              <h2 className="font-headline font-bold text-lg">{editingId ? 'Editar Perfil' : 'Nuevo Perfil'}</h2>
              <button onClick={() => setModal(false)} className="text-on-surface-variant hover:text-on-surface transition-colors p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              {/* Email */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  disabled={!!editingId}
                  className="input-field disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="admin@ejemplo.com"
                />
                {!editingId && (
                  <p className="text-xs text-on-surface-variant mt-1.5">La persona debe tener una cuenta registrada con este email.</p>
                )}
              </div>

              {/* Nombre */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Nombre (opcional)</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  className="input-field"
                  placeholder="Nombre del perfil"
                />
              </div>

              {/* Contraseña - solo para crear nuevo */}
              {!editingId && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Contraseña *</label>
                  <input
                    type="text"
                    value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    className="input-field"
                    placeholder="Ej: Edit2024Master"
                  />
                  <p className="text-xs text-on-surface-variant mt-1.5">Se incluirá en el mensaje de WhatsApp.</p>
                </div>
              )}

              {/* WhatsApp */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
                  WhatsApp (opcional)
                </label>
                <div className="flex gap-2">
                  <select
                    value={form.cod_pais}
                    onChange={e => setForm(p => ({ ...p, cod_pais: e.target.value }))}
                    className="input-field w-auto shrink-0 pr-8"
                  >
                    {PAISES.map(p => (
                      <option key={p.code} value={p.code}>
                        {p.flag} {p.code} {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    value={form.telefono}
                    onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
                    className="input-field flex-1"
                    placeholder="Número sin código"
                  />
                </div>
                {form.telefono.replace(/\D/g, '').length > 4 ? (
                  <a
                    href={buildWhatsappUrl(form.cod_pais, form.telefono, form.nombre, site_url, form.password, form.email)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-green-500 hover:text-green-400 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Probar número
                  </a>
                ) : (
                  <button
                    onClick={() => {
                      const msg = buildMessage(form.nombre, form.email, form.password, site_url);
                      setSelectedMessage(msg);
                      setMessageModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-green-500 hover:text-green-400 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Ver mensaje
                  </button>
                )}
              </div>

              {/* Estado activo */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-variant/40">
                <div>
                  <p className="font-headline text-sm font-bold uppercase tracking-wide">Perfil activo</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">Si está desactivado, no podrá acceder al panel.</p>
                </div>
                <Toggle checked={form.activo} onChange={() => setForm(p => ({ ...p, activo: !p.activo }))} colorOn="bg-green-500" />
              </div>

              {/* Permisos por sección */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-3">Acceso por sección</label>
                <div className="space-y-2">
                  {SECCIONES.map(s => (
                    <label key={s.key} className="flex items-center justify-between p-3 rounded-xl bg-surface-variant/40 hover:bg-surface-variant/70 cursor-pointer transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-lg text-on-surface-variant">{s.icon}</span>
                        <span className="font-headline text-sm font-bold uppercase tracking-wide">{s.label}</span>
                      </div>
                      <Toggle checked={form[s.key]} onChange={() => setForm(p => ({ ...p, [s.key]: !p[s.key] }))} />
                    </label>
                  ))}
                </div>
              </div>

              {/* Puede eliminar */}
              <div className="border border-error/25 rounded-xl p-4 bg-error/5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-headline text-sm font-bold uppercase tracking-wide text-error">Puede eliminar registros</p>
                    <p className="text-xs text-on-surface-variant mt-1">Permite borrar elementos en las secciones habilitadas.</p>
                  </div>
                  <Toggle checked={form.puede_eliminar} onChange={() => setForm(p => ({ ...p, puede_eliminar: !p.puede_eliminar }))} colorOn="bg-error" />
                </div>
              </div>

              {error && (
                <div className="bg-error/10 border border-error/30 rounded-lg px-4 py-3 text-sm text-error">{error}</div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-outline-variant/20 shrink-0">
              <button
                onClick={handleSave}
                disabled={!form.email.trim() || (!editingId && !form.password.trim()) || saving}
                className="btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving
                  ? <><span className="material-symbols-outlined text-sm animate-spin">refresh</span>Guardando...</>
                  : <><span className="material-symbols-outlined text-sm">save</span>{editingId ? 'Guardar Cambios' : 'Crear Perfil'}</>
                }
              </button>
              <button onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
            </div>

          </div>
        </div>
      )}

      {/* Modal para mostrar mensaje de WhatsApp */}
      {messageModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container rounded-2xl border border-outline-variant/30 w-full max-w-lg max-h-[90vh] flex flex-col">

            <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/20 shrink-0">
              <h2 className="font-headline font-bold text-lg">Mensaje para enviar</h2>
              <button onClick={() => setMessageModal(false)} className="text-on-surface-variant hover:text-on-surface transition-colors p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5">
              <div className="bg-surface-variant/40 rounded-lg p-4 whitespace-pre-wrap break-words text-sm font-mono">
                {selectedMessage}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedMessage);
                  alert('Mensaje copiado al portapapeles');
                }}
                className="w-full mt-4 btn-primary justify-center"
              >
                <span className="material-symbols-outlined text-sm">content_copy</span>
                Copiar Mensaje
              </button>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-outline-variant/20 shrink-0">
              <button onClick={() => setMessageModal(false)} className="btn-secondary flex-1">Cerrar</button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
