import jwt from 'jsonwebtoken';
import { verifyUserPassword, updateLastLogin, isUserAdmin } from '../repositories/users.repository.js';
import { AppError, asyncHandler } from '../utils/errorHandler.js';

const JWT_SECRET = (process.env.JWT_SECRET || '').trim();
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Controlador de login con PostgreSQL
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const login = asyncHandler(async (req, res) => {
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');

    // Validación de entrada
    if (!email || !password) {
      throw new AppError('Email y contraseña son requeridos', 400, 'MISSING_CREDENTIALS');
    }

    // Verificar credenciales usando el repositorio
    const user = await verifyUserPassword(email, password);
    if (!user) {
      throw new AppError('Credenciales inválidas', 401, 'INVALID_CREDENTIALS');
    }

    // Verificar si es administrador
    const isAdmin = await isUserAdmin(user.id);
    const role = isAdmin ? 'admin' : 'user';

    // Actualizar último login
    await updateLastLogin(user.id);

    // Crear token JWT
    const payload = { 
      sub: user.id, 
      role: role, 
      email: user.email,
      iat: Math.floor(Date.now() / 1000)
    };
    
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    
    // Respuesta exitosa
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
        role: role
      }
    });
});

/**
 * Verificar token JWT
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const verifyToken = asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Token no proporcionado', 401, 'MISSING_TOKEN');
    }
    
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Verificar que el usuario aún existe
      const { getUserById } = await import('../repositories/users.repository.js');
      const user = await getUserById(decoded.sub);
      
      if (!user) {
        throw new AppError('Token inválido', 401, 'INVALID_TOKEN');
      }
      
      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name || user.email.split('@')[0],
          role: decoded.role
        }
      });
      
    } catch (jwtError) {
      throw new AppError('Token inválido o expirado', 401, 'INVALID_OR_EXPIRED_TOKEN');
    }
    
  });

/**
 * Logout (invalidar token del lado del cliente)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const logout = asyncHandler(async (req, res) => {
    // En una implementación JWT stateless, el logout se maneja del lado del cliente
    // eliminando el token. Aquí solo confirmamos la operación.
    res.json({
      success: true,
      message: 'Logout exitoso'
    });
});