import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const TIPOS_VIDEO = [
  { value: 'reel',     label: 'Reel de Instagram',  icon: 'photo_camera' },
  { value: 'tiktok',   label: 'TikTok',             icon: 'music_note' },
  { value: 'short',    label: 'YouTube Short',      icon: 'smart_display' },
  { value: 'story',    label: 'Story / Estado',     icon: 'circle' },
  { value: 'largo',    label: 'Video largo',        icon: 'movie' },
  { value: 'otro',     label: 'Otro',               icon: 'more_horiz' },
];

const DURACIONES = [
  { value: '15s',  label: 'Hasta 15 seg' },
  { value: '30s',  label: 'Hasta 30 seg' },
  { value: '60s',  label: 'Hasta 60 seg' },
  { value: '90s',  label: 'Hasta 90 seg' },
  { value: '3min', label: 'Hasta 3 min'  },
  { value: '5min+', label: 'Más de 5 min' },
];

const ESTILOS = [
  { value: 'cinematico',    label: 'Cinematic',             icon: 'theaters' },
  { value: 'dinamico',      label: 'Dinámico / Energético', icon: 'bolt' },
  { value: 'minimalista',   label: 'Minimalista',           icon: 'crop_square' },
  { value: 'vintage',       label: 'Vintage / Film',        icon: 'filter_vintage' },
  { value: 'motion',        label: 'Motion Graphics',       icon: 'blur_on' },
  { value: 'color_oscuro',  label: 'Color Grading Oscuro',  icon: 'tonality' },
  { value: 'transiciones',  label: 'Transiciones Creativas',icon: 'swap_horiz' },
  { value: 'subtitulos',    label: 'Con Subtítulos',        icon: 'subtitles' },
  { value: 'musica',        label: 'Con Música / Beat Sync',icon: 'headphones' },
];

const EMPTY = {
  nombre: '', apellido: '', whatsapp: '',
  tipo_video: '', duracion_max: '',
  descripcion: '', estilos: [],
  link_material: '', referencia_url: '',
};

