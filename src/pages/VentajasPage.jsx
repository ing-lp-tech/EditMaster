import React from 'react';
import { Link } from 'react-router-dom';
import { useAppSettings } from '../context/AppSettingsContext';

const VENTAJAS = [
  { icon: 'smartphone', title: 'Edita desde donde quieras', desc: 'CapCut en móvil y PC. Sin necesidad de equipo costoso ni Adobe. Solo tu teléfono o laptop.', color: 'text-secondary', span: 'md:col-span-2' },
  { icon: 'trending_up', title: 'Resultados en Redes Reales', desc: 'Aprende exactamente qué formatea el algoritmo de Instagram y TikTok para explotar tu alcance.', color: 'text-primary', span: '' },
  { icon: 'palette', title: 'Identidad Visual Propia', desc: 'Desarrollas tu propio look de color y estilo visual reconocible que diferencia tu contenido.', color: 'text-tertiary', span: '' },
  { icon: 'bolt', title: 'Velocidad de Producción', desc: 'Con las técnicas correctas y los templates del curso, editás un video profesional en 30 minutos.', color: 'text-secondary', span: 'md:col-span-2' },
  { icon: 'verified', title: 'Certificación Oficial', desc: 'Recibís un certificado que acredita tu nivel profesional de edición para mostrarlo a clientes.', color: 'text-primary', span: '' },
  { icon: 'payments', title: 'Fuente de Ingresos', desc: 'La edición de video es una de las skills freelance más cotizadas. El curso te da la base para monetizar.', color: 'text-tertiary', span: '' },
];

const COMPARACION = {
  viejo: [
    { icon: 'warning', label: 'Edición Amateur', desc: 'Cortes bruscos, colores inconsistentes y texto genérico.' },
    { icon: 'timer_off', label: 'Horas sin resultado', desc: 'Días editando sin saber si el video va a funcionar.' },
    { icon: 'trending_down', label: 'Bajo alcance orgánico', desc: 'El algoritmo ignora videos que no siguen los patrones de retención.' },
  ],
  nuevo: [
    { icon: 'movie_edit', label: 'Edición Cinematic Pro', desc: 'Color grading, motion graphics y audio que enganchan.' },
    { icon: 'rocket_launch', label: 'Flujo de trabajo rápido', desc: 'Templates y técnicas para producir en 30 minutos.' },
    { icon: 'trending_up', label: 'Contenido que viraliza', desc: 'Hooks, ritmo y narrativa diseñados para cada plataforma.' },
  ],
};

const STATS = [
  { val: '+5.000', label: 'Editores formados', color: 'text-primary' },
  { val: '30 min', label: 'Para editar un Reel Pro', color: 'text-secondary' },
  { val: '7', label: 'Módulos especializados', color: 'text-tertiary' },
  { val: '3x', label: 'Más alcance orgánico', color: 'text-error' },
];

