// admin.js - Panel administrativo usando la API del backend 
import { qs } from './shared.js';
import { apiClient } from './apiClient.js';

// Referencias a elementos del DOM
const loginSection = qs('#loginSection');
const loginForm = qs('#loginForm');
const inputEmail = qs('#login_email');
const inputPassword = qs('#login_password');
const btnLogout = qs('#btnLogout');
const sessionInfo = qs('#sessionInfo');
const pendingSection = qs('#pendingSection');
const acceptedSection = qs('#acceptedSection');
const pendingList = qs('#pendingList');
const acceptedList = qs('#acceptedList');
const toast = qs('#toast');

// Helper para construir URL de imagen
function buildImageUrl(id) {
  const base = apiClient.baseUrl || '';
  return `${base}/plants/${encodeURIComponent(id)}/imagen`;
}

// Estado global de la sesión
let currentUser = null;
let isAuthenticated = false;

// Utilidades para mostrar mensajes
function showToast(msg, timeout = 2200) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), timeout);
}

// Protección contra navegación hacia atrás después de cerrar sesión
function setupHistoryProtection() {
  // Prevenir navegación hacia atrás después de cerrar sesión
  window.addEventListener('pageshow', (event) => {
    // Si la página se carga desde caché (navegación hacia atrás)
    if (event.persisted) {
      // Verificar sesión inmediatamente
      verifySessionAndRedirect();
    }
  });

  // Verificar sesión cuando la ventana recupera el foco
  window.addEventListener('focus', verifySessionAndRedirect);
}

// Verificar sesión y redirigir si no es válida
async function verifySessionAndRedirect() {
  // Si no hay token, no redirigimos: permitimos mostrar el formulario de login
  let token = '';
  try { token = sessionStorage.getItem('JWT') || ''; } catch (_) { token = ''; }

  if (!token) {
    // Actualizar UI para asegurar que se muestra el formulario de login
    await updateUIAuth();
    return false;
  }

  try {
    const { data, error } = await apiClient.verify();
    
    if (error || !data?.user) {
      // Si había token pero no es válido, redirigir al inicio
      redirectToHome();
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Admin] Error verificando sesión:', err);
    // Ante error con token presente, redirigir
    redirectToHome();
    return false;
  }
}

// Redirigir a la página principal
function redirectToHome() {
  // Limpiar cualquier token que pudiera quedar
  apiClient.logout().catch(() => {});
  // Redirigir a la página principal
  window.location.href = './index.html#/';
}

// Verificar y actualizar el estado de autenticación
async function updateUIAuth() {
  try {
    const { data, error } = await apiClient.verify();
    
    if (error || !data?.user) {
      // No hay sesión válida
      currentUser = null;
      isAuthenticated = false;
    } else {
      // Sesión válida
      currentUser = data.user;
      isAuthenticated = true;
    }
  } catch (err) {
    console.warn('[Admin] Error verificando sesión:', err);
    currentUser = null;
    isAuthenticated = false;
  }

  console.info('[Admin] updateUIAuth: autenticado =', isAuthenticated);

  // Actualizar la interfaz según el estado de autenticación
  loginForm.style.display = isAuthenticated ? 'none' : 'grid';
  btnLogout.style.display = isAuthenticated ? 'inline-block' : 'none';
  pendingSection.style.display = isAuthenticated ? 'block' : 'none';
  acceptedSection.style.display = isAuthenticated ? 'block' : 'none';

  // Mostrar información de la sesión
  if (sessionInfo) {
    if (isAuthenticated && currentUser) {
      const email = currentUser.email || '(sin email)';
      const shortId = (currentUser.id || '').toString().slice(0, 8);
      sessionInfo.textContent = `Sesión: ${email}${shortId ? ` (${shortId}…)` : ''}`;
      sessionInfo.style.display = 'block';
    } else {
      sessionInfo.textContent = '';
      sessionInfo.style.display = 'none';
    }
  }
}

