import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppSettings } from '../context/AppSettingsContext';

const MODULOS = [
  {
    num: '01',
    titulo: 'Introducción a CapCut y Setup Profesional',
    icon: 'settings',
    color: 'text-primary',
    secciones: [
      {
        sub: '1.1',
        titulo: 'Presentación de CapCut y su interfaz',
        items: [
          'Descarga y configuración inicial de CapCut (móvil y PC)',
          'Presentación de la interfaz: línea de tiempo, herramientas y paneles',
          'Diferencias entre CapCut mobile y desktop',
        ],
      },
      {
        sub: '1.2',
        titulo: 'Configuración del proyecto',
        items: [
          'Formatos de exportación: 1080p, 4K, 60fps',
          'Relaciones de aspecto: 9:16, 1:1, 16:9',
          'Organización del proyecto y archivos',
          'Atajos de teclado y flujo de trabajo eficiente',
        ],
      },
      {
        sub: '⭐',
        titulo: 'MASTER: Tu primer Reel en 30 minutos',
        items: ['Workflow completo de principio a fin: importar material crudo, editar, agregar música, exportar y subir a Instagram.'],
        highlight: true,
      },
    ],
  },
  {
    num: '02',
    titulo: 'Edición — Corte, Ritmo y Narrativa Visual',
    icon: 'content_cut',
    color: 'text-secondary',
    secciones: [
      {
        sub: '2.1',
        titulo: 'Técnicas de corte profesional',
        items: [
          'Corte al ritmo de la música (beat sync)',
          'Corte en seco vs. corte con transición',
          'Jump cuts y cortes de continuidad',
          'Eliminar silencios automáticamente',
        ],
      },
      {
        sub: '2.2',
        titulo: 'Construcción de narrativa',
        items: [
          'Estructura de videos virales: gancho, desarrollo, cierre',
          'Ritmo visual: variación de planos y duración',
          'Videos tipo tutorial y storytelling',
          'Hooks que retienen al espectador los primeros 3 segundos',
        ],
      },
      {
        sub: '2.3',
        titulo: 'Velocidad y tiempo',
        items: [
          'Slow motion y rampa de velocidad (speed ramp)',
          'Reverse y freeze frame',
          'Técnica de speed up para highlights',
        ],
      },
      {
        sub: '⭐',
        titulo: 'MASTER CLASS: Video Cinematic de 60 segundos',
        items: ['Edición completa de un video tipo cinematic con narración, cuts al ritmo y slow-mo estratégico.'],
        highlight: true,
      },
    ],
  },
  {
    num: '03',
    titulo: 'Color Grading — Corrección y Look Visual',
    icon: 'palette',
    color: 'text-tertiary',
    secciones: [
      {
        sub: '3.1',
        titulo: 'Corrección de color técnica',
        items: [
          'Exposición, contraste y temperatura de color',
          'Balance de blancos y corrección de luz artificial',
          'Corrección de skin tones',
          'Uso de scopes: Waveform y Vectorscope',
        ],
      },
      {
        sub: '3.2',
        titulo: 'Color grading creativo',
        items: [
          'Looks populares: Moody, Orange & Teal, Vintage, Film',
          'Creación de LUTs personalizadas',
          'Exportar y reutilizar presets de color',
          'Grading consistente entre clips',
        ],
      },
      {
        sub: '⭐',
        titulo: 'MASTER CLASS: Creá tu firma visual',
        items: ['Desarrollás tu propio look visual de marca y lo aplicás uniformemente a una serie de clips.'],
        highlight: true,
      },
    ],
  },
  {
    num: '04',
    titulo: 'Motion Graphics — Texto, Efectos y Animaciones',
    icon: 'blur_on',
    color: 'text-primary',
    secciones: [
      {
        sub: '4.1',
        titulo: 'Tipografía animada',
        items: [
          'Elección de fuentes y jerarquía tipográfica',
          'Animaciones de texto: entrada, salida y loop',
          'Captions y subtítulos automáticos con IA',
          'Texto cinético al ritmo de la música',
        ],
      },
      {
        sub: '4.2',
        titulo: 'Efectos visuales',
        items: [
          'Transiciones profesionales: match cut, zoom, slide',
          'Overlays, texturas y VHS effects',
          'Uso de stickers y elementos animados',
          'Chroma key (fondo verde) en CapCut',
        ],
      },
      {
        sub: '4.3',
        titulo: 'Keyframes y animación manual',
        items: [
          'Introducción a los keyframes en CapCut',
          'Animaciones de posición, escala y rotación',
          'Sincronización de elementos con el audio',
        ],
      },
      {
        sub: '⭐',
        titulo: 'MASTER CLASS: Intro animada de marca',
        items: ['Diseñás y animás una intro de 5 segundos con logo animado, texto con keyframes y música de fondo.'],
        highlight: true,
      },
    ],
  },
  {
    num: '05',
    titulo: 'Audio Profesional',
    icon: 'graphic_eq',
    color: 'text-secondary',
    secciones: [
      {
        sub: '5.1',
        titulo: 'Edición de audio',
        items: [
          'Separar audio del video',
          'Ajuste de volumen por clip y por keyframe',
          'Fundidos de entrada y salida (fade in/out)',
          'Normalización de niveles de audio',
        ],
      },
      {
        sub: '5.2',
        titulo: 'Música y efectos de sonido',
        items: [
          'Biblioteca de CapCut: música sin copyright',
          'Sincronización beat sync automático',
          'Agregar SFX y foley para potenciar el impacto',
          'Uso de voz en off (voice over) profesional',
        ],
      },
    ],
  },
  {
    num: '06',
    titulo: 'Estrategia de Contenido para Redes Sociales',
    icon: 'trending_up',
    color: 'text-tertiary',
    secciones: [
      {
        sub: '6.1',
        titulo: 'Algoritmos y formatos por plataforma',
        items: [
          'Instagram Reels: duración óptima, formato y hashtags',
          'TikTok: sonidos trending, duets y stitches',
          'YouTube Shorts: SEO de shorts',
          'LinkedIn y X: video nativo',
        ],
      },
      {
        sub: '6.2',
        titulo: 'Planificación y producción de contenido',
        items: [
          'Content calendar: planificación semanal',
          'Regrabar una idea para distintas plataformas',
          'Batching: grabar y editar 7 videos en 1 día',
          'Análisis de métricas: qué funciona y qué no',
        ],
      },
      {
        sub: '6.3',
        titulo: 'Monetización',
        items: [
          'Creadores de contenido para marcas (UGC)',
          'Cómo conseguir clientes de edición freelance',
          'Construir un portafolio de edición profesional',
        ],
      },
    ],
  },
  {
    num: '07',
    titulo: 'Proyecto Final + Certificación',
    icon: 'military_tech',
    color: 'text-primary',
    secciones: [
      {
        sub: '7.1',
        titulo: 'Proyecto integrador',
        items: [
          'Producción de un pack de 3 videos completos (Reel, TikTok y Story)',
          'Aplicación de color grading, motion graphics y audio profesional',
          'Feedback personalizado del docente',
          'Presentación final y correcciones',
          'Obtención del certificado digital del curso',
        ],
      },
    ],
  },
];

