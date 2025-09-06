import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function buildAdminDbConfig() {
  const cfg = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    database: process.env.DB_NAME || 'herbario',
    user: process.env.DB_ADMIN_USER || process.env.DB_USER || 'postgres',
    password: String((process.env.DB_ADMIN_PASSWORD ?? process.env.DB_PASSWORD) ?? ''),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 1,
    connectionTimeoutMillis: 4000,
  };
  return cfg;
}

async function run() {
  const dbConfig = buildAdminDbConfig();
  const pool = new Pool(dbConfig);
  const client = await pool.connect();

  const schemaPath = path.resolve(__dirname, '..', 'db', 'schema.sql');
  const authPath = path.resolve(__dirname, '..', 'db', 'auth_setup_and_create_admin.sql');

  try {
    console.log('[setup-db] Conectando como:', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
    });

    const schemaSql = await fs.readFile(schemaPath, 'utf8');
    const authSql = await fs.readFile(authPath, 'utf8');

    console.log('[setup-db] Ejecutando schema.sql:', schemaPath);
    await client.query(schemaSql);

    console.log('[setup-db] Ejecutando auth_setup_and_create_admin.sql:', authPath);
    await client.query(authSql);

    console.log('[setup-db] Base de datos preparada correctamente.');
  } catch (err) {
    console.error('[setup-db] Error al preparar la base de datos:', err?.message || err);
    console.error('[setup-db] Sugerencias:');
    console.error('- Asegúrate de ejecutar este script con credenciales con permisos suficientes.');
    console.error('- Puedes definir DB_ADMIN_USER y DB_ADMIN_PASSWORD en tu .env (por ejemplo, el superusuario postgres).');
    console.error('- Ejemplo en .env: DB_ADMIN_USER=postgres, DB_ADMIN_PASSWORD=<tu_password>');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();