// Renderizar tarjeta de planta
function renderCard(item, scope) {
  const card = document.createElement('div');
  card.className = 'card';

  // Media (imagen si existe)
  const media = document.createElement('div');
  media.className = 'card-media';
  media.style.height = '140px';
  // background ahora viene de CSS
  media.style.background = '';
  media.style.display = 'flex';
  media.style.alignItems = 'center';
  media.style.justifyContent = 'center';
  media.style.overflow = 'hidden';

  const imgUrl = buildImageUrl(item.id);
  const img = document.createElement('img');
  img.src = imgUrl;
  img.alt = item.name || item.scientific_name || 'Imagen';
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'cover';
  img.onerror = () => { media.style.display = 'none'; };
  media.appendChild(img);
  card.appendChild(media);

  const body = document.createElement('div');
  body.className = 'card-body';

  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = `${item.name || '—'} ${item.scientific_name ? `(${item.scientific_name})` : ''}`;

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  meta.textContent = item.family || '';

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '8px';

  if (scope === 'pending') {
    const btnAccept = document.createElement('button');
    btnAccept.className = 'btn';
    btnAccept.textContent = 'Aceptar';
    btnAccept.addEventListener('click', () => acceptPlant(item.id));

    const btnReject = document.createElement('button');
    btnReject.className = 'btn btn-secondary';
    btnReject.textContent = 'Rechazar';
    btnReject.addEventListener('click', () => rejectPlant(item.id, 'pending'));

    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn btn-secondary';
    btnEdit.textContent = 'Editar';
    btnEdit.addEventListener('click', () => editPlant(item, 'pending'));

    actions.appendChild(btnAccept);
    actions.appendChild(btnReject);
    actions.appendChild(btnEdit);
  } else {
    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn btn-secondary';
    btnEdit.textContent = 'Editar';
    btnEdit.addEventListener('click', () => editPlant(item, 'accepted'));

    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn btn-secondary';
    btnDelete.textContent = 'Eliminar';
    btnDelete.addEventListener('click', () => rejectPlant(item.id, 'accepted'));

    actions.appendChild(btnEdit);
    actions.appendChild(btnDelete);
  }

  body.appendChild(title);
  body.appendChild(meta);
  body.appendChild(actions);
  card.appendChild(body);
  return card;
}

// Cargar plantas pendientes
async function loadPending() {
  pendingList.replaceChildren();
  try {
    const { data, error } = await apiClient.request('/plants?status=pending');

    if (error) throw error;

    const raw = data?.data ?? data; // soporta {data, pagination} o array plano
    const rows = Array.isArray(raw) ? [...raw] : [];
    rows.sort((a, b) => {
      const aT = a?.created_at ? Date.parse(a.created_at) : 0;
      const bT = b?.created_at ? Date.parse(b.created_at) : 0;
      return bT - aT;
    });

    if (!rows.length) {
      const p = document.createElement('p');
      p.textContent = 'No hay solicitudes pendientes.';
      pendingList.appendChild(p);
      return;
    }

    rows.forEach(it => pendingList.appendChild(renderCard(it, 'pending')));
  } catch (err) {
    console.error('[Admin] loadPending error:', err?.message || err);
    const p = document.createElement('p');
    p.textContent = 'Error al cargar pendientes.';
    pendingList.appendChild(p);
  }
}

// Cargar plantas aceptadas
async function loadAccepted() {
  acceptedList.replaceChildren();
  try {
    const { data, error } = await apiClient.request('/plants?status=accepted');

    if (error) throw error;

    const raw = data?.data ?? data; // soporta {data, pagination} o array plano
    const rows = Array.isArray(raw) ? [...raw] : [];
    rows.sort((a, b) => {
      const aT = a?.created_at ? Date.parse(a.created_at) : 0;
      const bT = b?.created_at ? Date.parse(b.created_at) : 0;
      return bT - aT;
    });

    if (!rows.length) {
      const p = document.createElement('p');
      p.textContent = 'No hay especies aceptadas.';
      acceptedList.appendChild(p);
      return;
    }
    rows.forEach(it => acceptedList.appendChild(renderCard(it, 'accepted')));
  } catch (err) {
    console.error('[Admin] loadAccepted error:', err?.message || err);
    const p = document.createElement('p');
    p.textContent = 'Error al cargar aceptadas.';
    acceptedList.appendChild(p);
  }
}

// Aceptar una planta
async function acceptPlant(id) {
  try {
    const { error } = await apiClient.request(`/plants/${id}/accept`, {
      method: 'PUT'
    });

    if (error) throw error;

    showToast('Solicitud aceptada');
    await Promise.all([loadPending(), loadAccepted()]);
  } catch (err) {
    console.error('[Admin] acceptPlant error:', err?.message || err);
    showToast('Error al aceptar');
  }
}

// Rechazar/eliminar una planta
async function rejectPlant(id, scope) {
  if (!confirm('¿Seguro que deseas rechazar/eliminar esta solicitud?')) return;
  try {
    let endpoint;
    let method;
    if (scope === 'pending') {
      endpoint = `/plants/${id}/reject`;
      method = 'PUT';
    } else {
      endpoint = `/plants/${id}`;
      method = 'DELETE';
    }

    const { error } = await apiClient.request(endpoint, { method });
    if (error) throw error;

    showToast('Solicitud eliminada');
    await Promise.all([loadPending(), loadAccepted()]);
  } catch (err) {
    console.error('[Admin] rejectPlant error:', err?.message || err);
    showToast('Error al eliminar');
  }
}

// Editar una planta
// Crear/reutilizar modal de edición
let editModalEl = null;
let editFormEl = null;
let editItemOriginal = null;

