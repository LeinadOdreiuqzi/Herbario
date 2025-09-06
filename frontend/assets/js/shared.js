// Utilidades compartidas del frontend
// Convertimos a ES Modules con exports (ya no usamos window.*)

export const qs = (sel, el = document) => el.querySelector(sel);
export const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));

export function openModal(content) {
  const modal = qs('#modal');
  const container = qs('#modalContent');
  if (!modal || !container) return;

  // Cancelar cierre en curso si lo hubiera
  if (modal._closingTimer) {
    clearTimeout(modal._closingTimer);
    modal._closingTimer = null;
    modal.classList.remove('closing');
  }

  container.replaceChildren();
  if (typeof content === 'string') {
    container.textContent = content;
  } else if (content instanceof Node) {
    container.appendChild(content);
  }
  // Guardar foco previo y abrir
  modal._lastActive = document.activeElement;
  modal.setAttribute('aria-hidden', 'false');
  // Mover foco al diálogo para accesibilidad
  requestAnimationFrame(() => {
    const dlg = qs('.modal-dialog', modal);
    if (dlg && typeof dlg.focus === 'function') {
      dlg.setAttribute('tabindex', '-1');
      dlg.focus();
    }
  });
}

export function closeModal() {
  const modal = qs('#modal');
  if (!modal) return;
  if (modal.getAttribute('aria-hidden') === 'true') return;

  // Evitar dobles cierres
  if (modal._closingTimer) {
    clearTimeout(modal._closingTimer);
    modal._closingTimer = null;
  }

  // Iniciar transición de salida y diferir ocultado
  modal.classList.add('closing');
  modal._closingTimer = setTimeout(() => {
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('closing');
    modal._closingTimer = null;
    // Devolver foco al elemento previo
    if (modal._lastActive && typeof modal._lastActive.focus === 'function') {
      modal._lastActive.focus();
    }
  }, 260); // debe coincidir con CSS (~240ms) con pequeño margen
}

document.addEventListener('click', (e) => {
  const closeAttr = e.target.closest('[data-close-modal]');
  if (closeAttr) {
    e.preventDefault();
    closeModal();
  }
});

