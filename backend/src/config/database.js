import pkg from 'pg';
const { Pool } = pkg;
import { config } from './env.js';

// Configuración de la base de datos PostgreSQL usando config centralizada
const dbConfig = {
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: String(config.database.password ?? ''),
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
  // Configuración optimizada para VPS limitado
  max: 10, // Máximo 10 conexiones para VPS limitado
  idleTimeoutMillis: 30000, // tiempo de espera antes de cerrar conexiones inactivas
  connectionTimeoutMillis: 2000, // tiempo de espera para establecer conexión
  statement_timeout: 10000, // 10 segundos timeout para queries
  query_timeout: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

// Crear pool de conexiones
export const db = new Pool(dbConfig);

// Función para probar la conexión
export async function testConnection() {
  try {
    const client = await db.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.info('[PostgreSQL] Conexión exitosa:', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      timestamp: result.rows[0].now
    });
    return true;
  } catch (error) {
    console.error('[PostgreSQL] Error de conexión:', error.message);
    throw error;
  }
}

// Función para ejecutar queries con manejo de errores
export async function query(text, params = []) {
  const client = await db.connect();
  try {
    const start = Date.now();
    const result = await client.query(text, params);
    const duration = Date.now() - start;
    console.debug('[PostgreSQL] Query ejecutado:', {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
      rows: result.rowCount
    });
    return result;
  } catch (error) {
    console.error('[PostgreSQL] Error en query:', {
      error: error.message,
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      params
    });
    throw error;
  } finally {
    client.release();
  }
}

// Función para transacciones
export async function transaction(callback) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Inicializar conexión al importar el módulo
testConnection().catch(error => {
  console.error('[PostgreSQL] Fallo en inicialización:', error.message);
});

console.info('[PostgreSQL] Pool de conexiones configurado:', {
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  user: dbConfig.user,
  maxConnections: dbConfig.max
});