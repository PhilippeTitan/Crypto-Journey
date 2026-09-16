/**
 * MaurEdge 3.0 — Worker Entry Point
 * Runs the autonomous loop on Render.
 */

require('dotenv').config();

const { startLoop } = require('../core/autonomy/loop');
const db = require('../core/lib/db');

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  MaurEdge 3.0 — Autonomous Trading Engine');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log(`  AI Provider: ${process.env.AI_PROVIDER || 'openai'}`);
  console.log(`  Scan Interval: ${process.env.SCAN_INTERVAL_MS || 30000}ms`);
  console.log(`  Database: ${process.env.DATABASE_URL ? 'Connected' : 'NOT CONFIGURED'}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Verify database connectivity
  try {
    await db.query('SELECT NOW()');
    console.log('✅ Database connected\n');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    console.log('⚠️  Continuing without database persistence\n');
  }

  // Start the autonomous loop
  await startLoop();
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