export default function VentajasPage() {
  const { precio_base } = useAppSettings();
  return (
    <div className="min-h-screen pt-24 pb-32 px-6 lg:px-20">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-20">
          <span className="badge-primary mb-4">Evolución del Editor</span>
          <h1 className="font-headline text-4xl md:text-7xl font-black tracking-tighter mt-4 mb-6 uppercase">
            Edición Amateur{' '}
            <span className="text-outline-variant">vs.</span>{' '}
            <br /><span className="gradient-text">Edición Profesional</span>
          </h1>
          <p className="text-on-surface-variant max-w-2xl mx-auto text-lg">
            La diferencia entre un video que nadie ve y uno que genera miles de reproducciones está en las técnicas correctas. Esto es lo que cambia.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20">
          {STATS.map(s => (
            <div key={s.label} className="card text-center border border-outline-variant/20">
              <p className={`font-headline text-3xl font-black ${s.color}`}>{s.val}</p>
              <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Comparación */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mb-24">
          <div className="lg:col-span-5 bg-surface-container-low p-8 rounded-xl border-l-4 border-outline/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <span className="material-symbols-outlined text-[200px]">history</span>
            </div>
            <h3 className="text-outline font-headline font-bold text-xl mb-8 uppercase tracking-widest">Edición Amateur</h3>
            <ul className="space-y-6">
              {COMPARACION.viejo.map(item => (
                <li key={item.label} className="flex items-start gap-4 opacity-60">
                  <span className="material-symbols-outlined text-error pt-1">{item.icon}</span>
                  <div>
                    <p className="font-bold text-sm">{item.label}</p>
                    <p className="text-xs text-on-surface-variant">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2 flex items-center justify-center py-8">
            <div className="bg-surface-container-highest p-4 rounded-full border border-secondary/20">
              <span className="material-symbols-outlined text-secondary text-3xl">bolt</span>
            </div>
          </div>

          <div className="lg:col-span-5 bg-surface-container-high p-8 rounded-xl border-l-4 border-secondary relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-secondary/5 blur-[80px] rounded-full" />
            <h3 className="text-secondary font-headline font-bold text-xl mb-8 uppercase tracking-widest">EDIT MASTER Pro</h3>
            <ul className="space-y-6">
              {COMPARACION.nuevo.map(item => (
                <li key={item.label} className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-secondary pt-1">{item.icon}</span>
                  <div>
                    <p className="font-bold text-sm">{item.label}</p>
                    <p className="text-xs text-on-surface-variant">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bento Ventajas */}
        <h2 className="font-headline text-3xl font-bold uppercase tracking-tight mb-12">Por qué EDIT MASTER cambia todo</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {VENTAJAS.map(v => (
            <div key={v.title} className={`card-hover ${v.span}`}>
              <span className={`material-symbols-outlined text-4xl mb-4 ${v.color}`}>{v.icon}</span>
              <h4 className="font-headline text-xl font-bold mb-2">{v.title}</h4>
              <p className="text-on-surface-variant text-sm">{v.desc}</p>
            </div>
          ))}
        </div>

        {/* Pilares skills */}
        <div className="card mb-20">
          <h4 className="text-sm font-bold font-headline mb-6 uppercase tracking-widest text-outline">Skills que desarrollás</h4>
          {[
            { label: 'Edición y narrativa visual', val: 100, color: 'bg-primary' },
            { label: 'Color grading profesional', val: 92, color: 'bg-secondary' },
            { label: 'Motion graphics y efectos', val: 85, color: 'bg-tertiary' },
            { label: 'Estrategia y viralidad en redes', val: 90, color: 'bg-error/50' },
          ].map(b => (
            <div key={b.label} className="mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-xs font-bold">{b.label}</span>
                <span className="text-xs text-secondary">{b.val}%</span>
              </div>
              <div className="h-1.5 w-full bg-outline-variant/20 rounded-full overflow-hidden">
                <div className={`h-full ${b.color}`} style={{ width: `${b.val}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-surface-container-highest p-12 rounded-xl relative overflow-hidden border border-primary/20 text-center">
          <div className="absolute top-0 right-0 translate-x-1/4 -translate-y-1/4 w-64 h-64 bg-primary/10 blur-[100px] rounded-full" />
          <span className="badge-error mb-6 inline-block">Solo quedan pocos cupos</span>
          <h2 className="font-headline text-4xl md:text-5xl font-black mb-4 tracking-tighter">Empezá a editar como un Pro</h2>
          <p className="text-on-surface-variant mb-10 max-w-md mx-auto">Dominá las técnicas que los creadores más exitosos usan para generar millones de reproducciones.</p>
          <Link to="/inscripcion" className="btn-primary inline-flex items-center gap-2 text-lg px-12 py-5">
            RESERVAR VACANTE — ${precio_base.toLocaleString('es-AR')}
          </Link>
        </div>
      </div>
    </div>
  );
}
