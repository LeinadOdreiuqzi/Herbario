import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { adminAuth, requireAdminForNonPublicList } from '../middlewares/auth.js';
import { validateSubmission, validateUpdate, validateListQuery } from '../middlewares/validators.js';
import { submit, list, acceptOne, rejectOne, updateOne, deleteOne, count, getImage, countPendingPublic } from '../controllers/plants.controller.js'

const router = Router();

// Configuración de multer en memoria (posterior mover a disco/S3)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Rate limits específicos
const submissionLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30, standardHeaders: 'draft-7', legacyHeaders: false });
const adminActionLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 100, standardHeaders: 'draft-7', legacyHeaders: false });

// Público: recepción de formularios (con imagen opcional 'imagen')
router.post('/submissions', submissionLimiter, upload.single('imagen'), validateSubmission, submit);

// Listado por estado + filtros + paginación (público para accepted, admin para otros)
router.get('/', validateListQuery, requireAdminForNonPublicList, list);

// Conteo por estado (útil para badge en admin)
router.get('/count', adminActionLimiter, adminAuth, count);
// Público: solo cantidad de pendientes
router.get('/count/pending', countPendingPublic);

// Imagen binaria por id (si existe)
router.get('/:id/imagen', getImage);

// Admin: flujo de aprobación y administración
router.put('/:id/accept', adminActionLimiter, adminAuth, acceptOne);
router.put('/:id/reject', adminActionLimiter, adminAuth, rejectOne);
router.put('/:id', adminActionLimiter, adminAuth, validateUpdate, updateOne);
router.delete('/:id', adminActionLimiter, adminAuth, deleteOne);

export default router;