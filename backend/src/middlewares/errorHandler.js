export function errorHandler(err, req, res, _next) {
  const correlationId = req.headers['x-correlation-id'] || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';

  // Log minimalista en producción
  if (process.env.NODE_ENV === 'production') {
    console.error('[Error]', { code, status, path: req.path, method: req.method, correlationId, message: err.message });
  } else {
    console.error('[Error]', err);
  }

  const payload = {
    error: true,
    code,
    message: status >= 500 ? 'Error interno del servidor' : (err.message || 'Solicitud inválida'),
    correlationId
  };

  // Incluir detalles solo si no es producción y existen
  if (process.env.NODE_ENV !== 'production' && err.details) {
    payload.details = err.details;
  }

  res.status(status).json(payload);
}