const BONOS = [
  {
    num: '#1',
    titulo: 'Pack de Templates CapCut — +100 Plantillas',
    desc: 'Más de 100 plantillas de proyectos CapCut listas para personalizar con tu contenido y publicar al instante.',
    icon: 'folder_open',
    tag: 'GRATIS',
  },
  {
    num: '#2',
    titulo: 'Pack de Música Sin Copyright',
    desc: 'Biblioteca curada de +500 tracks libres de derechos, organizados por género y BPM, para usar en todos tus proyectos.',
    icon: 'library_music',
    tag: 'GRATIS',
  },
  {
    num: '#3',
    titulo: 'Guía de LUTs Cinematográficas',
    desc: 'Pack de LUTs profesionales con guía de instalación y uso en CapCut para conseguir el look exacto que buscás.',
    icon: 'tonality',
    tag: 'GRATIS',
  },
];

export default function TemarioPage() {
  const [open, setOpen] = useState(null);
  const { precio_base, fecha_inicio } = useAppSettings();

  return (
    <div className="min-h-screen pt-24 pb-32 px-6 lg:px-20">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <span className="badge-secondary mb-4">Plan de Estudios</span>
          <h1 className="font-headline text-4xl md:text-6xl font-bold tracking-tight mt-4 mb-6">
            Lo que vas a <span className="gradient-text">dominar</span>
          </h1>
          <p className="text-on-surface-variant text-lg max-w-2xl mx-auto">
            Programa completo de <strong>7 módulos</strong> del Curso EDIT MASTER de edición con CapCut, con Master Classes integradas y 3 bonos exclusivos.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {[
            { val: '7', label: 'Módulos', color: 'text-secondary' },
            { val: '100%', label: 'Práctico', color: 'text-primary' },
            { val: '3', label: 'Bonos Gratis', color: 'text-tertiary' },
            { val: fecha_inicio, label: 'Inicio', color: 'text-error' },
          ].map(({ val, label, color }) => (
            <div key={label} className="card text-center border border-outline-variant/20">
              <p className={`font-headline text-3xl font-black ${color}`}>{val}</p>
              <p className="text-on-surface-variant text-xs uppercase tracking-widest font-bold mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Accordion de módulos */}
        <div className="space-y-3 mb-20">
          {MODULOS.map((m, i) => (
            <div
              key={m.num}
              className={`rounded-xl border transition-all duration-300 ${
                open === i
                  ? 'border-primary/40 bg-surface-container-high'
                  : 'border-outline-variant/20 bg-surface-container hover:border-outline-variant/40'
              }`}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center gap-4 px-6 py-5 text-left"
              >
                <span className={`material-symbols-outlined ${m.color} shrink-0`}>{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className={`font-label text-xs font-bold uppercase tracking-widest ${m.color}`}>
                    Módulo {m.num}
                  </span>
                  <h3 className="font-headline font-bold text-base md:text-lg mt-0.5 leading-snug">{m.titulo}</h3>
                </div>
                <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-300 shrink-0 ${open === i ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>

              {open === i && (
                <div className="px-6 pb-6 border-t border-outline-variant/20 pt-5 space-y-5">
                  {m.secciones.map((sec) => (
                    <div key={sec.sub} className={`rounded-xl p-4 ${sec.highlight ? 'bg-primary/5 border border-primary/20' : 'bg-surface-variant/30'}`}>
                      <p className={`font-label text-[10px] font-black uppercase tracking-widest mb-2 ${sec.highlight ? m.color : 'text-on-surface-variant'}`}>
                        {sec.highlight ? '★ ' : ''}{sec.sub} · {sec.titulo}
                      </p>
                      <ul className="space-y-1.5">
                        {sec.items.map(item => (
                          <li key={item} className="flex items-start gap-2.5 text-on-surface-variant text-sm leading-relaxed">
                            <span className={`material-symbols-outlined text-sm mt-0.5 shrink-0 ${m.color}`}>
                              {sec.highlight ? 'star' : 'check_circle'}
                            </span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bonos */}
        <div className="mb-20">
          <div className="text-center mb-10">
            <span className="badge-primary mb-3">Incluido en tu inscripción</span>
            <h2 className="font-headline text-3xl font-bold mt-4">3 Bonos Exclusivos</h2>
            <p className="text-on-surface-variant mt-2">Todo lo que necesitás para arrancar desde el primer día.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {BONOS.map(b => (
              <div key={b.num} className="card border border-outline-variant/20 relative overflow-hidden group hover:-translate-y-1 transition-transform">
                <div className="absolute top-3 right-3">
                  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-secondary/20 text-secondary border border-secondary/30">
                    {b.tag}
                  </span>
                </div>
                <span className="material-symbols-outlined text-primary text-3xl mb-4">{b.icon}</span>
                <p className="font-label text-[10px] font-black uppercase tracking-widest text-primary mb-1">Bono {b.num}</p>
                <h3 className="font-headline font-bold text-base mb-3 leading-snug">{b.titulo}</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center bg-surface-container border border-outline-variant/20 rounded-2xl p-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-error/10 border border-error/30">
            <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
            <span className="text-error font-label text-[10px] uppercase tracking-[0.2em] font-bold">Inicio: {fecha_inicio} · Cupos Limitados</span>
          </div>
          <h2 className="font-headline text-3xl font-bold">¿Listo para empezar?</h2>
          <p className="text-on-surface-variant max-w-md mx-auto">
            7 módulos + 3 bonos + certificación profesional. Todo por <strong className="text-on-surface">${precio_base.toLocaleString('es-AR')} ARS</strong>.
          </p>
          <Link to="/inscripcion" className="btn-primary inline-flex items-center gap-2">
            <span className="material-symbols-outlined">rocket_launch</span>
            Inscribirme Ahora
          </Link>
        </div>

      </div>
    </div>
  );
}
