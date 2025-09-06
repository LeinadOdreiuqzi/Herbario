// apiClient.js - Cliente frontend para la API del backend
// - Expone apiClient con un método request flexible y helpers de auth (login/logout)

// Base URL configurable: prioriza window.__API_BASE, si no usa el mismo origen
const API_BASE = (typeof window !== 'undefined' && window.__API_BASE)
  ? String(window.__API_BASE).replace(/\/$/, '')
  : '';

// Gestión simple de token JWT del backend (guardado en sessionStorage)
const TOKEN_KEY = 'JWT';
export function getToken() {
  try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
export function setToken(token) {
  try { sessionStorage.setItem(TOKEN_KEY, token || ''); } catch {}
}
export function clearToken() {
  try { 
    sessionStorage.removeItem(TOKEN_KEY);
    // Limpiar también cualquier otro dato de sesión que pudiera existir
    localStorage.removeItem('role');
    localStorage.removeItem('isAdmin');
  } catch {}
}

function buildUrl(path) {
  if (!path) return '/';
  // Si viene absoluta (http/https), respetar
  if (/^https?:\/\//i.test(path)) return path;
  // Asegurar prefijo '/'
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

async function parseResponse(res) {
  const contentType = res.headers.get('Content-Type') || '';
  let data = null;
  try {
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }
  } catch (e) {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

function ensureHeaders(h) {
  // Normalizar a Headers
  if (h instanceof Headers) return h;
  const headers = new Headers();
  if (h && typeof h === 'object') {
    for (const [k, v] of Object.entries(h)) headers.set(k, v);
  }
  return headers;
}

// Caché simple en memoria para GET públicos
const _cache = new Map(); // key -> { ts, result }
const DEFAULT_TTL = 30000; // 30s

// Cliente API principal
export const apiClient = {
  get baseUrl() { return API_BASE || ''; },

  // options: { method, headers, body, auth=true, bearer, cache, cacheTtl }
  async request(path, options = {}) {
    const url = buildUrl(path);
    const opts = { ...options };
    const method = (opts.method || 'GET').toUpperCase();
    const headers = ensureHeaders(opts.headers);

    // Autenticación (por defecto activada)
    const useAuth = opts.auth !== false;

    if (useAuth) {
      // Prioridad: bearer explícito -> token guardado (se elimina soporte Basic)
      const explicitBearer = opts.bearer && String(opts.bearer);
      const stored = getToken();

      if (explicitBearer) {
        headers.set('Authorization', `Bearer ${explicitBearer}`);
      } else if (stored) {
        headers.set('Authorization', `Bearer ${stored}`);
      }
    }

    // Body y Content-Type
    const hasBody = opts.body != null && method !== 'GET' && method !== 'HEAD';
    if (hasBody && !headers.has('Content-Type')) {
      // Si ya te pasan FormData/Blob, no forzar JSON
      if (typeof opts.body === 'string') {
        headers.set('Content-Type', 'application/json');
      } else if (!(opts.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
        opts.body = JSON.stringify(opts.body);
      }
    }

    // Lectura desde caché para GET públicos (auth:false por defecto) salvo que se desactive con cache:false
    const isGet = method === 'GET';
    const cacheAllowed = isGet && (opts.auth === false) && (opts.cache !== false);
    const ttl = Number.isFinite(opts.cacheTtl) ? Number(opts.cacheTtl) : DEFAULT_TTL;
    const cacheKey = cacheAllowed ? url : null;

    if (cacheAllowed && _cache.has(cacheKey)) {
      const entry = _cache.get(cacheKey);
      if (entry && (Date.now() - entry.ts) < ttl) {
        return entry.result;
      } else {
        _cache.delete(cacheKey);
      }
    }

    // Construir opciones de fetch sin pasar flags internos (cache, cacheTtl, auth, bearer)
    const fetchOptions = { method, headers };
    if (hasBody) fetchOptions.body = opts.body;
    // Propagar otras opciones de fetch estándar si se proporcionaran (mode, credentials, etc.)
    for (const key of Object.keys(opts)) {
      if (['method','headers','body','cache','cacheTtl','auth','bearer'].includes(key)) continue;
      fetchOptions[key] = opts[key];
    }

    const res = await fetch(url, fetchOptions);
    const { status, ok, data } = await parseResponse(res);

    if (!ok) {
      const message = (data && (data.message || data.error || data.detail)) || `HTTP ${status}`;
      return { data: null, error: new Error(message), status };
    }

    const result = { data, error: null, status };

    if (cacheAllowed) {
      _cache.set(cacheKey, { ts: Date.now(), result });
    } else if (!isGet) {
      // Invalida caché simple ante mutaciones públicas (poco probable en este proyecto)
      _cache.clear();
    }

    return result;
  },

  // Login backend y almacenamiento de token
  async login(email, password) {
    try {
      const { data, error } = await this.request('/auth/login', {
        method: 'POST',
        auth: false,
        body: { email, password }
      });
      if (error) throw error;
      if (data?.token) setToken(data.token);
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  async verify() {
    try {
      const { data, error } = await this.request('/auth/verify');
      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  },

  async logout() {
    clearToken();
    try {
      const { data } = await this.request('/auth/logout', { method: 'POST', auth: false });
      return { data, error: null };
    } catch (err) {
      // Aun si falla, limpiamos token local
      return { data: null, error: err };
    }
  }
};