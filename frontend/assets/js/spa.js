// spa.js - Enrutador ligero para SPA basado en hash y contenedor #app
// Mantiene coherencia con la arquitectura: ESM, utilidades en shared.js y módulos existentes
// Rutas soportadas:
//   #/ -> Hub (home)
//   #/especies -> lista de especies (aportes)
//   #/especies/:id -> abre modal de especie en la lista
//   #/form -> formulario de envío
//   #/mapa -> vista del mapa
//   #/admin -> panel admin (opcional; redirige a admin.html por ahora)

import { qs, setActiveNav, runSplitTransition, runSplitOutroIfPending } from './shared.js';

// Estado simple de navegación
const state = {
  view: 'home',
  params: {},
};

// Plantillas de vistas reutilizando el mismo header/footer del shell
function viewHome() {
  return `
    <section class="hero">
      <h2>Explora, comparte y aprende sobre especies vegetales</h2>
      <p>
        Este Herbario comunitario busca recopilar especies con la ayuda del público.
        Envía tus observaciones con fotos, ubicación y detalles botánicos.
      </p>
      <div class="cta-row">
        <a class="btn" href="#/form">Enviar una especie</a>
        <a class="btn btn-secondary" href="#/especies">Ver aportes</a>
      </div>
    </section>

    <section class="features">
      <div class="feature">
        <h3>Formulario público</h3>
        <p>Nombre científico, común, familia, descripción, imagen y coordenadas.</p>
      </div>
      <div class="feature">
        <h3>Aprobación por admin</h3>
        <p>Las especies pasan por revisión antes de ser visibles.</p>
      </div>
      <div class="feature">
        <h3>Mapa colaborativo</h3>
        <p>Ubicaciones en un tablero de Padlet mientras automatizamos el proceso.</p>
      </div>
    </section>

    <section class="section section-about">
      <h3>Sobre el proyecto</h3>
      <p>Un esfuerzo colaborativo para documentar la diversidad vegetal local, fomentando el aprendizaje y la participación ciudadana.</p>
      <p>Los aportes son revisados por el equipo antes de publicarse para asegurar consistencia y calidad de datos.</p>
    </section>

    <section class="section section-steps">
      <h3>Cómo contribuir</h3>
      <div class="features">
        <div class="feature">
          <h4>1. Observa</h4>
          <p>Registra la planta con una foto nítida y, si puedes, su ubicación.</p>
        </div>
        <div class="feature">
          <h4>2. Describe</h4>
          <p>Añade nombre común o científico, familia y notas relevantes.</p>
        </div>
        <div class="feature">
          <h4>3. Envía</h4>
          <p>Usa el formulario y nuestro equipo validará la información.</p>
        </div>
      </div>
    </section>

    <section class="section section-news">
      <h3>Novedades</h3>
      <div class="features">
        <div class="feature"><h4>Nueva versión</h4><p>Mejoras de accesibilidad y animaciones sutiles.</p></div>
        <div class="feature"><h4>Más familias</h4><p>Ampliamos el catálogo de familias botánicas registradas.</p></div>
        <div class="feature"><h4>Mapa</h4><p>Optimizado para consultas desde dispositivos móviles.</p></div>
      </div>
    </section>
  `;
}

function viewEspecies() {
  return `
    <section class="species-header">
      <h2>Especies del Herbario</h2>
      <p>Explora las especies vegetales registradas en nuestro herbario comunitario.</p>
      
      <div class="filters">
        <input type="text" id="searchInput" placeholder="Buscar por nombre científico o común..." class="search-input" />
        <select id="familyFilter" class="filter-select">
          <option value="">Todas las familias</option>
        </select>
      </div>
    </section>

    <section class="species-grid" id="speciesGrid">
      <div class="loading" id="loadingSpinner">
        <p>Cargando especies...</p>
      </div>
    </section>

    <div id="toast" class="toast" role="status" aria-live="polite"></div>

    <div id="modal" class="modal" aria-hidden="true">
      <div class="modal-backdrop" data-close-modal></div>
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <button class="modal-close" aria-label="Cerrar" data-close-modal>&times;</button>
        <div id="modalContent" class="modal-content"></div>
      </div>
    </div>
  `;
}

