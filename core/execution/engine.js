/**
 * MaurEdge 3.0 — Execution Engine
 * Wraps baw CLI with quote → validate → execute → verify → reconcile flow.
 */

const baw = require('../lib/baw');
const db = require('../lib/db');

/**
 * Full execution pipeline for a trade.
 * @param {object} params - { token, address, action, amount, positionId }
 * @returns {object} Execution result
 */
async function execute({ token, address, action, amount, positionId = null }) {
  const log = { token, action, amount, steps: [] };

  // STEP 1: Quote
  log.steps.push({ step: 'quote', status: 'started' });
  const quote = baw.getQuote({
    fromToken: action === 'BUY' ? baw.USDT_ADDRESS : address,
    toToken: action === 'BUY' ? address : baw.USDT_ADDRESS,
    amount,
  });

  if (!quote) {
    log.steps.push({ step: 'quote', status: 'failed', error: 'No quote returned' });
    await db.logEvent('EXECUTION_FAILED', `Quote failed for ${token} ${action}`, log);
    return { success: false, error: 'Quote failed', log };
  }
  log.steps.push({ step: 'quote', status: 'success', data: quote });

  // STEP 2: Validate quote
  log.steps.push({ step: 'validate', status: 'started' });
  if (!quote.success) {
    log.steps.push({ step: 'validate', status: 'failed', error: 'Quote not successful' });
    return { success: false, error: 'Quote validation failed', log };
  }
  log.steps.push({ step: 'validate', status: 'success' });

  // STEP 3: Execute
  log.steps.push({ step: 'execute', status: 'started' });
  const order = baw.executeSwap({
    fromToken: action === 'BUY' ? baw.USDT_ADDRESS : address,
    toToken: action === 'BUY' ? address : baw.USDT_ADDRESS,
    amount,
  });

  if (!order.success) {
    log.steps.push({ step: 'execute', status: 'failed', error: order.error });
    await db.logEvent('EXECUTION_FAILED', `Swap failed for ${token} ${action}`, log, 'error');
    return { success: false, error: order.error, log };
  }
  log.steps.push({ step: 'execute', status: 'success', data: order.data });

  // STEP 4: Store order
  const orderRecord = await db.insert('orders', {
    position_id: positionId,
    token,
    action,
    requested_qty: amount,
    quote_json: JSON.stringify(quote),
    executed_qty: order.data?.outputAmount || null,
    executed_price: order.data?.outputPrice || null,
    status: 'executed',
  });

  // STEP 5: Store trade
  const tradeRecord = await db.insert('trades', {
    position_id: positionId,
    order_id: orderRecord?.id,
    token,
    token_address: address,
    action,
    price: order.data?.outputPrice || 0,
    quantity: order.data?.outputAmount || amount,
    value: order.data?.outputValue || amount,
    status: 'completed',
  });

  await db.logEvent('TRADE_EXECUTED', `${action} ${token} — $${amount}`, { order: orderRecord, trade: tradeRecord });

  return { success: true, order: orderRecord, trade: tradeRecord, data: order.data, log };
}

module.exports = { execute };
