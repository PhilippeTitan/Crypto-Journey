/**
 * MaurEdge 2.0 — Supabase Database Client
 * 
 * Connects to Supabase for persistent storage of:
 * - Trades (buy/sell history)
 * - Portfolio snapshots (value over time)
 * - Price history (for charts)
 * - Scanner alerts (rising star findings)
 * - Settings (key-value config)
 */

const { createClient } = require('@supabase/supabase-js');

// Load from environment or .env
let SUPABASE_URL = process.env.SUPABASE_URL;
let SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

// Try loading from .env if not in environment
if (!SUPABASE_URL || !SUPABASE_KEY) {
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '..', '.env');
    const envFile = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    envFile.split('\n').forEach(line => {
      const [key, ...val] = line.split('=');
      if (key && val.length) envVars[key.trim()] = val.join('=').trim();
    });
    SUPABASE_URL = SUPABASE_URL || envVars.SUPABASE_URL;
    SUPABASE_KEY = SUPABASE_KEY || envVars.SUPABASE_ANON_KEY;
  } catch {}
}

let supabase = null;
let isConnected = false;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  isConnected = true;
  console.log('✅ Supabase connected:', SUPABASE_URL);
} else {
  console.log('⚠️  Supabase not configured — using local JSON fallback');
}

// ============================================
// TRADES
// ============================================

async function insertTrade(trade) {
  if (!isConnected) return saveTradeLocal(trade);
  const { data, error } = await supabase
    .from('trades')
    .insert({
      token: trade.token,
      token_address: trade.tokenAddress,
      action: trade.action,
      price: trade.price,
      quantity: trade.quantity,
      value: trade.value,
      pnl: trade.pnl || null,
      pnl_pct: trade.pnlPct || null,
      order_id: trade.orderId,
      status: trade.status || 'completed',
    })
    .select();
  if (error) console.error('DB insert trade error:', error);
  return data?.[0];
}

async function getTrades(limit = 50) {
  if (!isConnected) return getTradesLocal();
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) console.error('DB get trades error:', error);
  return data || [];
}

async function getTradeSummary() {
  if (!isConnected) return getTradeSummaryLocal();
  const { data, error } = await supabase
    .from('trade_summary')
    .select('*');
  if (error) console.error('DB trade summary error:', error);
  return data || [];
}

// ============================================
// PORTFOLIO SNAPSHOTS
// ============================================

async function insertSnapshot(snapshot) {
  if (!isConnected) return;
  const { error } = await supabase
    .from('portfolio_snapshots')
    .insert({
      total_value: snapshot.totalValue,
      usdt_balance: snapshot.usdt,
      bnb_balance: snapshot.bnb,
      active_token: snapshot.activeToken,
      active_token_qty: snapshot.activeTokenQty,
      active_token_value: snapshot.activeTokenValue,
    });
  if (error) console.error('DB insert snapshot error:', error);
}

async function getSnapshots(limit = 100) {
  if (!isConnected) return [];
  const { data, error } = await supabase
    .from('portfolio_snapshots')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) console.error('DB get snapshots error:', error);
  return data || [];
}

// ============================================
// PRICE HISTORY
// ============================================

async function insertPrice(price) {
  if (!isConnected) return;
  const { error } = await supabase
    .from('price_history')
    .insert({
      token: price.token,
      token_address: price.tokenAddress,
      price: price.price,
      m5_change: price.m5,
      h1_change: price.h1,
      buys_5m: price.buys5m,
      sells_5m: price.sells5m,
      volume_5m: price.vol5m,
      liquidity: price.liq,
      fdv: price.fdv,
    });
  if (error) console.error('DB insert price error:', error);
}

async function getPriceHistory(token, limit = 300) {
  if (!isConnected) return [];
  const { data, error } = await supabase
    .from('price_history')
    .select('*')
    .eq('token', token)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) console.error('DB get price history error:', error);
  return (data || []).reverse();
}

// ============================================
// SCANNER ALERTS
// ============================================

async function insertAlert(alert) {
  if (!isConnected) return;
  const { error } = await supabase
    .from('scanner_alerts')
    .insert({
      token: alert.token,
      token_address: alert.tokenAddress,
      score: alert.score,
      signals: alert.signals,
      price: alert.price,
      buy_pressure: alert.buyPressure,
      volume_5m: alert.vol5m,
      liquidity: alert.liq,
      fdv: alert.fdv,
      tradeable: alert.tradeable,
    });
  if (error) console.error('DB insert alert error:', error);
}

async function getAlerts(limit = 20) {
  if (!isConnected) return [];
  const { data, error } = await supabase
    .from('scanner_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) console.error('DB get alerts error:', error);
  return data || [];
}

// ============================================
// SETTINGS
// ============================================

async function getSetting(key) {
  if (!isConnected) return null;
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .single();
  if (error) return null;
  return data?.value;
}

async function setSetting(key, value) {
  if (!isConnected) return;
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) console.error('DB set setting error:', error);
}

// ============================================
// LOCAL JSON FALLBACK
// ============================================
const fs = require('fs');
const path = require('path');
const TRADE_LOG = path.join(__dirname, '..', 'trade_log.json');

function saveTradeLocal(trade) {
  const trades = getTradesLocal();
  trades.push({
    id: Date.now(),
    token: trade.token,
    action: trade.action,
    price: trade.price,
    qty: trade.quantity,
    value: trade.value,
    pnl: trade.pnl,
    pnlPct: trade.pnlPct,
    time: new Date().toLocaleTimeString(),
    orderId: trade.orderId,
  });
  fs.writeFileSync(TRADE_LOG, JSON.stringify(trades, null, 2));
  return trade;
}

function getTradesLocal() {
  try { return JSON.parse(fs.readFileSync(TRADE_LOG, 'utf8')); }
  catch { return []; }
}

function getTradeSummaryLocal() {
  const trades = getTradesLocal();
  const summary = {};
  trades.forEach(t => {
    if (!summary[t.token]) summary[t.token] = { token: t.token, buys: 0, sells: 0, total_pnl: 0 };
    if (t.action === 'BUY') summary[t.token].buys++;
    else { summary[t.token].sells++; summary[t.token].total_pnl += t.pnl || 0; }
  });
  return Object.values(summary);
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  isConnected,
  // Trades
  insertTrade,
  getTrades,
  getTradeSummary,
  // Snapshots
  insertSnapshot,
  getSnapshots,
  // Prices
  insertPrice,
  getPriceHistory,
  // Alerts
  insertAlert,
  getAlerts,
  // Settings
  getSetting,
  setSetting,
};