// Marca dinámicamente el enlace activo en la navegación según la URL actual
export function setActiveNav() {
  try {
    const nav = qs('.nav');
    if (!nav) return;
    const links = qsa('a', nav);
    if (!links.length) return;

    // Limpiar estados previos
    links.forEach(a => {
      a.classList.remove('active');
      a.removeAttribute('aria-current');
    });

    // Preferir hash SPA (#/ruta)
    const hash = (location.hash || '').replace(/^#\/?/, '');
    const currentSeg = hash.split('/').filter(Boolean)[0] || '';
    let matched = false;

    for (const a of links) {
      const href = a.getAttribute('href') || '';
      if (!href) continue;
      if (href.startsWith('#/')) {
        const seg = href.replace(/^#\//, '').split('/')[0] || '';
        const isHomeLink = href === '#/' || seg === '';
        if ((currentSeg === '' && isHomeLink) || (seg && seg === currentSeg)) {
          a.classList.add('active');
          a.setAttribute('aria-current', 'page');
          matched = true;
          break;
        }
      }
    }

    if (matched) return;

    // Fallback por pathname (si hubiera enlaces absolutos)
    const currentPath = new URL(location.href).pathname;
    for (const a of links) {
      const linkPath = new URL(a.getAttribute('href'), location.href).pathname;
      if (linkPath === currentPath) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
        matched = true;
        break;
      }
    }

    if (matched) return;

    // Último fallback por nombre de archivo
    const currentFile = currentPath.split('/').pop();
    for (const a of links) {
      const linkFile = new URL(a.getAttribute('href'), location.href).pathname.split('/').pop();
      if (linkFile && linkFile === currentFile) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
        break;
      }
    }
  } catch (_) {
    // No bloquear si algo falla
  }
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Señal global para que las páginas inicien sus animaciones cuando la vista está lista
function dispatchViewReady() { /* no-op */ }

function createViewTransitionOverlay() {
  // Buscar por ID o clase para mayor compatibilidad
  let overlay = document.getElementById('vt-overlay') || document.querySelector('.vt-overlay');
  
  if (overlay) {
    // Reset overlay state
    overlay.classList.remove('enter', 'leave', 'cover');
    // Reset styles to ensure clean state
    overlay.style.cssText = 'visibility: hidden !important; pointer-events: none !important; display: flex !important; z-index: 2147483647 !important;';
    return overlay;
  }

  overlay = document.createElement('div');
  overlay.id = 'vt-overlay';
  overlay.className = 'vt-overlay';
  overlay.style.cssText = 'visibility: hidden !important; pointer-events: none !important; display: flex !important; z-index: 2147483647 !important;';
  
  const left = document.createElement('div');
  left.className = 'vt-pane';
  left.style.cssText = 'flex: 1 !important; height: 100% !important; transform: translateX(-100%);';
  
  const right = document.createElement('div');
  right.className = 'vt-pane';
  right.style.cssText = 'flex: 1 !important; height: 100% !important; transform: translateX(100%);';
  
  overlay.appendChild(left);
  overlay.appendChild(right);
  
  // Asegurar que se añade al final del body para evitar conflictos de z-index
  document.body.appendChild(overlay);
  
  // Forzar un reflow para asegurar que el navegador reconoce el elemento
  void overlay.offsetWidth;
  
  return overlay;
}

export function runSplitTransition(onNavigate) {
  if (prefersReducedMotion()) { onNavigate?.(); return; }
  
  // Crear y preparar el overlay
  const overlay = createViewTransitionOverlay();
  
  // Limpiar cualquier estado previo
  overlay.classList.remove('cover', 'leave', 'enter');
  
  // Configurar estado inicial: paneles fuera del viewport
  const [left, right] = overlay.children;
  
  // Resetear animaciones para evitar conflictos
  left.style.animation = 'none';
  right.style.animation = 'none';
  
  // Forzar reflow para asegurar que el reset de animación surta efecto
  void overlay.offsetWidth;
  
  // Resetear estilos para evitar conflictos con !important para mayor compatibilidad
  left.style.cssText = 'flex: 1 !important; height: 100% !important; transform: translateX(-100%); will-change: transform, opacity !important;';
  right.style.cssText = 'flex: 1 !important; height: 100% !important; transform: translateX(100%); will-change: transform, opacity !important;';
  
  // Establecer estilos del overlay explícitamente con !important
  overlay.style.cssText = 'visibility: visible !important; pointer-events: auto !important; display: flex !important; z-index: 2147483647 !important;';
  
  // Forzar reflow para aplicar los cambios iniciales
  void overlay.offsetWidth;
  
  // Usar setTimeout en lugar de requestAnimationFrame para mayor compatibilidad
  setTimeout(() => {
    // Aplicar clase para iniciar animación
    overlay.classList.add('enter');
    
    let done = 0;
    const onEnd = () => {
      done += 1;
      
      if (done >= 2) {
        overlay.classList.remove('enter');
        
        // Guardar estado para la transición de salida
        try { 
          sessionStorage.setItem('vtNext', '1');
        } catch (e) {}
        
        // Navegar después de un breve retraso
        setTimeout(() => { 
          if (onNavigate) {
            onNavigate(); 
          }
        }, 50);
      }
    };
    
    // Fallback en caso de que animationend no se dispare
    const fallback = setTimeout(() => {
      if (done < 2) {
        overlay.classList.remove('enter');
        try { sessionStorage.setItem('vtNext', '1'); } catch (_) {}
        onNavigate && onNavigate();
      }
    }, 600); // Tiempo mayor para asegurar compatibilidad
    
    // Escuchar eventos de fin de animación (estándar y prefijo webkit)
    [left, right].forEach((panel, i) => {
      const handleAnimEnd = (e) => {
        onEnd();
        if (done >= 2) clearTimeout(fallback);
      };
      
      panel.addEventListener('animationend', handleAnimEnd, { once: true });
      panel.addEventListener('webkitAnimationEnd', handleAnimEnd, { once: true });
    });
  }, 10); // Retraso mínimo para asegurar que los estilos iniciales se apliquen
}

export function runSplitOutroIfPending() {
  if (prefersReducedMotion()) { dispatchViewReady(); return; }
  
  // Verificar si hay una transición pendiente
  let pending = false;
  try {
    pending = sessionStorage.getItem('vtNext') === '1';
    if (pending) {
      sessionStorage.removeItem('vtNext');
    }
  } catch (e) {
    // No bloquear si algo falla
  }
  
  // Si no hay transición pendiente, simplemente notificar que la vista está lista
  if (!pending) { 
    dispatchViewReady(); 
    return; 
  }
  
  // Crear y preparar el overlay
  const overlay = createViewTransitionOverlay();
  
  // Limpiar cualquier estado previo y preparar para la salida
  overlay.classList.remove('enter', 'leave', 'cover');
  
  // Resetear animaciones para evitar conflictos
  const [left, right] = overlay.children;
  left.style.animation = 'none';
  right.style.animation = 'none';
  
  // Forzar reflow para asegurar que el reset de animación surta efecto
  void overlay.offsetWidth;
  
  // Resetear estilos con !important para mayor compatibilidad
  left.style.cssText = 'flex: 1 !important; height: 100% !important; transform: translateX(0); will-change: transform, opacity !important;';
  right.style.cssText = 'flex: 1 !important; height: 100% !important; transform: translateX(0); will-change: transform, opacity !important;';
  
  // Establecer estilos del overlay explícitamente con !important
  overlay.style.cssText = 'visibility: visible !important; pointer-events: auto !important; display: flex !important; z-index: 2147483647 !important;';
  
  // Añadir clase cover primero para asegurar que los paneles están en la posición correcta
  overlay.classList.add('cover');
  
  // Forzar reflow para aplicar los cambios iniciales
  void overlay.offsetWidth;
  
  // Usar setTimeout en lugar de requestAnimationFrame para mayor compatibilidad
  setTimeout(() => {
    // Cambiar de cover a leave
    overlay.classList.remove('cover');
    overlay.classList.add('leave');
    
    let done = 0;
    const onEnd = () => {
      done += 1;
      
      if (done >= 2) {
        // Limpiar clases y ocultar overlay
        overlay.classList.remove('leave');
        overlay.style.cssText = 'visibility: hidden !important; pointer-events: none !important;';
        // Notificar que la vista está lista
        dispatchViewReady();
      }
    };
    
    // Escuchar eventos estándar y con prefijo webkit
    const handleAnimEnd = (e) => {
      onEnd();
      if (done >= 2) clearTimeout(fallback);
    };
    
    left.addEventListener('animationend', handleAnimEnd, { once: true });
    left.addEventListener('webkitAnimationEnd', handleAnimEnd, { once: true });
    right.addEventListener('animationend', handleAnimEnd, { once: true });
    right.addEventListener('webkitAnimationEnd', handleAnimEnd, { once: true });
    
    // Fallback en caso de que animationend no se dispare
    const fallback = setTimeout(() => {
      if (done < 2) {
        overlay.classList.remove('leave');
        overlay.style.cssText = 'visibility: hidden !important; pointer-events: none !important;';
        dispatchViewReady();
      }
    }, 600); // Tiempo mayor para asegurar compatibilidad
  }, 10); // Retraso mínimo para asegurar que los estilos iniciales se apliquen
}

function shouldInterceptLink(a) {
  const url = new URL(a.href, location.href);
  const sameOrigin = url.origin === location.origin;
  if (!sameOrigin) return false;
  // Evitar anchors y descargas
  if (url.hash && url.pathname === location.pathname) return false;
  const ext = url.pathname.split('.').pop();
  // Interceptar solo navegación interna a otras páginas html del sitio
  return ['html', ''].includes(ext);
}

// Transición de vista en navegación
function wireViewTransitions() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    // Respetar handlers previos (por ejemplo el router SPA sobre la barra de navegación)
    if (e.defaultPrevented) return;
    if (!shouldInterceptLink(a)) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;

    e.preventDefault();
    const href = a.getAttribute('href');
    runSplitTransition(() => { window.location.href = href; });
  });
}

// Ejecutar cuando el DOM esté listo (y también inmediatamente si ya cargó)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { setActiveNav(); wireViewTransitions(); runSplitOutroIfPending(); });
} else {
  setActiveNav();
  wireViewTransitions();
  runSplitOutroIfPending();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = qs('#modal');
    if (modal && modal.getAttribute('aria-hidden') === 'false') {
      e.preventDefault();
      closeModal();
    }
  }
});