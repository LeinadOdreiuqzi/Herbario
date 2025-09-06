// Repositorio de usuarios usando PostgreSQL y verificación con pgcrypto (bcrypt)
import { query } from '../config/database.js';

function mapUser(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    email: String(row.email),
    is_admin: Boolean(row.is_admin)
  };
}

// Verifica credenciales contra la base de datos usando crypt() de pgcrypto
// SELECT con "password_hash = crypt($2, password_hash)" permite validar bcrypt sin exponer el hash
export async function verifyUserPassword(email, plainPassword) {
  const e = String(email || '').trim();
  const p = String(plainPassword || '');
  if (!e || !p) return null;

  const sql = `
    SELECT id, email::text AS email, is_admin
    FROM users
    WHERE email = $1
      AND password_hash = crypt($2, password_hash)
    LIMIT 1
  `;
  const { rows } = await query(sql, [e, p]);
  return rows.length ? mapUser(rows[0]) : null;
}

export async function isUserAdmin(userId) {
  const sql = `SELECT is_admin FROM users WHERE id = $1`;
  const { rows } = await query(sql, [userId]);
  return rows.length ? Boolean(rows[0].is_admin) : false;
}

export async function updateLastLogin(userId) {
  await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [userId]);
  return true;
}

export async function getUserById(userId) {
  const sql = `SELECT id, email::text AS email, is_admin FROM users WHERE id = $1`;
  const { rows } = await query(sql, [userId]);
  return rows.length ? mapUser(rows[0]) : null;
}