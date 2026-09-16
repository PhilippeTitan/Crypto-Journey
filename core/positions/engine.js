/**
 * MaurEdge 3.0 — Position Engine
 * One generic engine for all positions.
 * Replaces individual afob_monitor, doge_monitor, etc.
 */

const db = require('../lib/db');
const dexscreener = require('../lib/dexscreener');
const baw = require('../lib/baw');
const { execute } = require('../execution/engine');

/**
 * Open a new position.
 */
async function openPosition({ token, address, entryPrice, entryValue, quantity, tpPct, slPct, trailingPct }) {
  return db.insert('positions', {
    token,
    address,
    entry_price: entryPrice,
    entry_value: entryValue,
    quantity,
    current_price: entryPrice,
    current_value: entryValue,
    high_water_mark: entryPrice,
    take_profit_pct: tpPct || 10,
    stop_loss_pct: slPct || 5,
    trailing_stop_pct: trailingPct || 3,
    status: 'open',
  });
}

/**
 * Close a position.
 */
async function closePosition(positionId, exitPrice, exitValue, realizedPnl) {
  return db.update('positions', {
    current_price: exitPrice,
    current_value: exitValue,
    realized_pnl: realizedPnl,
    status: 'closed',
    closed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, 'id', positionId);
}

/**
 * Monitor all open positions.
 * Returns array of actions to take.
 */
async function monitorPositions() {
  const positions = await db.getOpenPositions();
  const actions = [];

  for (const pos of positions) {
    const snapshot = await dexscreener.getNormalizedToken(pos.address);
    if (!snapshot) continue;

    const currentPrice = snapshot.price;
    const currentValue = (parseFloat(pos.quantity) * currentPrice);
    const unrealizedPnl = currentValue - parseFloat(pos.entry_value);
    const unrealizedPnlPct = ((currentValue - parseFloat(pos.entry_value)) / parseFloat(pos.entry_value)) * 100;

    // Update high-water mark
    let hwm = parseFloat(pos.high_water_mark || pos.entry_price);
    if (currentPrice > hwm) hwm = currentPrice;

    // Check TP
    const tpPrice = parseFloat(pos.entry_price) * (1 + parseFloat(pos.take_profit_pct) / 100);
    if (currentPrice >= tpPrice) {
      actions.push({ action: 'SELL', position: pos, reason: `TP hit: ${currentPrice} >= ${tpPrice}`, type: 'take_profit' });
      continue;
    }

    // Check SL
    const slPrice = parseFloat(pos.entry_price) * (1 - parseFloat(pos.stop_loss_pct) / 100);
    if (currentPrice <= slPrice) {
      actions.push({ action: 'SELL', position: pos, reason: `SL hit: ${currentPrice} <= ${slPrice}`, type: 'stop_loss' });
      continue;
    }

    // Check trailing stop
    const trailingTrigger = hwm * (1 - parseFloat(pos.trailing_stop_pct) / 100);
    if (!pos.trailing_active && unrealizedPnlPct >= parseFloat(pos.trailing_stop_pct)) {
      // Activate trailing stop
      await db.update('positions', { trailing_active: true, high_water_mark: hwm }, 'id', pos.id);
    } else if (pos.trailing_active && currentPrice <= trailingTrigger) {
      actions.push({ action: 'SELL', position: pos, reason: `Trailing stop: ${currentPrice} <= ${trailingTrigger}`, type: 'trailing_stop' });
      continue;
    }

    // Update position
    await db.update('positions', {
      current_price: currentPrice,
      current_value: currentValue,
      unrealized_pnl: unrealizedPnl,
      high_water_mark: hwm,
      updated_at: new Date().toISOString(),
    }, 'id', pos.id);
  }

  return actions;
}

/**
 * Execute a sell for a position.
 */
async function closePositionBySell(position, reason) {
  const result = await execute({
    token: position.token,
    address: position.address,
    action: 'SELL',
    amount: position.quantity,
    positionId: position.id,
  });

  if (result.success) {
    const exitPrice = result.data?.outputPrice || 0;
    const exitValue = result.data?.outputValue || parseFloat(position.current_value);
    const pnl = exitValue - parseFloat(position.entry_value);
    await closePosition(position.id, exitPrice, exitValue, pnl);
    await db.logEvent('POSITION_CLOSED', `${position.token} closed: ${reason}`, { position, pnl });
  }

  return result;
}

module.exports = { openPosition, closePosition, monitorPositions, closePositionBySell };
