/**
 * MaurEdge 3.0 — BAW (Binance Agentic Wallet) Execution Client
 * All baw CLI interactions in one place.
 * Replaces 8 duplicated checkTradeability implementations.
 */

const { execSync } = require('child_process');

const BSC_CHAIN_ID = 56;
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';
const BAW_TIMEOUT = 15000;

/**
 * Execute a baw command and return parsed JSON.
 */
function bawExec(args, timeout = BAW_TIMEOUT) {
  try {
    const cmd = `baw ${args} --json`;
    const raw = execSync(cmd, { encoding: 'utf8', timeout });
    return { success: true, data: JSON.parse(raw) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Check if a token is tradeable via baw.
 * @param {string} tokenAddress - BSC token address
 * @returns {boolean}
 */
function checkTradeability(tokenAddress) {
  const result = bawExec(
    `market-order quote --fromTokenQty 1 --fromToken ${USDT_ADDRESS} --toToken ${tokenAddress} --binanceChainId ${BSC_CHAIN_ID}`
  );
  return result.success && result.data?.success === true;
}

/**
 * Get a quote for swapping tokens.
 * @returns {object} Quote data or null
 */
function getQuote({ fromToken = USDT_ADDRESS, toToken, amount = 1 }) {
  const result = bawExec(
    `market-order quote --fromTokenQty ${amount} --fromToken ${fromToken} --toToken ${toToken} --binanceChainId ${BSC_CHAIN_ID}`
  );
  if (result.success && result.data?.success) {
    return result.data;
  }
  return null;
}

/**
 * Execute a market order swap.
 * @returns {object} Execution result
 */
function executeSwap({ fromToken = USDT_ADDRESS, toToken, amount }) {
  const result = bawExec(
    `market-order swap --fromTokenQty ${amount} --fromToken ${fromToken} --toToken ${toToken} --binanceChainId ${BSC_CHAIN_ID}`
  );
  return result;
}

/**
 * Get wallet balances.
 */
function getWalletBalance() {
  const result = bawExec('wallet balance');
  if (result.success) {
    return result.data;
  }
  return null;
}

module.exports = {
  bawExec,
  checkTradeability,
  getQuote,
  executeSwap,
  getWalletBalance,
  USDT_ADDRESS,
  BSC_CHAIN_ID,
};