function ensureEditModal() {
  if (editModalEl) return editModalEl;
  const overlay = document.createElement('div');
  overlay.id = 'editModalOverlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.45)';
  overlay.style.display = 'none';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '9999';

  const dialog = document.createElement('div');
  dialog.style.width = 'min(740px, 96vw)';
  dialog.style.maxHeight = '90vh';
  dialog.style.overflow = 'auto';
  dialog.style.background = 'var(--bg-elev)';
  dialog.style.borderRadius = '12px';
  dialog.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
  dialog.style.padding = '20px';

  const title = document.createElement('h3');
  title.textContent = 'Editar especie';
  title.style.marginTop = '0';

  const form = document.createElement('form');
  form.className = 'form-grid';

  form.innerHTML = `
    <div class="form-field">
      <label for="edit_name">Nombre (name)</label>
      <input type="text" id="edit_name" placeholder="Nombre" />
    </div>
    <div class="form-field">
      <label for="edit_scientific_name">Nombre científico (scientific_name)</label>
      <input type="text" id="edit_scientific_name" placeholder="Nombre científico" />
    </div>
    <div class="form-field">
      <label for="edit_family">Familia (family)</label>
      <input type="text" id="edit_family" placeholder="Familia" />
    </div>
    <div class="form-field" style="grid-column:1/-1;">
      <label for="edit_description">Descripción</label>
      <textarea id="edit_description" rows="4" placeholder="Descripción"></textarea>
    </div>
    <div class="form-field">
      <label for="edit_latitude">Latitud</label>
      <input type="number" step="any" id="edit_latitude" placeholder="Latitud" />
    </div>
    <div class="form-field">
      <label for="edit_longitude">Longitud</label>
      <input type="number" step="any" id="edit_longitude" placeholder="Longitud" />
    </div>
    <div style="grid-column:1/-1;display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
      <button type="button" id="edit_cancel" class="btn btn-secondary">Cancelar</button>
      <button type="submit" class="btn">Guardar cambios</button>
    </div>
  `;

  dialog.appendChild(title);
  dialog.appendChild(form);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeEditModal();
  });
  document.addEventListener('keydown', (e) => {
    if (overlay.style.display !== 'none' && e.key === 'Escape') closeEditModal();
  });

  const cancelBtn = form.querySelector('#edit_cancel');
  cancelBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeEditModal();
  });

  form.addEventListener('submit', onEditFormSubmit);

  editModalEl = overlay;
  editFormEl = form;
  return overlay;
}

function openEditModal(item) {
  ensureEditModal();
  editItemOriginal = { ...item };

  editFormEl.querySelector('#edit_name').value = item.name || '';
  editFormEl.querySelector('#edit_scientific_name').value = item.scientific_name || '';
  editFormEl.querySelector('#edit_family').value = item.family || '';
  editFormEl.querySelector('#edit_description').value = item.description || '';
  editFormEl.querySelector('#edit_latitude').value = (item.latitude ?? '') === null ? '' : String(item.latitude ?? '');
  editFormEl.querySelector('#edit_longitude').value = (item.longitude ?? '') === null ? '' : String(item.longitude ?? '');

  editModalEl.style.display = 'flex';
}

function closeEditModal() {
  if (editModalEl) editModalEl.style.display = 'none';
  editItemOriginal = null;
}

async function onEditFormSubmit(e) {
  e.preventDefault();
  if (!editItemOriginal) return closeEditModal();

  const name = editFormEl.querySelector('#edit_name').value.trim();
  const scientific_name = editFormEl.querySelector('#edit_scientific_name').value.trim();
  const family = editFormEl.querySelector('#edit_family').value.trim();
  const description = editFormEl.querySelector('#edit_description').value.trim();
  const latRaw = editFormEl.querySelector('#edit_latitude').value.trim();
  const lngRaw = editFormEl.querySelector('#edit_longitude').value.trim();

  const payload = {
    name,
    scientific_name,
    family,
    description,
    latitude: latRaw === '' ? '' : latRaw,
    longitude: lngRaw === '' ? '' : lngRaw
  };

  const changed = (
    (payload.name !== (editItemOriginal.name || '')) ||
    (payload.scientific_name !== (editItemOriginal.scientific_name || '')) ||
    (payload.family !== (editItemOriginal.family || '')) ||
    (payload.description !== (editItemOriginal.description || '')) ||
    (String(payload.latitude ?? '') !== String(editItemOriginal.latitude ?? '')) ||
    (String(payload.longitude ?? '') !== String(editItemOriginal.longitude ?? ''))
  );

  if (!changed) {
    showToast('Sin cambios');
    return;
  }

  try {
    const { error } = await apiClient.request(`/plants/${editItemOriginal.id}`, {
      method: 'PUT',
      body: payload
    });
    if (error) throw error;

    showToast('Solicitud actualizada');
    closeEditModal();
    await Promise.all([loadPending(), loadAccepted()]);
  } catch (err) {
    console.error('[Admin] edit submit error:', err?.message || err);
    showToast('Error al actualizar');
  }
}