function viewForm() {
  return `
    <h2>Enviar una especie</h2>
    <form id="plantForm" class="form-grid">
      <div class="form-field">
        <label for="scientific_name">Nombre científico</label>
        <input type="text" id="scientific_name" name="scientific_name" placeholder="Ej: Lavandula dentata" required />
      </div>

      <div class="form-field">
        <label for="common_name">Nombre común</label>
        <input type="text" id="common_name" name="common_name" placeholder="Ej: Lavanda" required />
      </div>

      <div class="form-field">
        <label for="family">Familia</label>
        <input type="text" id="family" name="family" placeholder="Ej: Lamiaceae" />
      </div>

      <div class="form-field form-full">
        <label for="description">Descripción</label>
        <textarea id="description" name="description" rows="4" placeholder="Características, hábitat, notas..."></textarea>
      </div>

      <div class="form-field form-full">
        <label>Imagen (Drag & Drop o click)</label>
        <div id="dropzone" class="dropzone" tabindex="0">
          <input id="imageInput" type="file" accept="image/*" hidden />
          <div class="dz-instructions">
            Arrastra una imagen aquí o haz click para seleccionar
          </div>
          <img id="imagePreview" alt="Vista previa" class="dz-preview" />
          <button type="button" id="dzRemove" class="dz-remove" aria-label="Eliminar imagen">Eliminar</button>
        </div>
        <div class="form-actions camera-actions">
          <button type="button" id="btnCamera" class="btn btn-secondary">Tomar foto</button>
        </div>
        <small style="color: var(--fg); display:block; margin-top:6px">Formatos recomendados: JPG/PNG • Tamaño máx. 10MB</small>
      </div>

      <div class="form-field">
        <label for="latitude">Latitud</label>
        <input type="text" id="latitude" name="latitude" placeholder="-12.0464" />
      </div>

      <div class="form-field">
        <label for="longitude">Longitud</label>
        <input type="text" id="longitude" name="longitude" placeholder="-77.0428" />
      </div>

      <div class="form-field form-full">
        <button type="button" id="btnGeo" class="btn btn-secondary">Obtener mi ubicación</button>
      </div>

      <div class="form-actions form-full">
        <button type="submit" class="btn">Enviar</button>
      </div>
    </form>

    <div id="toast" class="toast" role="status" aria-live="polite"></div>
  `;
}

function viewMapa() {
  return `
    <h2>Mapa colaborativo</h2>
    <p>
      Este mapa está embebido desde Padlet. Por ahora añadiremos ubicaciones manualmente.
      Cuando definamos el flujo automático, conectaremos con la base de datos.
    </p>

    <div class="padlet-wrapper">
      <iframe
        src="https://padlet.com/embed/tu-tablero-ejemplo"
        allow="camera;microphone;geolocation"
        width="100%"
        height="600"
        frameborder="0"
        style="border:1px solid #1f2937; border-radius:8px"
        title="Padlet Mapa Herbario"
      ></iframe>
    </div>
  `;
}

function viewAdminLink() {
  // Permitir siempre el acceso a la página de admin para mostrar el formulario de login
  // La verificación de permisos se hará en admin.js
  return `
    <section class="hero">
      <h2>Panel de administración</h2>
      <p>Por ahora el panel abre en una página separada.</p>
      <div class="cta-row">
        <a class="btn" href="./admin.html">Abrir panel Admin</a>
      </div>
    </section>
  `;
}

