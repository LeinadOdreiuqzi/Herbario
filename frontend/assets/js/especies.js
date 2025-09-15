import { qs, openModal } from './shared.js';
import { apiClient } from './apiClient.js';

let grid, searchInput, familyFilter;
function bindEls() {
  grid = qs('#speciesGrid');
  searchInput = qs('#searchInput');
  familyFilter = qs('#familyFilter');
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Estado en memoria para evitar múltiples GET durante navegación
let lastPlants = null; // último conjunto renderizado
let lastParamsKey = '';
let familiesInitialized = false;

// Caché persistente (fallback offline)
const CACHE_PREFIX = 'speciesCache:';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h
function makeKey(q, family) { return `${CACHE_PREFIX}${q}|${family}`; }
function saveCache(key, items) {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), items })); } catch {}
}
function loadCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, items } = JSON.parse(raw);
    if (!Array.isArray(items)) return null;
    if (Date.now() - Number(ts || 0) > CACHE_TTL_MS) return null;
    return items;
  } catch { return null; }
}

// Helpers
function buildImageUrl(id) {
  // Usa la misma URL base del apiClient si está configurada; si no, relativo
  const base = apiClient.baseUrl || '';
  return `${base}/plants/${encodeURIComponent(id)}/imagen`;
}

// Mapea la respuesta del backend actual (id, name, family) a un objeto de UI
function mapToUI(p) {
  const ui = {
    id: p.id,
    scientific_name: p.scientific_name || p.name,
    common_name: p.name,
    family: p.family ?? '',
    description: p.description || '',
    image_url: '',
    coordinates: (p.latitude && p.longitude) ? { lat: p.latitude, lng: p.longitude } : null
  };
  // Dado que el backend no expone flag, intentamos siempre construir la URL de imagen;
  // el <img> manejará onerror para ocultarse si 404.
  ui.image_url = buildImageUrl(p.id);
  return ui;
}

function renderCard(p) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = p.id; // Facilita selección por ID para rutas dinámicas

  const media = document.createElement('div');
  media.className = 'card-media';
  media.style.height = '160px';
  // background ahora viene de CSS
  media.style.background = '';
  media.style.display = 'flex';
  media.style.alignItems = 'center';
  media.style.justifyContent = 'center';
  media.style.overflow = 'hidden';

  if (p.image_url) {
    const img = document.createElement('img');
    img.src = p.image_url;
    img.alt = p.common_name || p.scientific_name || 'Imagen de planta';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    // Si la imagen no existe (404), ocultar el contenedor visual
    img.onerror = () => { media.style.display = 'none'; };
    media.appendChild(img);
  }
  card.appendChild(media);

  const body = document.createElement('div');
  body.className = 'card-body';

  const title = document.createElement('h3');
  title.className = 'card-title';
  const nameText = document.createTextNode((p.common_name || '—') + ' ');
  const sci = document.createElement('span');
  sci.className = 'card-meta';
  sci.textContent = `(${p.scientific_name || '—'})`;
  title.appendChild(nameText);
  title.appendChild(sci);

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  meta.textContent = p.family ?? '';

  body.appendChild(title);
  body.appendChild(meta);
  card.appendChild(body);

  card.addEventListener('click', () => openPlantModal(p));
  return card;
}

function openPlantModal(p) {
  const wrap = document.createElement('div');

  const h3 = document.createElement('h3');
  h3.id = 'modalTitle';
  const nameText = document.createTextNode((p.common_name || '—') + ' ');
  const sci = document.createElement('span');
  sci.className = 'card-meta';
  sci.textContent = `(${p.scientific_name || '—'})`;
  h3.appendChild(nameText);
  h3.appendChild(sci);

  const fam = document.createElement('p');
  const famStrong = document.createElement('strong');
  famStrong.textContent = 'Familia:';
  fam.appendChild(famStrong);
  fam.appendChild(document.createTextNode(' ' + (p.family ?? '—')));

  const desc = document.createElement('p');
  desc.textContent = p.description ?? '';

  if (p.image_url) {
    const img = document.createElement('img');
    img.src = p.image_url;
    img.alt = p.common_name || p.scientific_name || '';
    img.style.width = '100%';
    img.style.maxHeight = '60vh';
    img.style.objectFit = 'contain';
    img.style.borderRadius = '6px';
    img.style.margin = '12px 0';
    img.onerror = () => { img.remove(); };
    wrap.appendChild(img);
  }

  wrap.appendChild(h3);
  wrap.appendChild(fam);
  wrap.appendChild(desc);

  if (p.coordinates) {
    const coords = document.createElement('p');
    const cs = document.createElement('strong');
    cs.textContent = 'Coordenadas:';
    coords.appendChild(cs);
    coords.appendChild(document.createTextNode(` ${p.coordinates.lat}, ${p.coordinates.lng}`));
    wrap.appendChild(coords);
  }

  openModal(wrap);
}

