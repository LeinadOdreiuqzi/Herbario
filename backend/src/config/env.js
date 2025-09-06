import dotenv from 'dotenv';

dotenv.config();

// Validar solo variables críticas realmente requeridas en esta fase sin DB
const requiredEnvVars = {
  JWT_SECRET: process.env.JWT_SECRET
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('❌ Variables de entorno faltantes:', missingVars.join(', '));
  console.error('Por favor, configura estas variables en tu archivo .env');
  process.exit(1);
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  database: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    name: process.env.DB_NAME || 'herbario',
    user: process.env.DB_USER || 'herbario_app',
    password: process.env.DB_PASSWORD || '7^*aYLlvfckJ<3>dF4Ot',
    ssl: process.env.DB_SSL === 'true'
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  frontend: {
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
    allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [
      process.env.FRONTEND_ORIGIN || 'http://localhost:3000'
    ]
  },
  adminToken: process.env.ADMIN_TOKEN,
  logLevel: process.env.LOG_LEVEL || 'info',
  upload: {
    maxSize: process.env.UPLOAD_MAX_SIZE || '5mb',
    directory: process.env.UPLOAD_DIR || 'uploads'
  }
};

if (config.env === 'development') {
  console.log('🔧 Configuración cargada:');
  console.log(`   - Entorno: ${config.env}`);
  console.log(`   - Puerto: ${config.port}`);
  if (config.database.name && config.database.user) {
    console.log(`   - Base de datos: ${config.database.host}:${config.database.port}/${config.database.name}`);
  } else {
    console.log('   - Base de datos: (no configurada, usando memoria)');
  }
  console.log(`   - Frontend: ${config.frontend.origin}`);
  console.log(`   - JWT expira en: ${config.jwt.expiresIn}`);
}