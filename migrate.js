#!/usr/bin/env node
// MaurEdge 3.0 — Database Migration Runner
// Reads migrations/001_initial_schema.sql and applies to DATABASE_URL

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });

  try {
    // Test connection
    const test = await pool.query('SELECT NOW()');
    console.log('✅ Connected to database:', test.rows[0].now);

    // Read schema
    const schemaPath = path.join(__dirname, 'migrations', '001_initial_schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('📄 Schema loaded:', schemaPath);
    console.log('📏 Size:', schema.length, 'bytes');

    // Execute schema
    console.log('🔄 Applying schema...');
    await pool.query(schema);
    console.log('✅ Schema applied successfully!');

    // Verify tables
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    console.log('\n📊 Tables created:');
    tables.rows.forEach(r => console.log('  -', r.table_name));

    // Verify views
    const views = await pool.query(`
      SELECT table_name FROM information_schema.views 
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    if (views.rows.length > 0) {
      console.log('\n👁️ Views created:');
      views.rows.forEach(r => console.log('  -', r.table_name));
    }

    // Verify indexes
    const indexes = await pool.query(`
      SELECT indexname FROM pg_indexes 
      WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
      ORDER BY indexname
    `);
    console.log('\n🔍 Indexes created:');
    indexes.rows.forEach(r => console.log('  -', r.indexname));

    // Verify config
    const config = await pool.query('SELECT key, value FROM configuration');
    console.log('\n⚙️ Config entries:');
    config.rows.forEach(r => console.log('  -', r.key, '=', r.value));

    console.log('\n🎉 Migration complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
