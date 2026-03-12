/**
 * check-sbtc-and-pool.mjs
 * Checks deployer sBTC balance and sBTC-BDC pool state.
 */
import tx from '@stacks/transactions';
const { principalCV, cvToHex, hexToCV, cvToString } = tx;

const API = 'https://api.hiro.so';
const DEPLOYER = 'SP12EBY3HBKZ2WAKKSZJNVEJCN0BNXSTPJZWYCCNX';

async function readOnly(addr, contract, fn, args = []) {
  const r = await fetch(`${API}/v2/contracts/call-read/${addr}/${contract}/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sender: DEPLOYER, arguments: args.map(cvToHex) }),
  });
  const j = await r.json();
  return j.result ? cvToString(hexToCV(j.result)) : `ERROR: ${JSON.stringify(j)}`;
}

// sBTC balance
const sbtcBal = await readOnly(
  'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4', 'sbtc-token',
  'get-balance', [principalCV(DEPLOYER)]
);
console.log('deployer sBTC balance :', sbtcBal);

// sBTC-BDC pool reserves
const bdcPool = await readOnly(
  'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR', 'xyk-pool-sbtc-bdc-v-1-1',
  'get-pool-data'
);
console.log('\nsBTC-BDC pool data    :', bdcPool);

// sBTC-STX pool reserves (recommended alternative)
const stxPool = await readOnly(
  'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR', 'xyk-pool-sbtc-stx-v-1-1',
  'get-pool-data'
);
console.log('\nsBTC-STX pool data    :', stxPool);