function viewDocs() {
  return `
    <style>
      .modal-content iframe { width: 100%; height: 80vh; border: 0; border-radius: 8px; background: #111827; }
      .pdf-card .card-body { display: flex; align-items: center; gap: 10px; }
      .pdf-icon { font-size: 1.6rem; }
      .pdf-meta { color: #94a3b8; font-size: 0.9rem; }
      .modal-dialog { max-width: min(1100px, 95vw); }
    </style>
    <section class="hero">
      <h2>Especies</h2>
      <p>Consulta documentos y fichas técnicas relacionadas a las especies del herbario.</p>
    </section>
    <section class="pdf-grid" id="pdfGrid"></section>

    <div id="modal" class="modal" aria-hidden="true">
      <div class="modal-backdrop" data-close-modal></div>
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <button class="modal-close" aria-label="Cerrar" data-close-modal>&times;</button>
        <div id="modalContent" class="modal-content"></div>
      </div>
    </div>
  `;
}

function render(view, params = {}) {
  const app = qs('#app');
  if (!app) return;
  state.view = view;
  state.params = params;

  let html = '';
  switch (view) {
    case 'home': html = viewHome(); break;
    case 'especies': html = viewEspecies(); break;
    case 'form': html = viewForm(); break;
    case 'mapa': html = viewMapa(); break;
    case 'admin': html = viewAdminLink(); break;
    case 'docs': html = viewDocs(); break;
    default: html = viewHome(); break;
  }
  app.innerHTML = html;
  // Animación de entrada sutil tras render
  app.classList.remove('app-fade-in');
  // Forzar reflow para reiniciar la animación si se reusa la clase
  // eslint-disable-next-line no-unused-expressions
  void app.offsetWidth;
  app.classList.add('app-fade-in');
  // Mejorar UX: llevar al tope en cada cambio de ruta
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  // Mapeo de etiquetas legibles por pantalla para cada vista
  const VIEW_LABELS = {
    home: 'Inicio',
    especies: 'Especies',
    form: 'Formulario',
    mapa: 'Mapa',
    admin: 'Administración',
    docs: 'Documentación'
  };
  
  // Anunciar cambio de vista a lectores de pantalla
  function announceViewChange(view) {
    const region = document.getElementById('sr-status');
    if (!region) return;
    const label = VIEW_LABELS[view] || view;
    region.textContent = `Vista cambiada: ${label}`;
  }
  // Anunciar cambio de vista para tecnologías de asistencia
  announceViewChange(view);

  let outroHandled = false;

  // Cargar controladores de cada vista a demanda (code-splitting posible en futuro)
  if (view === 'especies') {
    import('./especies.js').then((mod) => {
      if (mod && typeof mod.mountEspecies === 'function') {
        mod.mountEspecies().catch(console.error).finally(() => {
          runSplitOutroIfPending();
          outroHandled = true;
        });
      } else {
        // Fallback si el módulo no exporta mountEspecies
        runSplitOutroIfPending();
        outroHandled = true;
      }
      // Si hay :id en la URL, intentamos abrir el modal correspondiente tras render
      const id = params.id;
      if (!id) return;
      const start = Date.now();
      const tryOpen = () => {
        const card = document.querySelector(`#speciesGrid .card[data-id="${CSS.escape(id)}"]`);
        if (card) { card.click(); return; }
        if (Date.now() - start < 5000) setTimeout(tryOpen, 200);
      };
      tryOpen();
    });
  } else if (view === 'form') {
    import('./form.js').then((mod) => {
      if (mod && typeof mod.mountForm === 'function') {
        mod.mountForm().catch(console.error).finally(() => {
          runSplitOutroIfPending();
          outroHandled = true;
        });
      } else {
        runSplitOutroIfPending();
        outroHandled = true;
      }
    });
  } else if (view === 'docs') {
    import('./info_general.js').then((mod) => {
      if (mod && typeof mod.mountDocs === 'function') {
        mod.mountDocs().catch(console.error).finally(() => {
          runSplitOutroIfPending();
          outroHandled = true;
        });
      } else {
        runSplitOutroIfPending();
        outroHandled = true;
      }
    });
  } else if (view === 'home') {
    import('./main.js').then((mod) => {
      if (mod && typeof mod.mountHome === 'function') {
        mod.mountHome().catch(console.error).finally(() => {
          runSplitOutroIfPending();
          outroHandled = true;
        });
      } else {
        runSplitOutroIfPending();
        outroHandled = true;
      }
    });
  } else if (view === 'mapa') {
    // No requiere JS específico
  }

  setActiveNav();

  // Si esta vista no cargó módulos, ejecutar la salida ahora
  if (!outroHandled) {
    runSplitOutroIfPending();
  }
}

