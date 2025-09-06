// Repositorio de plantas usando PostgreSQL
import { query } from '../config/database.js';

function nowISO(d) { return (d instanceof Date ? d : new Date(d)).toISOString(); }

function sanitizeNumber(n) {
  if (n === null || n === undefined || n === '') return null;
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name ?? null,
    family: row.family ?? null,
    scientific_name: row.scientific_name ?? null,
    description: row.description ?? null,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    status: row.status,
    created_at: row.created_at ? nowISO(row.created_at) : null,
    updated_at: row.updated_at ? nowISO(row.updated_at) : null
  };
}

export async function createSubmission(data, file) {
  const name = data?.name || data?.scientific_name || '—';
  const scientific_name = data?.scientific_name || null;
  const family = data?.family || null;
  const description = data?.description || null;
  const latitude = sanitizeNumber(data?.latitude);
  const longitude = sanitizeNumber(data?.longitude);
  const imageMime = file?.mimetype || null;
  const imageData = file?.buffer || null;

  const createSql = `SELECT fn_create_submission($1,$2,$3,$4,$5,$6,$7,$8,$9) AS id`;
  const params = [
    name,
    scientific_name,
    family,
    description,
    latitude,
    longitude,
    null, // submitted_by (usuario anónimo por ahora)
    imageMime,
    imageData
  ];
  const { rows } = await query(createSql, params);
  const id = rows[0]?.id;
  const fetched = await getById(id);
  return fetched;
}

export async function listPlants(optionsOrStatus) {
  let status = null, q = null, family = null, page = 1, pageSize = 20;
  if (typeof optionsOrStatus === 'string') {
    status = optionsOrStatus || null;
  } else if (optionsOrStatus && typeof optionsOrStatus === 'object') {
    status = optionsOrStatus.status || null;
    q = optionsOrStatus.q || null;
    family = optionsOrStatus.family || null;
    page = Math.max(1, Number(optionsOrStatus.page) || 1);
    pageSize = Math.min(100, Math.max(1, Number(optionsOrStatus.pageSize) || 20));
  }
  const limit = pageSize;
  const offset = (page - 1) * pageSize;
  const sql = `SELECT * FROM fn_list_plants($1,$2,$3,$4,$5)`;
  const { rows } = await query(sql, [status, q, family, limit, offset]);
  return rows.map(mapRow);
}

export async function countPlants(filters = {}) {
  const status = filters.status || null;
  const q = filters.q || null;
  const family = filters.family || null;
  const sql = `SELECT fn_count_plants($1,$2,$3) AS total`;
  const { rows } = await query(sql, [status, q, family]);
  return Number(rows[0]?.total || 0);
}

export async function countByStatus() {
  const sql = `SELECT status, COUNT(*)::bigint AS c FROM plants GROUP BY status`;
  const { rows } = await query(sql);
  let pending = 0, accepted = 0, rejected = 0;
  for (const r of rows) {
    if (r.status === 'pending') pending = Number(r.c);
    else if (r.status === 'accepted') accepted = Number(r.c);
    else if (r.status === 'rejected') rejected = Number(r.c);
  }
  return { pending, accepted, rejected };
}

export async function countPending() {
  const { rows } = await query(`SELECT fn_count_pending() AS total`);
  return Number(rows[0]?.total || 0);
}

export async function getById(id) {
  const { rows } = await query(
    `SELECT id,name,scientific_name,family,description,latitude,longitude,status,created_at,updated_at FROM plants WHERE id = $1`,
    [id]
  );
  return mapRow(rows[0] || null);
}

export async function accept(id, adminId) {
  const params = [id];
  let setActor = '';
  if (isUuid(adminId)) { params.unshift(adminId); setActor = 'accepted_by = $1,'; }
  const sql = `UPDATE plants SET ${setActor} status = 'accepted'::plant_status_enum WHERE id = $${params.length} RETURNING id,name,scientific_name,family,description,latitude,longitude,status,created_at,updated_at`;
  const { rows } = await query(sql, params);
  return rows.length ? mapRow(rows[0]) : null;
}

export async function reject(id, adminId) {
  const params = [id];
  let setActor = '';
  if (isUuid(adminId)) { params.unshift(adminId); setActor = 'rejected_by = $1,'; }
  const sql = `UPDATE plants SET ${setActor} status = 'rejected'::plant_status_enum WHERE id = $${params.length} RETURNING id,name,scientific_name,family,description,latitude,longitude,status,created_at,updated_at`;
  const { rows } = await query(sql, params);
  return rows.length ? mapRow(rows[0]) : null;
}

export async function update(id, changes) {
  const set = [];
  const params = [];
  const add = (frag, val) => { params.push(val); set.push(`${frag} = $${params.length}`); };

  if (changes.name != null) add('name', String(changes.name));
  if (changes.family != null) add('family', String(changes.family));
  if (changes.scientific_name != null) add('scientific_name', String(changes.scientific_name));
  if (changes.description != null) add('description', String(changes.description));
  if (changes.latitude != null) add('latitude', sanitizeNumber(changes.latitude));
  if (changes.longitude != null) add('longitude', sanitizeNumber(changes.longitude));
  if (changes.status && ['pending','accepted','rejected'].includes(String(changes.status))) add('status', String(changes.status));

  if (set.length === 0) {
    return await getById(id);
  }
  params.push(id);

  const sql = `UPDATE plants SET ${set.join(', ')} WHERE id = $${params.length} RETURNING id,name,scientific_name,family,description,latitude,longitude,status,created_at,updated_at`;
  const { rows } = await query(sql, params);
  return rows.length ? mapRow(rows[0]) : null;
}

export async function remove(id) {
  const { rowCount } = await query(`DELETE FROM plants WHERE id = $1`, [id]);
  return rowCount > 0;
}

export async function getImageData(id) {
  const { rows } = await query(`SELECT mime_type AS mime, data FROM plant_images WHERE plant_id = $1`, [id]);
  if (!rows.length) return null;
  const r = rows[0];
  return { mime: r.mime, data: r.data };
}