import { AppError } from '../utils/errorHandler.js';

export function validateSubmission(req, _res, next) {
  const body = req.body || {};
  const errors = [];
  const fields = ['name', 'scientific_name', 'family', 'description', 'latitude', 'longitude'];
  for (const key of Object.keys(body)) {
    if (!fields.includes(key)) errors.push(`Campo no permitido: ${key}`);
  }
  if (!body.name && !body.scientific_name) errors.push('Se requiere name o scientific_name');
  if (body.latitude != null && isNaN(Number(body.latitude))) errors.push('latitude debe ser numérico');
  if (body.longitude != null && isNaN(Number(body.longitude))) errors.push('longitude debe ser numérico');
  if (errors.length) throw new AppError('Validación fallida', 400, 'VALIDATION_ERROR', errors);
  next();
}

export function validateUpdate(req, _res, next) {
  const body = req.body || {};
  const allowed = ['name', 'family', 'scientific_name', 'description', 'latitude', 'longitude', 'status'];
  const errors = [];
  if (!Object.keys(body).length) errors.push('No hay cambios para actualizar');
  for (const k of Object.keys(body)) if (!allowed.includes(k)) errors.push(`Campo no permitido: ${k}`);
  if (body.latitude != null && isNaN(Number(body.latitude))) errors.push('latitude debe ser numérico');
  if (body.longitude != null && isNaN(Number(body.longitude))) errors.push('longitude debe ser numérico');
  if (errors.length) throw new AppError('Validación fallida', 400, 'VALIDATION_ERROR', errors);
  next();
}

export function validateLogin(req, _res, next) {
  const body = req.body || {};
  const errors = [];
  const email = String(body.email ?? '').trim();
  const password = String(body.password ?? '');
  if (!email) errors.push('Email es requerido');
  if (!password) errors.push('Contraseña es requerida');
  // Validación básica de email y longitud de password
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (email && !emailRe.test(email)) errors.push('Email inválido');
  if (password && (password.length < 8 || password.length > 128)) errors.push('La contraseña debe tener entre 8 y 128 caracteres');
  if (errors.length) throw new AppError('Validación fallida', 400, 'VALIDATION_ERROR', errors);
  next();
}

export function validateListQuery(req, _res, next) {
  const q = req.query || {};
  const errors = [];
  const allowed = ['status', 'q', 'family', 'page', 'pageSize'];
  for (const k of Object.keys(q)) if (!allowed.includes(k)) errors.push(`Parámetro no permitido: ${k}`);
  if (q.page != null && (!/^\d+$/.test(String(q.page)) || Number(q.page) < 1)) errors.push('page debe ser un entero >= 1');
  if (q.pageSize != null && (!/^\d+$/.test(String(q.pageSize)) || Number(q.pageSize) < 1 || Number(q.pageSize) > 100)) errors.push('pageSize debe ser un entero entre 1 y 100');
  if (q.status != null && !['pending', 'accepted', 'rejected', ''].includes(String(q.status))) errors.push('status inválido');
  if (errors.length) throw new AppError('Validación fallida', 400, 'VALIDATION_ERROR', errors);
  next();
}