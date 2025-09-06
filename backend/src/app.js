import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import routes from './routes/index.js';
import { config } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

// Desactivar cabecera de Express
app.disable('x-powered-by');

// Confiar en proxy (para req.secure y HSTS) en producción
if (config.env === 'production') {
  app.set('trust proxy', 1);
}

// Seguridad de cabeceras con Helmet + CSP
const allowedOrigins = (config.frontend.allowedOrigins || [config.frontend.origin]).filter(Boolean).map(o => o.trim());

// Definir directivas CSP con excepciones mínimas necesarias para el frontend
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"], // ya no se requiere import dinámico desde esm.sh
  styleSrc: ["'self'", "'unsafe-inline'"], // hay estilos inline en HTML
  imgSrc: ["'self'", 'data:', 'blob:'],
  connectSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  frameAncestors: ["'self'"], // permitir que nuestros recursos (p.ej. PDFs) se embezan desde la misma origin
  frameSrc: ["'self'", 'https://padlet.com', 'blob:'] // permitir blob: para visor PDF en iframe
};
if (config.env !== 'production') {
  // Evitar problemas en desarrollo sin HTTPS
  cspDirectives.upgradeInsecureRequests = null;
}

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: cspDirectives
  },
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' }
}));

// HSTS solo en producción (requiere HTTPS en el terminador TLS)
if (config.env === 'production') {
  app.use(helmet.hsts({ maxAge: 15552000, includeSubDomains: true, preload: false })); // 180 días
}

// Forzar HTTPS en producción (si llega por HTTP y estamos tras proxy)
app.use((req, res, next) => {
  if (config.env === 'production') {
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (!isSecure) {
      const host = req.headers.host;
      return res.redirect(301, `https://${host}${req.originalUrl}`);
    }
  }
  next();
});

// CORS estricto
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // same-origin / herramientas CLI
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: [],
  credentials: false,
  maxAge: 600
}));

// Límite global de peticiones
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300, // 300 req/15min/IP
  standardHeaders: 'draft-7',
  legacyHeaders: false
});
app.use(globalLimiter);

// Verificación de origen para métodos con estado (mitiga CSRF)
app.use((req, res, next) => {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const isAllowedOrigin = (o) => !!o && allowedOrigins.includes(o);
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ error: true, message: 'Origen no permitido' });
  }
  if (!origin && referer) {
    try {
      const u = new URL(referer);
      const refOrigin = `${u.protocol}//${u.host}`;
      if (!isAllowedOrigin(refOrigin)) {
        return res.status(403).json({ error: true, message: 'Referer no permitido' });
      }
    } catch (_) {
      // Referer inválido: bloquear
      return res.status(403).json({ error: true, message: 'Referer inválido' });
    }
  }
  return next();
});

app.use(express.json({ limit: config.upload.maxSize || '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Preparar carpeta pública del frontend
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '..', '..', 'frontend');

// Servir archivos estáticos del frontend antes de las rutas API, con index deshabilitado
// para que la raíz '/' siga devolviendo el JSON del API
app.use(express.static(publicDir, { index: false }));

// Rutas API
app.use('/', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: true, message: 'Ruta no encontrada' });
});

// Error handler
app.use(errorHandler);

export default app;