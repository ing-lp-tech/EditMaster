// Embed genérico para contenido de Google Drive: video, PDF, Google Doc/Slides/
// Sheets, o imagen. Pegá el link normal que copia Drive/Docs (Compartir → Copiar
// vínculo) — no hace falta extraer el ID a mano.
//
// Uso:
//   <DriveEmbed url="https://drive.google.com/file/d/XXXX/view" tipo="video" />
//   <DriveEmbed url="https://drive.google.com/file/d/XXXX/view" tipo="pdf" />
//   <DriveEmbed url="https://docs.google.com/document/d/XXXX/edit" tipo="doc" />
//   <DriveEmbed url="https://drive.google.com/file/d/XXXX/view" tipo="imagen" />
//
// La carpeta/archivo debe tener descarga restringida desde Drive
// (Configuración de uso compartido → destildar "descargar/imprimir/copiar").

function parseDriveUrl(url) {
  if (!url) return null;

  // Archivo subido a Drive: PDF, video, imagen, etc.
  let m = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
          url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/) ||
          url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return { id: m[1], kind: 'file' };

  // Google Docs / Slides / Sheets nativos
  m = url.match(/docs\.google\.com\/(document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return { id: m[2], kind: m[1] };

  return null;
}

function buildEmbedUrl(parsed) {
  const { id, kind } = parsed;
  switch (kind) {
    case 'document':      return `https://docs.google.com/document/d/${id}/preview`;
    case 'spreadsheets':   return `https://docs.google.com/spreadsheets/d/${id}/preview`;
    case 'presentation':  return `https://docs.google.com/presentation/d/${id}/embed`;
    default:               return `https://drive.google.com/file/d/${id}/preview`; // file: pdf, video, doc escaneado, etc.
  }
}

function buildImageSrc(id) {
  return `https://drive.google.com/uc?export=view&id=${id}`;
}

// Solo para pdf/doc — video e imagen quedan protegidos a propósito, no tienen link acá.
function buildDownloadUrl(parsed) {
  const { id, kind } = parsed;
  // Doc/Slides/Sheets nativos: el formato de exportación es ambiguo (pdf/docx/etc),
  // así que abrimos la vista normal de Drive y el usuario baja desde ahí.
  if (kind !== 'file') {
    return kind === 'presentation'
      ? `https://docs.google.com/presentation/d/${id}/edit`
      : kind === 'spreadsheets'
        ? `https://docs.google.com/spreadsheets/d/${id}/edit`
        : `https://docs.google.com/document/d/${id}/edit`;
  }
  // Archivo subido (pdf real): descarga directa.
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

export default function DriveEmbed({ url, tipo = 'file', title = 'Contenido', className = '' }) {
  const parsed = parseDriveUrl(url);

  if (!parsed) {
    return (
      <div className={`rounded-2xl bg-black/80 flex items-center justify-center text-white/60 text-sm p-6 text-center ${className}`} style={{ aspectRatio: '16/9' }}>
        Link de Google Drive/Docs inválido. Pegá el link tal cual te lo da "Copiar vínculo".
      </div>
    );
  }

  // Imagen: <img> directo, sin chrome de iframe
  if (tipo === 'imagen') {
    return (
      <img
        src={buildImageSrc(parsed.id)}
        alt={title}
        className={`w-full h-auto rounded-2xl object-contain bg-black/5 ${className}`}
      />
    );
  }

  const esDescargable = tipo === 'pdf' || tipo === 'doc';

  // Video, PDF, Doc/Slides/Sheets: iframe de preview
  return (
    <div className={className}>
      <div className="rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: tipo === 'video' ? '16/9' : '4/3' }}>
        <iframe
          src={buildEmbedUrl(parsed)}
          className="w-full h-full"
          style={{ border: 'none' }}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={title}
        />
      </div>
      {esDescargable && (
        <a
          href={buildDownloadUrl(parsed)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-base">download</span>
          Descargar {tipo === 'pdf' ? 'PDF' : 'documento'}
        </a>
      )}
    </div>
  );
}