// Router sencillo basado en hash
function parseHash() {
  const hash = location.hash.replace(/^#/, '');
  const segs = hash.split('/').filter(Boolean);
  // "" -> home
  if (segs.length === 0) return { view: 'home', params: {} };
  if (segs[0] === '') return { view: 'home', params: {} };

  // /especies y /especies/:id
  if (segs[0] === 'especies') {
    return { view: 'especies', params: { id: segs[1] } };
  }
  if (segs[0] === 'form') return { view: 'form', params: {} };
  if (segs[0] === 'mapa') return { view: 'mapa', params: {} };
  if (segs[0] === 'admin') return { view: 'admin', params: {} };
  if (segs[0] === 'docs') return { view: 'docs', params: {} };

  return { view: 'home', params: {} };
}

function onRouteChange() {
  const { view, params } = parseHash();
  render(view, params);
}

window.addEventListener('hashchange', onRouteChange);
window.addEventListener('DOMContentLoaded', onRouteChange);

// Mejora: interceptar clicks de nav para usar rutas hash y evitar recargas
function wireNavLinksToHash() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  nav.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    // Si es admin, dejar navegar al archivo (página separada)
    if (a.matches('[data-requires-role="admin"]')) {
      // Si no tiene permisos, bloquea
      if (!canViewAdmin()) {
        e.preventDefault();
      }
      return;
    }
    const href = a.getAttribute('href') || '';
    // Si ya es hash (#/...), el manejador global de anchors se encarga
    if (href.startsWith('#/')) {
      return;
    }
    const url = new URL(href, location.href);
    // Mapeo de enlaces antiguos a rutas hash del SPA (excluye admin.html)
    const mapping = new Map([
      ['hub.html', '#/'],
      ['info_general.html', '#/docs'],
      ['aportes.html', '#/especies'],
      ['form.html', '#/form'],
      ['mapa.html', '#/mapa'],
    ]);
    const file = url.pathname.split('/').pop();
    if (mapping.has(file)) {
      e.preventDefault();
      const target = mapping.get(file);
      runSplitTransition(() => {
        if (target === '#/') location.hash = '';
        else location.hash = target;
      });
    }
  });
}

// Interceptar enlaces hash internos fuera del nav (CTAs y contenido)
function wireHashAnchors() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#/"]');
    if (!a) return;
    if (e.defaultPrevented) return;
    if (a.matches('[data-requires-role="admin"]') && !canViewAdmin()) {
      e.preventDefault();
      return;
    }
    const target = a.getAttribute('href');
    if (!target) return;
    e.preventDefault();
    if (location.hash === target) {
      // mismo hash: no hay cambio; opcionalmente podríamos forzar re-render
      return;
    }
    runSplitTransition(() => {
      location.hash = target;
    });
  });
}

// Permisos simples de ejemplo: usar localStorage('role') === 'admin' o isAdmin === '1'
// y verificar que exista un token JWT válido
function canViewAdmin() {
  try {
    // Verificar primero si hay un token JWT
    const token = sessionStorage.getItem('JWT');
    if (!token) return false;
    
    // Luego verificar los permisos
    const role = localStorage.getItem('role');
    const flag = localStorage.getItem('isAdmin');
    return (role === 'admin' || flag === '1') && !!token;
  } catch (_) {
    return false;
  }
}

function enforcePermissionsInNav() {
  const adminLinks = document.querySelectorAll('[data-requires-role="admin"]');
  const allowed = canViewAdmin();
  adminLinks.forEach(a => {
    if (!allowed) a.style.display = 'none';
  });
}

wireNavLinksToHash();
wireHashAnchors();
enforcePermissionsInNav();