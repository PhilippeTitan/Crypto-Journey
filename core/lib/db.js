/**
 * MaurEdge 3.0 — Neon Database Client
 * Authoritative persistent state layer.
 * Uses pg (node-postgres) for direct Neon/PostgreSQL connection.
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;

function getPool() {
  if (!pool && DATABASE_URL) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    });
    pool.on('error', (err) => {
      console.error('❌ Neon pool error:', err.message);
    });
  }
  return pool;
}

async function query(text, params = []) {
  const p = getPool();
  if (!p) {
    console.warn('⚠️  No DATABASE_URL — query skipped');
    return { rows: [], rowCount: 0 };
  }
  const start = Date.now();
  const result = await p.query(text, params);
  const ms = Date.now() - start;
  if (ms > 1000) console.log(`⚠️  Slow query (${ms}ms):`, text.slice(0, 80));
  return result;
}

async function insert(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`);
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`;
  const result = await query(sql, values);
  return result.rows[0];
}

async function update(table, data, whereCol, whereVal) {
  const keys = Object.keys(data).filter((k) => k !== whereCol);
  const values = keys.map((k) => data[k]);
  const sets = keys.map((k, i) => `${k} = $${i + 1}`);
  values.push(whereVal);
  const sql = `UPDATE ${table} SET ${sets.join(', ')} WHERE ${whereCol} = $${values.length} RETURNING *`;
  const result = await query(sql, values);
  return result.rows[0];
}

async function select(table, where = {}, orderBy = null, limit = null) {
  let sql = `SELECT * FROM ${table}`;
  const conditions = [];
  const values = [];
  let idx = 1;
  for (const [k, v] of Object.entries(where)) {
    conditions.push(`${k} = $${idx}`);
    values.push(v);
    idx++;
  }
  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
  if (orderBy) sql += ` ORDER BY ${orderBy}`;
  if (limit) sql += ` LIMIT ${limit}`;
  const result = await query(sql, values);
  return result.rows;
}

async function selectOne(table, where = {}) {
  const rows = await select(table, where, null, 1);
  return rows[0] || null;
}

// ============================================
// HIGH-LEVEL OPERATIONS
// ============================================

async function getActiveMission() {
  const rows = await select('missions', { status: 'active' }, 'created_at DESC', 1);
  return rows[0] || null;
}

async function getOpenPositions() {
  return select('positions', { status: 'open' });
}

async function getAutonomyState() {
  const rows = await select('autonomy_state', {}, 'updated_at DESC', 1);
  return rows[0] || null;
}

async function updateAutonomyState(data) {
  const current = await getAutonomyState();
  if (current) {
    return update('autonomy_state', { ...data, updated_at: new Date().toISOString() }, 'id', current.id);
  }
  return insert('autonomy_state', data);
}

async function logEvent(eventType, message, data = null, severity = 'info', cycleId = null) {
  return insert('system_events', {
    event_type: eventType,
    severity,
    message,
    data_json: data ? JSON.stringify(data) : null,
    cycle_id: cycleId,
  });
}

async function logError(component, errorType, message, stackTrace = null) {
  return insert('system_errors', {
    component,
    error_type: errorType,
    message,
    stack_trace: stackTrace,
  });
}

async function getConfig(key) {
  const row = await selectOne('configuration', { key });
  return row?.value || null;
}

async function setConfig(key, value, category = 'general', description = null) {
  return insert('configuration', { key, value, category, description }).catch(() =>
    update('configuration', { value, updated_at: new Date().toISOString() }, 'key', key)
  );
}

module.exports = {
  query,
  insert,
  update,
  select,
  selectOne,
  getActiveMission,
  getOpenPositions,
  getAutonomyState,
  updateAutonomyState,
  logEvent,
  logError,
  getConfig,
  setConfig,
  getPool,
};