export default function EdicionServicioPage() {
  const [form, setForm] = useState(EMPTY);
  const [estado, setEstado] = useState('idle'); // idle | loading | success | error
  const [errMsg, setErrMsg] = useState('');

  function change(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function toggleEstilo(val) {
    setForm(prev => ({
      ...prev,
      estilos: prev.estilos.includes(val)
        ? prev.estilos.filter(e => e !== val)
        : [...prev.estilos, val],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.tipo_video) return setErrMsg('Seleccioná el tipo de video.');
    if (!form.duracion_max) return setErrMsg('Seleccioná la duración máxima.');
    if (!form.link_material) return setErrMsg('Pegá el link con tu material de video.');
    setEstado('loading');
    setErrMsg('');

    const { error } = await supabase.from('pedidos_edicion').insert({
      nombre:         form.nombre.trim(),
      apellido:       form.apellido.trim(),
      whatsapp:       form.whatsapp.trim(),
      tipo_video:     form.tipo_video,
      duracion_max:   form.duracion_max,
      descripcion:    form.descripcion.trim(),
      estilos:        form.estilos,
      link_material:  form.link_material.trim(),
      referencia_url: form.referencia_url.trim() || null,
    });

    if (error) {
      setEstado('error');
      setErrMsg('Error al enviar. Intentá de nuevo o escribinos por WhatsApp.');
    } else {
      setEstado('success');
    }
  }

  if (estado === 'success') {
    const wa = `https://wa.me/5491162020911?text=${encodeURIComponent(
      `Hola! Acabo de enviar mi pedido de edición de video como ${form.nombre} ${form.apellido}. Quedo a disposición para coordinar la cotización.`
    )}`;
    return (
      <div className="min-h-screen flex items-center justify-center px-6 pt-16 pb-32">
        <div className="text-center max-w-md space-y-6">
          <span className="material-symbols-outlined text-secondary text-8xl">check_circle</span>
          <h2 className="font-headline text-4xl font-black">¡Pedido recibido!</h2>
          <p className="text-on-surface-variant text-lg leading-relaxed">
            Recibimos tu solicitud de edición. Te contactamos a la brevedad por WhatsApp para enviarte la cotización.
          </p>
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="btn-primary inline-flex items-center gap-3 text-base px-8 py-4 justify-center"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current shrink-0">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Escribirnos por WhatsApp
          </a>
          <button
            onClick={() => { setForm(EMPTY); setEstado('idle'); }}
            className="block text-sm text-on-surface-variant hover:text-primary transition-colors mx-auto"
          >
            Enviar otro pedido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-32 px-6 lg:px-20 relative">
      {/* BG glow */}
      <div className="absolute top-32 right-0 w-[500px] h-[400px] bg-primary/5 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary/5 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-3xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 mb-5">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-secondary font-label text-[10px] uppercase tracking-[0.2em] font-bold">Servicio de Edición</span>
          </div>
          <h1 className="font-headline text-4xl md:text-6xl font-black tracking-tight mb-5">
            Pedí tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">edición profesional</span>
          </h1>
          <p className="text-on-surface-variant text-lg max-w-xl mx-auto leading-relaxed">
            Completá el formulario con los datos de tu video. Te enviamos una cotización personalizada por WhatsApp.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Bloque 1: Contacto */}
          <div className="card border border-outline-variant/20 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-headline font-black text-xs">1</span>
              <h2 className="font-headline font-bold uppercase tracking-widest text-sm">Tu contacto</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Nombre *</label>
                <input type="text" name="nombre" required value={form.nombre} onChange={change}
                  className="input-field" placeholder="Juan" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">Apellido *</label>
                <input type="text" name="apellido" required value={form.apellido} onChange={change}
                  className="input-field" placeholder="García" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">WhatsApp *</label>
              <input type="tel" name="whatsapp" required value={form.whatsapp} onChange={change}
                className="input-field" placeholder="+54 11 0000-0000" />
              <p className="text-[11px] text-on-surface-variant mt-1.5">Te contactamos por aquí para enviarte la cotización.</p>
            </div>
          </div>

          {/* Bloque 2: Tu video */}
          <div className="card border border-outline-variant/20 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-7 h-7 rounded-full bg-secondary/20 text-secondary flex items-center justify-center font-headline font-black text-xs">2</span>
              <h2 className="font-headline font-bold uppercase tracking-widest text-sm">Tu video</h2>
            </div>

            {/* Tipo de video */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-3">
                ¿Para qué plataforma es? *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {TIPOS_VIDEO.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, tipo_video: t.value }))}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                      form.tipo_video === t.value
                        ? 'border-secondary bg-secondary/10 text-secondary'
                        : 'border-outline-variant/20 bg-surface-container hover:border-outline-variant/50 text-on-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg shrink-0">{t.icon}</span>
                    <span className="font-label text-xs font-bold">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Duración */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-3">
                Duración máxima del resultado *
              </label>
              <div className="flex flex-wrap gap-2">
                {DURACIONES.map(d => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, duracion_max: d.value }))}
                    className={`px-4 py-2 rounded-full border font-label font-bold text-xs transition-all ${
                      form.duracion_max === d.value
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-outline-variant/30 bg-surface-container text-on-surface-variant hover:border-outline-variant/60'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Descripción */}
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
                ¿De qué trata el video? ¿Qué querés comunicar? *
              </label>
              <textarea
                name="descripcion"
                required
                rows={4}
                value={form.descripcion}
                onChange={change}
                className="input-field resize-none"
                placeholder="Ej: Es un Reel para mi emprendimiento de ropa. Quiero mostrar tres looks con música energética y transiciones rápidas. El público es mujer de 18-30 años..."
              />
            </div>
          </div>

          {/* Bloque 3: Estilo */}
          <div className="card border border-outline-variant/20 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-7 h-7 rounded-full bg-tertiary/20 text-tertiary flex items-center justify-center font-headline font-black text-xs">3</span>
              <h2 className="font-headline font-bold uppercase tracking-widest text-sm">Estilo que buscás</h2>
              <span className="text-[10px] text-on-surface-variant font-label uppercase tracking-wider">(elegí varios)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {ESTILOS.map(s => {
                const sel = form.estilos.includes(s.value);
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleEstilo(s.value)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
                      sel
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-outline-variant/30 bg-surface-container text-on-surface-variant hover:border-outline-variant/60'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">{s.icon}</span>
                    <span className="font-label text-xs font-bold">{s.label}</span>
                    {sel && <span className="material-symbols-outlined text-xs">check</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bloque 4: Material */}
          <div className="card border border-outline-variant/20 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-headline font-black text-xs">4</span>
              <h2 className="font-headline font-bold uppercase tracking-widest text-sm">Tu material</h2>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
                Link a tus videos / fotos *
              </label>
              <input
                type="url"
                name="link_material"
                required
                value={form.link_material}
                onChange={change}
                className="input-field"
                placeholder="https://drive.google.com/... o wetransfer.com/..."
              />
              <p className="text-[11px] text-on-surface-variant mt-2 leading-relaxed">
                Subí tus archivos a Google Drive, WeTransfer o Dropbox y pegá el link compartido aquí. Asegurate de que cualquier persona con el link pueda ver los archivos.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant block mb-2">
                Video de referencia <span className="text-outline normal-case tracking-normal">(opcional)</span>
              </label>
              <input
                type="url"
                name="referencia_url"
                value={form.referencia_url}
                onChange={change}
                className="input-field"
                placeholder="https://www.instagram.com/reel/... o youtube.com/watch?v=..."
              />
              <p className="text-[11px] text-on-surface-variant mt-1.5">
                Si hay un video que te gusta como resultado final, pegá el link.
              </p>
            </div>
          </div>

          {errMsg && (
            <div className="bg-error-container/20 border border-error/30 rounded-xl px-5 py-3 text-sm text-error flex items-center gap-2">
              <span className="material-symbols-outlined text-xl shrink-0">error</span>
              {errMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={estado === 'loading'}
            className="w-full btn-primary justify-center text-base py-5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {estado === 'loading' ? (
              <>
                <span className="material-symbols-outlined animate-spin text-lg">refresh</span>
                Enviando pedido...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">send</span>
                Enviar pedido de edición
              </>
            )}
          </button>

          <p className="text-center text-xs text-on-surface-variant">
            Al enviar aceptás que te contactemos por WhatsApp para coordinar la cotización.
          </p>
        </form>
      </div>
    </div>
  );
}
