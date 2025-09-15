// Lógica para cards de PDFs con modal reutilizable
// Requiere shared.js (openModal/closeModal) y los estilos de ui.css

// Gestión de documentos PDF con generación de cards desde JS
// Edita la lista PDF_DOCS para añadir, quitar o modificar documentos.
// Soporta archivos (src) o contenido incrustado (base64).

import { qs, qsa, openModal } from './shared.js';

// =============== Configuración: edita aquí tus documentos =================
// Cada entrada puede tener:
// - id: string único
// - title: título visible
// - meta: texto auxiliar (tamaño, año, etc.)
// - src: ruta/URL del PDF (frontend/assets/pdfs/...)
// - base64: contenido base64 del PDF (opcional; si existe, tendrá prioridad sobre src)
// - icon: opcional, emoji o carácter para el icono
export const PDF_DOCS = [
  {
    id: 'primer-aporte',
    title: 'Fichas de arboles',
    meta: 'PDF incrustado • 2.1 MB',
    src: './assets/pdfs/ficha_arboles.pdf',
    icon: '📄'
  },
  {
    id: 'primer-aporte2',
    title: 'Fichas de arboles',
    meta: 'PDF incrustado • 2.1 MB',
    src: './assets/pdfs/ficha_arboles.pdf',
    icon: '📄'
  },
  // Agrega más objetos aquí, p.ej:
  // { id: 'otro', title: 'Otro PDF', meta: '2024 • 800 KB', src: './assets/pdfs/otro.pdf', icon: '📘' }
];
// ==========================================================================

function createCard(doc) {
  const article = document.createElement('article');
  article.className = 'card pdf-card';
  article.tabIndex = 0;
  article.setAttribute('role', 'button');
  article.setAttribute('aria-label', `Abrir PDF: ${doc.title}`);
  article.dataset.id = doc.id;

  const body = document.createElement('div');
  body.className = 'card-body';

  const icon = document.createElement('span');
  icon.className = 'pdf-icon';
  icon.textContent = doc.icon || '📄';

  const textWrap = document.createElement('div');

  const h3 = document.createElement('h3');
  h3.className = 'card-title';
  h3.textContent = doc.title;

  const meta = document.createElement('p');
  meta.className = 'pdf-meta';
  meta.textContent = doc.meta || '';

  textWrap.appendChild(h3);
  textWrap.appendChild(meta);
  body.appendChild(icon);
  body.appendChild(textWrap);
  article.appendChild(body);

  return article;
}

function buildPdfFrame(title, srcUrl) {
  const wrap = document.createElement('div');
  const h = document.createElement('h3');
  h.id = 'modalTitle';
  h.textContent = title || 'Documento';
  h.style.marginTop = '0';
  h.style.marginBottom = '12px';

  // Contenedor para el iframe con mejor control responsivo
  const iframeContainer = document.createElement('div');
  iframeContainer.className = 'pdf-iframe-container';
  iframeContainer.style.width = '100%';
  iframeContainer.style.position = 'relative';
  
  // Mensaje de carga
  const loadingMsg = document.createElement('div');
  loadingMsg.className = 'pdf-loading';
  loadingMsg.textContent = 'Cargando documento...';
  loadingMsg.style.position = 'absolute';
  loadingMsg.style.top = '50%';
  loadingMsg.style.left = '50%';
  loadingMsg.style.transform = 'translate(-50%, -50%)';
  loadingMsg.style.color = 'var(--muted)';
  loadingMsg.style.padding = '10px';
  loadingMsg.style.borderRadius = '4px';
  loadingMsg.style.backgroundColor = 'var(--surface)';
  
  const iframe = document.createElement('iframe');
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'no-referrer';
  iframe.title = title || 'Visor PDF';
  iframe.src = srcUrl;
  
  // Mensaje para dispositivos móviles
  const mobileMsg = document.createElement('div');
  mobileMsg.className = 'pdf-mobile-message';
  mobileMsg.innerHTML = `
    <p>Para una mejor experiencia:</p>
    <ul>
      <li>Gira tu dispositivo horizontalmente</li>
      <li>Usa los gestos de zoom para ampliar</li>
    </ul>
  `;
  mobileMsg.style.marginTop = '8px';
  mobileMsg.style.padding = '8px';
  mobileMsg.style.backgroundColor = 'var(--surface)';
  mobileMsg.style.borderRadius = '4px';
  mobileMsg.style.borderLeft = '3px solid var(--accent)';
  mobileMsg.style.fontSize = '0.9rem';
  
  // Mostrar mensaje solo en dispositivos móviles
  if (window.innerWidth <= 600) {
    mobileMsg.style.display = 'block';
  } else {
    mobileMsg.style.display = 'none';
  }
  
  // Ocultar mensaje de carga cuando el iframe termine de cargar
  iframe.onload = () => {
    loadingMsg.style.display = 'none';
  };
  
  iframeContainer.appendChild(loadingMsg);
  iframeContainer.appendChild(iframe);
  
  wrap.appendChild(h);
  wrap.appendChild(iframeContainer);
  wrap.appendChild(mobileMsg);
  
  return wrap;
}

function toBlobUrlFromBase64(base64) {
  const bytes = atob(base64);
  const len = bytes.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bytes.charCodeAt(i);
  const blob = new Blob([arr], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}

function getPdfUrl(doc) {
  if (doc.base64) {
    try { return toBlobUrlFromBase64(doc.base64); } catch (e) { console.error('Base64 inválido', e); }
  }
  return doc.src || '';
}

function wireCardInteractions(card, doc) {
  const onOpen = () => {
    const url = getPdfUrl(doc);
    if (!url) return;
    const content = buildPdfFrame(doc.title, url);
    openModal(content);

    // Limpieza de blob URL cuando cierre el modal
    if (doc.base64) {
      const modal = document.getElementById('modal');
      const obs = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === 'attributes' && m.attributeName === 'aria-hidden') {
            const hidden = modal.getAttribute('aria-hidden') !== 'false';
            if (hidden && url.startsWith('blob:')) {
              try { URL.revokeObjectURL(url); } catch (_) {}
              obs.disconnect();
            }
          }
        }
      });
      obs.observe(modal, { attributes: true });
    }
  };

  card.addEventListener('click', onOpen);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  });
}

function renderPdfGrid() {
  const grid = qs('#pdfGrid');
  if (!grid) return;
  grid.replaceChildren();

  if (!Array.isArray(PDF_DOCS) || PDF_DOCS.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'no-results';
    empty.textContent = 'No hay documentos disponibles por ahora.';
    grid.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();
  for (const doc of PDF_DOCS) {
    const card = createCard(doc);
    wireCardInteractions(card, doc);
    frag.appendChild(card);
  }
  grid.appendChild(frag);
}

export async function mountDocs() {
  // Montaje explícito desde el router SPA
  renderPdfGrid();
}