async function fetchPlants({ q = '', family = '' } = {}) {
  const params = new URLSearchParams();
  params.set('status', 'accepted');
  if (q) params.set('q', q);
  if (family) params.set('family', family);
  const url = `/plants?${params.toString()}`;
  const { data, error } = await apiClient.request(url, { auth: false, cache: true, cacheTtl: 60000 });
  if (error) throw error;
  // Backend devuelve { data: slice, pagination }
  const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  return items.map(mapToUI);
}

function animateCardsIn(container) {
  // Animaciones de GSAP removidas por solicitud: aparición instantánea
  return;
}

async function renderGrid() {
  const loadingSpinner = qs('#loadingSpinner');
  const q = (searchInput?.value || '').trim();
  const family = (familyFilter?.value || '').trim();
  const key = `${q}|${family}`;
  try {
    if (lastPlants && lastParamsKey === key) {
      // Reutilizar resultados ya cargados para evitar re-render innecesario
      grid.innerHTML = '';
      lastPlants.forEach(p => grid.appendChild(renderCard(p)));
      if (loadingSpinner) loadingSpinner.style.display = 'none';
      animateCardsIn(grid);
      return;
    }

    const plants = await fetchPlants({ q, family });

    // Ocultar spinner
    if (loadingSpinner) loadingSpinner.style.display = 'none';

    grid.innerHTML = '';

    if (!plants.length) {
      const p = document.createElement('p');
      p.textContent = 'No hay especies aún.';
      p.className = 'no-results';
      grid.appendChild(p);
      lastPlants = [];
      lastParamsKey = key;
      return;
    }

    plants.forEach(p => grid.appendChild(renderCard(p)));
    animateCardsIn(grid);
    lastPlants = plants;
    lastParamsKey = key;
  } catch (err) {
    console.error(err);

    // Ocultar spinner
    if (loadingSpinner) loadingSpinner.style.display = 'none';

    grid.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = 'Error cargando especies: ' + (err.message || 'Error desconocido');
    p.className = 'error-message';
    grid.appendChild(p);
  }
}

// Poblar filtro de familias dinámicamente desde el mismo dataset ya obtenido
function populateFamiliesFrom(plants) {
  if (!familyFilter) return;
  const values = new Set(['']);
  plants.forEach(p => { if (p.family) values.add(p.family); });
  const arr = Array.from(values);
  arr.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  familyFilter.replaceChildren();
  for (const fam of arr) {
    const opt = document.createElement('option');
    opt.value = fam;
    opt.textContent = fam || 'Todas las familias';
    familyFilter.appendChild(opt);
  }
}

async function initFamilies() {
  // Preferir datos ya disponibles (memoria o caché) para poblar rápidamente
  if (lastPlants && lastPlants.length) {
    populateFamiliesFrom(lastPlants);
    familiesInitialized = true;
    return;
  }
  const cached = loadCache(makeKey('', ''));
  if (cached && cached.length) {
    populateFamiliesFrom(cached);
    familiesInitialized = true;
    return;
  }
  try {
    const preview = await fetchPlants({ q: '', family: '' });
    populateFamiliesFrom(preview);
    familiesInitialized = true;
  } catch (err) {
    console.error(err);
    // Si falla, no bloquear: el select conservará la opción por defecto
  }
}

function attachFilters() {
  if (searchInput) {
    let t;
    searchInput.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => renderGrid(), 240);
    });
  }
  if (familyFilter) {
    familyFilter.addEventListener('change', () => renderGrid());
  }
}

async function init() {
  await initFamilies();
  attachFilters();
  await renderGrid();
}

export async function mountEspecies() {
  bindEls();
  await init();
}

function startWhenReady() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}

// Eliminado: vt:ready one-shot y timeout redundante; el SPA llama mountEspecies()
// window.addEventListener('vt:ready', startWhenReady, { once: true });
// setTimeout(startWhenReady, 700);