import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

// Autenticación estricta por Bearer JWT con rol admin (se elimina soporte Basic)
export function adminAuth(req, res, next) {
  try {
    const header = req.headers['authorization'] || '';
    if (!header) return res.status(401).json({ error: true, message: 'No autorizado' });

    // Solo Bearer JWT
    if (header.startsWith('Bearer ')) {
      const token = header.substring(7);
      try {
        const decoded = jwt.verify(token, config.jwt.secret);
        if (decoded?.role !== 'admin') return res.status(403).json({ error: true, message: 'Requiere rol administrador' });
        req.user = { id: decoded.sub, email: decoded.email, role: decoded.role };
        return next();
      } catch (e) {
        return res.status(401).json({ error: true, message: 'Token inválido o expirado' });
      }
    }

    return res.status(401).json({ error: true, message: 'Esquema de autorización no soportado (usa Bearer JWT)' });
  } catch (err) {
    next(err);
  }
}

export function requireAdminForNonPublicList(req, res, next) {
  const status = String(req.query.status || '').trim();
  // Public only when explicitly requesting accepted items
  if (status === 'accepted') return next();
  // For any other status or when no status provided, require admin
  return adminAuth(req, res, next);
}