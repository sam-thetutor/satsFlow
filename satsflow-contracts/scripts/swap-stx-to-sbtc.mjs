/**
 * swap-stx-to-sbtc.mjs
 * Swaps 3 STX → sBTC via Bitflow xyk-pool-sbtc-stx-v-1-1
 * using swap-y-for-x (y = token-stx-v-1-2 wrapper, x = sbtc-token)
 *
 * Usage: node scripts/swap-stx-to-sbtc.mjs
 */

import tx from '@stacks/transactions';
import { generateWallet } from '@stacks/wallet-sdk';
import { readFileSync } from 'fs';

const {
  makeContractCall,
  uintCV,
  contractPrincipalCV,
  cvToHex,
  hexToCV,
  cvToString,
  AnchorMode,
  PostConditionMode,
  fetchNonce,
} = tx;

// ── Addresses ────────────────────────────────────────────────────────────────
const DEPLOYER    = 'SP12EBY3HBKZ2WAKKSZJNVEJCN0BNXSTPJZWYCCNX';
const XYK_CORE    = { addr: 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR', name: 'xyk-core-v-1-2' };
const POOL_SBTC_STX = { addr: 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR', name: 'xyk-pool-sbtc-stx-v-1-1' };
const SBTC_TOKEN  = { addr: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4', name: 'sbtc-token' };
const STX_WRAPPER = { addr: 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR', name: 'token-stx-v-1-2' };
const API         = 'https://api.hiro.so';

// Swap 3 STX. At ~274k STX/sBTC the expected output is ~1,086 sats.
// min-dx = 800 sats (~26% slippage buffer, safe for mainnet's tight pool).
const STX_IN  = 3_000_000n;  // uSTX
const MIN_OUT = 800n;         // satoshis sBTC

// ── Wallet ─────────────────────────────────────────────────────────────────
const toml     = readFileSync('settings/Mainnet.toml', 'utf8');
const mnemonic = toml.match(/mnemonic\s*=\s*"([^"]+)"/)?.[1];
if (!mnemonic) throw new Error('mnemonic not found in settings/Mainnet.toml');

const wallet    = await generateWallet({ secretKey: mnemonic, password: 'mainnet-smoke' });
const senderKey = wallet.accounts[0].stxPrivateKey;

// ── Helpers ───────────────────────────────────────────────────────────────
async function readOnly(addr, contract, fn, args = []) {
  const r = await fetch(`${API}/v2/contracts/call-read/${addr}/${contract}/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sender: DEPLOYER, arguments: args.map(cvToHex) }),
  });
  const j = await r.json();
  return j.result ? cvToString(hexToCV(j.result)) : `ERROR: ${JSON.stringify(j)}`;
}

async function broadcast(t) {
  const txHex  = t.serialize();
  const txBytes = Buffer.from(txHex, 'hex');
  const r = await fetch(`${API}/v2/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: txBytes,
  });
  const text = await r.text();
  console.log('  HTTP status :', r.status);
  console.log('  raw response:', text.slice(0, 300));
  let result;
  try { result = JSON.parse(text); } catch {
    throw new Error(`non-JSON (HTTP ${r.status}): ${text.slice(0, 200)}`);
  }
  if (result.error) throw new Error(`broadcast failed: ${result.reason ?? result.error}`);
  return result.txid ?? result;
}

async function waitForTx(txid, maxMs = 180_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const r = await fetch(`${API}/extended/v1/tx/${txid}`);
    const j = await r.json();
    if (j.tx_status === 'success') return j;
    if (j.tx_status?.startsWith('abort')) {
      throw new Error(`tx aborted: ${j.tx_status} | result: ${j.tx_result?.repr ?? 'n/a'}`);
    }
    process.stdout.write('.');
    await new Promise(res => setTimeout(res, 6_000));
  }
  throw new Error('timed out waiting for tx');
}

// ── Main ─────────────────────────────────────────────────────────────────
const { principalCV } = tx;

const sbtcBal0 = await readOnly(SBTC_TOKEN.addr, SBTC_TOKEN.name, 'get-balance', [principalCV(DEPLOYER)]);
console.log('sBTC balance before swap:', sbtcBal0);

console.log(`\nswapping ${STX_IN} uSTX (${Number(STX_IN)/1e6} STX) → sBTC`);
console.log(`min-dx: ${MIN_OUT} sats  |  pool: ${POOL_SBTC_STX.name}`);

const nonce = await fetchNonce({ address: DEPLOYER, network: 'mainnet' });
console.log('nonce:', nonce.toString());

const t = await makeContractCall({
  contractAddress: XYK_CORE.addr,
  contractName:    XYK_CORE.name,
  functionName:    'swap-y-for-x',
  functionArgs: [
    contractPrincipalCV(POOL_SBTC_STX.addr, POOL_SBTC_STX.name), // pool-trait
    contractPrincipalCV(SBTC_TOKEN.addr,    SBTC_TOKEN.name),     // x-token-trait (sBTC)
    contractPrincipalCV(STX_WRAPPER.addr,   STX_WRAPPER.name),    // y-token-trait (STX wrapper)
    uintCV(STX_IN),   // y-amount (uSTX to sell)
    uintCV(MIN_OUT),  // min-dx (minimum sats sBTC to receive)
  ],
  senderKey,
  network: 'mainnet',
  nonce,
  fee: 80_000n,  // 0.08 STX — generous for a multi-contract call
  anchorMode:        AnchorMode.Any,
  postConditionMode: PostConditionMode.Allow,
});

const txid = await broadcast(t);
console.log(`\nbroadcasted → https://explorer.hiro.so/txid/${txid}?chain=mainnet`);
console.log('waiting for confirmation...');

const confirmed = await waitForTx(txid);
console.log('\nconfirmed!');
console.log('tx_result:', confirmed.tx_result?.repr);

const sbtcBal1 = await readOnly(SBTC_TOKEN.addr, SBTC_TOKEN.name, 'get-balance', [principalCV(DEPLOYER)]);
console.log('\nsBTC balance after swap:', sbtcBal1);
console.log('\nswap DONE. Ready for yield stream test.');
