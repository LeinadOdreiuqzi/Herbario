import { AppError, asyncHandler } from '../utils/errorHandler.js';
import { createSubmission, listPlants, getById, accept, reject, update, remove, getImageData, countByStatus, countPending, countPlants } from '../repositories/plants.repository.js';

export const submit = asyncHandler(async (req, res) => {
  const item = await createSubmission(req.body || {}, req.file);
  res.status(201).json({ success: true, data: item });
});

export const list = asyncHandler(async (req, res) => {
  const filters = {
    status: (req.query.status || '').trim() || null,
    q: (req.query.q || '').trim() || null,
    family: (req.query.family || '').trim() || null,
    page: Math.max(1, Number(req.query.page) || 1),
    pageSize: Math.min(100, Math.max(1, Number(req.query.pageSize) || 20))
  };

  const items = await listPlants(filters);
  const total = await countPlants(filters);
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  res.json({ data: items, pagination: { page: filters.page, pageSize: filters.pageSize, total, totalPages } });
});

export const acceptOne = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const adminId = req.user?.id || null;
  const it = await accept(id, adminId);
  if (!it) throw new AppError('No encontrado', 404, 'NOT_FOUND');
  res.json({ success: true, data: it });
});

export const rejectOne = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const adminId = req.user?.id || null;
  const it = await reject(id, adminId);
  if (!it) throw new AppError('No encontrado', 404, 'NOT_FOUND');
  res.json({ success: true, data: it });
});

export const updateOne = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const it = await update(id, req.body || {});
  if (!it) throw new AppError('No encontrado', 404, 'NOT_FOUND');
  res.json({ success: true, data: it });
});

export const deleteOne = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const ok = await remove(id);
  if (!ok) throw new AppError('No encontrado', 404, 'NOT_FOUND');
  res.json({ success: true, message: 'Eliminado' });
});

export const count = asyncHandler(async (_req, res) => {
  const c = await countByStatus();
  res.json(c);
});

export const countPendingPublic = asyncHandler(async (_req, res) => {
  const pending = await countPending();
  res.json({ pending });
});

export const getImage = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const img = await getImageData(id);
  if (!img) throw new AppError('Imagen no encontrada', 404, 'NOT_FOUND');
  res.setHeader('Content-Type', img.mime || 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=600');
  res.send(img.data);
});