import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const ESTADOS = [
  { value: 'pendiente',   label: 'Pendiente',  color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
  { value: 'contactado',  label: 'Contactado', color: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  { value: 'cotizado',    label: 'Cotizado',   color: 'text-purple-400 bg-purple-400/10 border-purple-400/30' },
  { value: 'aceptado',    label: 'Aceptado',   color: 'text-green-400 bg-green-400/10 border-green-400/30' },
  { value: 'rechazado',   label: 'Rechazado',  color: 'text-red-400 bg-red-400/10 border-red-400/30' },
];

const TIPO_LABELS = {
  reel:   'Reel',
  tiktok: 'TikTok',
  short:  'YouTube Short',
  story:  'Story',
  largo:  'Video largo',
  otro:   'Otro',
};

const DURACION_LABELS = {
  '15s':  '15 seg',
  '30s':  '30 seg',
  '60s':  '60 seg',
  '90s':  '90 seg',
  '3min': '3 min',
  '5min+':'5 min+',
};

function EstadoBadge({ estado }) {
  const e = ESTADOS.find(x => x.value === estado) || ESTADOS[0];
  return (
    <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${e.color}`}>
      {e.label}
    </span>
  );
}

function PedidoModal({ pedido, onClose, onUpdate }) {
  const [notas, setNotas] = useState(pedido.notas_admin || '');
  const [estado, setEstado] = useState(pedido.estado);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from('pedidos_edicion')
      .update({ notas_admin: notas, estado })
      .eq('id', pedido.id);
    setSaving(false);
    if (!error) onUpdate({ ...pedido, notas_admin: notas, estado });
  }

  const waText = encodeURIComponent(
    `Hola ${pedido.nombre}! Te escribimos de EDIT MASTER por tu solicitud de edición de video. Coordinamos los detalles de la cotización?`
  );
  const waPhone = pedido.whatsapp.replace(/\D/g, '');

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-surface-container rounded-2xl border border-outline-variant/20 w-full max-w-2xl my-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
          <h2 className="font-headline font-bold">
            {pedido.nombre} {pedido.apellido}
          </h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Info row */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="glass-panel p-3 rounded-xl">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-1">WhatsApp</p>
              <a
                href={`https://wa.me/${waPhone}?text=${waText}`}
                target="_blank"
                rel="noreferrer"
                className="text-secondary hover:underline font-bold"
              >
                {pedido.whatsapp}
              </a>
            </div>
            <div className="glass-panel p-3 rounded-xl">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-1">Tipo</p>
              <p className="font-bold">{TIPO_LABELS[pedido.tipo_video] || pedido.tipo_video}</p>
            </div>
            <div className="glass-panel p-3 rounded-xl">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-1">Duración</p>
              <p className="font-bold">{DURACION_LABELS[pedido.duracion_max] || pedido.duracion_max}</p>
            </div>
            <div className="glass-panel p-3 rounded-xl">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-1">Fecha</p>
              <p className="font-bold">{new Date(pedido.created_at).toLocaleDateString('es-AR')}</p>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-2">Descripción del video</p>
            <p className="text-sm leading-relaxed bg-surface-variant/30 rounded-xl p-4">{pedido.descripcion}</p>
          </div>

          {/* Estilos */}
          {pedido.estilos?.length > 0 && (
            <div>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-2">Estilos solicitados</p>
              <div className="flex flex-wrap gap-2">
                {pedido.estilos.map(e => (
                  <span key={e} className="badge-primary text-xs px-3 py-1 rounded-full">{e}</span>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          <div className="space-y-3">
            <div>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-1">Material del cliente</p>
              <a href={pedido.link_material} target="_blank" rel="noreferrer"
                className="text-sm text-primary hover:underline break-all flex items-center gap-1">
                <span className="material-symbols-outlined text-base">folder_open</span>
                {pedido.link_material}
              </a>
            </div>
            {pedido.referencia_url && (
              <div>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-1">Video de referencia</p>
                <a href={pedido.referencia_url} target="_blank" rel="noreferrer"
                  className="text-sm text-secondary hover:underline break-all flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">play_circle</span>
                  {pedido.referencia_url}
                </a>
              </div>
            )}
          </div>

          {/* Estado */}
          <div>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-2">Estado del pedido</p>
            <div className="flex flex-wrap gap-2">
              {ESTADOS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setEstado(s.value)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${s.color} ${
                    estado === s.value ? 'ring-2 ring-offset-2 ring-offset-surface-container ring-current opacity-100' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notas admin */}
          <div>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mb-2">Notas internas</p>
            <textarea
              rows={3}
              value={notas}
              onChange={e => setNotas(e.target.value)}
              className="input-field w-full resize-none text-sm"
              placeholder="Cotización enviada: $X... Fecha entrega: ..."
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-outline-variant/20 gap-3 flex-wrap">
          <a
            href={`https://wa.me/${waPhone}?text=${waText}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm font-bold hover:bg-green-500/20 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current shrink-0">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Contactar
          </a>
          <button
            onClick={save}
            disabled={saving}
            className="btn-primary py-2 px-5 text-sm disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PedidosEdicionPage() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchPedidos();
  }, []);

  async function fetchPedidos() {
    setLoading(true);
    const { data } = await supabase
      .from('pedidos_edicion')
      .select('*')
      .order('created_at', { ascending: false });
    setPedidos(data || []);
    setLoading(false);
  }

  function handleUpdate(updated) {
    setPedidos(prev => prev.map(p => p.id === updated.id ? updated : p));
    setSelected(updated);
  }

  const filtrados = filtro === 'todos'
    ? pedidos
    : pedidos.filter(p => p.estado === filtro);

  const counts = ESTADOS.reduce((acc, e) => {
    acc[e.value] = pedidos.filter(p => p.estado === e.value).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-headline text-2xl font-black">Pedidos de Edición</h2>
          <p className="text-on-surface-variant text-sm mt-1">{pedidos.length} solicitudes totales</p>
        </div>
        <button onClick={fetchPedidos}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-variant text-on-surface-variant hover:text-on-surface text-sm font-bold transition-colors">
          <span className="material-symbols-outlined text-lg">refresh</span>
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {ESTADOS.map(e => (
          <div key={e.value} className={`glass-panel p-3 rounded-xl border text-center cursor-pointer transition-all ${
            filtro === e.value ? 'ring-2 ring-current ' + e.color : 'border-outline-variant/20'
          }`}
            onClick={() => setFiltro(filtro === e.value ? 'todos' : e.value)}>
            <p className={`text-2xl font-black font-headline ${e.color.split(' ')[0]}`}>{counts[e.value] || 0}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{e.label}</p>
          </div>
        ))}
      </div>

      {/* Filtro rápido */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFiltro('todos')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all ${
            filtro === 'todos'
              ? 'bg-primary/15 border-primary text-primary'
              : 'border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/60'
          }`}
        >
          Todos ({pedidos.length})
        </button>
        {ESTADOS.map(e => (
          <button
            key={e.value}
            onClick={() => setFiltro(filtro === e.value ? 'todos' : e.value)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all ${
              filtro === e.value
                ? e.color
                : 'border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/60'
            }`}
          >
            {e.label} ({counts[e.value] || 0})
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16">
          <span className="material-symbols-outlined text-primary text-4xl animate-spin">refresh</span>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl mb-3 block">inbox</span>
          <p className="font-headline font-bold">Sin pedidos en este estado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(p => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="w-full glass-panel border border-outline-variant/20 rounded-2xl p-5 flex items-start gap-5 hover:border-primary/40 transition-all text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-xl">movie_edit</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <span className="font-headline font-bold group-hover:text-primary transition-colors">
                    {p.nombre} {p.apellido}
                  </span>
                  <EstadoBadge estado={p.estado} />
                  {TIPO_LABELS[p.tipo_video] && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border border-outline-variant/20 px-2 py-0.5 rounded-full">
                      {TIPO_LABELS[p.tipo_video]}
                    </span>
                  )}
                </div>
                <p className="text-sm text-on-surface-variant truncate max-w-lg">{p.descripcion}</p>
                {p.estilos?.length > 0 && (
                  <p className="text-xs text-outline mt-1">{p.estilos.slice(0, 3).join(' · ')}{p.estilos.length > 3 ? ` +${p.estilos.length - 3}` : ''}</p>
                )}
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-xs text-on-surface-variant">{new Date(p.created_at).toLocaleDateString('es-AR')}</p>
                <p className="text-xs text-outline mt-0.5">{DURACION_LABELS[p.duracion_max] || p.duracion_max}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <PedidoModal
          pedido={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  );
}