async function editPlant(item, _scope) {
  openEditModal(item);
}

// Manejar login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = inputEmail.value.trim();
  const password = inputPassword.value;
  
  console.info('[Admin] Intento de login con email:', email || '(vacío)');
  if (!email || !password) {
    showToast('Email y contraseña son requeridos');
    return;
  }

  try {
    const { data, error } = await apiClient.login(email, password);
    
    if (error || !data?.token) {
      console.warn('[Admin] Login fallido:', error?.message || 'sin token');
      throw error || new Error('Login fallido');
    }

    console.info('[Admin] Login OK, usuario:', data.user?.email);
    inputPassword.value = '';
    showToast('Sesión iniciada');
    
    await updateUIAuth();
    await Promise.all([loadAccepted(), loadPending()]);
    initInactivityWatcher();
  } catch (err) {
    console.error('[Admin] Error en login:', err?.message || err);
    showToast(err?.message || 'Credenciales inválidas');
  }
});

// Manejar logout
btnLogout.addEventListener('click', async () => {
  try {
    await apiClient.logout();
    await updateUIAuth();
    showToast('Sesión cerrada');
    acceptedList.replaceChildren();
    pendingList.replaceChildren();
    stopInactivityWatcher();
    // Solo cargar plantas públicas después del logout
    loadAccepted();
    // Redirigir a la página principal después de cerrar sesión
    setTimeout(() => {
      window.location.href = './index.html#/';
    }, 1000);
  } catch (err) {
    console.error('[Admin] Error en logout:', err?.message || err);
    // Aún así actualizar la UI
    await updateUIAuth();
    showToast('Sesión cerrada');
    acceptedList.replaceChildren();
    pendingList.replaceChildren();
    stopInactivityWatcher();
    loadAccepted();
    // Redirigir a la página principal después de cerrar sesión
    setTimeout(() => {
      window.location.href = './index.html#/';
    }, 1000);
  }
});

// Auto-logout por inactividad (15 min)
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutos
let inactivityTimer = null;
let inactivityListenersAttached = false;

function stopInactivityWatcher() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
}

function resetInactivityTimer() {
  stopInactivityWatcher();
  inactivityTimer = setTimeout(async () => {
    try {
      // Verificar que aún hay sesión antes de cerrarla
      const { data } = await apiClient.verify();
      if (data?.user) {
        showToast('Sesión terminada por inactividad');
        await apiClient.logout();
        await updateUIAuth();
        acceptedList.replaceChildren();
        pendingList.replaceChildren();
        stopInactivityWatcher();
        loadAccepted();
      }
    } catch (e) {
      console.warn('[Admin] Auto-logout error:', e?.message || e);
    }
  }, INACTIVITY_LIMIT_MS);
}

function initInactivityWatcher() {
  if (!inactivityListenersAttached) {
    const handler = () => {
      if (document.visibilityState === 'hidden') return;
      resetInactivityTimer();
    };
    ['click', 'keydown', 'mousemove', 'scroll', 'touchstart', 'visibilitychange']
      .forEach(ev => window.addEventListener(ev, handler, { passive: true }));
    inactivityListenersAttached = true;
  }
  resetInactivityTimer();
}

// Inicialización del panel admin
async function init() {
  setupHistoryProtection();
  
  try {
    const { data, error } = await apiClient.verify();
    
    if (error || !data?.user) {
      // No hay sesión válida, mostrar solo el formulario de login
      currentUser = null;
      isAuthenticated = false;
    } else {
      // Sesión válida, mostrar panel completo
      currentUser = data.user;
      isAuthenticated = true;
      
      // Cargar datos solo si hay sesión válida
      await Promise.all([
        loadPendingSubmissions(),
        loadAcceptedSubmissions()
      ]);
    }
  } catch (err) {
    console.warn('[Admin] Error en inicialización:', err);
    currentUser = null;
    isAuthenticated = false;
  }
  
  // Actualizar la interfaz según el estado de autenticación
  updateUIAuth();
  
  // Iniciar el watcher de inactividad solo si está autenticado
  if (isAuthenticated) {
    startInactivityWatcher();
    initInactivityWatcher();
  }
  
  // Siempre cargar plantas aceptadas (públicas)
  loadAccepted();
  
  // Solo cargar pendientes si hay sesión autenticada
  if (isAuthenticated) {
    loadPending();
  }
}

// Llamar a la función de inicialización
init().catch(err => {
  console.error('[Admin] Error en inicialización:', err);
  showToast('Error al inicializar el panel admin');
});