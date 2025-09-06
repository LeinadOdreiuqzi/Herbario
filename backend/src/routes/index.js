import { Router } from 'express';
import plantsRoutes from './plants.routes.js';
import authRoutes from './auth.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'Herbario API' });
});

router.get('/', (_req, res) => {
  res.json({ ok: true, name: 'Herbario API', version: '0.1.0' });
});

router.use('/auth', authRoutes);
router.use('/plants', plantsRoutes);

export default router;