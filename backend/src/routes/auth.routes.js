import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, verifyToken, logout } from '../controllers/auth.controller.js';
import { validateLogin } from '../middlewares/validators.js';

const router = Router();

// Limitar intentos de login
const loginLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, standardHeaders: 'draft-7', legacyHeaders: false });

router.post('/login', loginLimiter, validateLogin, login);
router.get('/verify', verifyToken);
router.post('/logout', logout);

export default router;