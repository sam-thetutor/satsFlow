/**
 * smoke-yield-v7.mjs
 * Tests create-stream-with-yield on satsflow-streams-v7 (mainnet).
 * Deposits 500 sats sBTC, 50% reserve, deploys 250 sats to sBTC-STX Bitflow LP.
 *
 * Usage: node scripts/smoke-yield-v7.mjs
 */

import tx from '@stacks/transactions';
import { generateWallet } from '@stacks/wallet-sdk';
import { readFileSync } from 'fs';

const {
  makeContractCall,
  uintCV,
  listCV,
  tupleCV,
  principalCV,
  contractPrincipalCV,
  stringAsciiCV,
  cvToHex,
  hexToCV,
  cvToString,
  AnchorMode,
  PostConditionMode,
  fetchNonce,
} = tx;

// ── Addresses ────────────────────────────────────────────────────────────────
const DEPLOYER      = 'SP12EBY3HBKZ2WAKKSZJNVEJCN0BNXSTPJZWYCCNX';
const CONTRACT_NAME = 'satsflow-streams-v7';
const API           = 'https://api.hiro.so';
const SBTC          = { addr: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4', name: 'sbtc-token' };

// Recipient must differ from sender
const RECIPIENT = 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9';

// ── Stream params ─────────────────────────────────────────────────────────────
// 500 sats deposit, 1 sat/s rate → 500-second stream
// 50% reserve (5000 BPS) → 250 sats liquid, 250 sats deployed to LP
const DEPOSIT           = 500n;
const RATE              = 1n;     // sat/s
const RESERVE_RATIO_BPS = 5000n;  // 50%

// ── Wallet ─────────────────────────────────────────────────────────────────
const toml     = readFileSync('settings/Mainnet.toml', 'utf8');
const mnemonic = toml.match(/mnemonic\s*=\s*"([^"]+)"/)?.[1];
if (!mnemonic) throw new Error('mnemonic not found in settings/Mainnet.toml');

const wallet    = await generateWallet({ secretKey: mnemonic, password: 'mainnet-smoke' });
const senderKey = wallet.accounts[0].stxPrivateKey;

// ── Helpers ───────────────────────────────────────────────────────────────────
async function readOnly(fn, args = []) {
  const r = await fetch(`${API}/v2/contracts/call-read/${DEPLOYER}/${CONTRACT_NAME}/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sender: DEPLOYER, arguments: args.map(cvToHex) }),
  });
  const j = await r.json();
  return j.result ? cvToString(hexToCV(j.result)) : `ERROR: ${JSON.stringify(j)}`;
}

async function sbtcBalance() {
  const r = await fetch(
    `${API}/v2/contracts/call-read/${SBTC.addr}/${SBTC.name}/get-balance`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sender: DEPLOYER, arguments: [cvToHex(principalCV(DEPLOYER))] }),
    }
  );
  const j = await r.json();
  return j.result ? cvToString(hexToCV(j.result)) : 'ERROR';
}

async function broadcast(t) {
  const txBytes = Buffer.from(t.serialize(), 'hex');
  const r = await fetch(`${API}/v2/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: txBytes,
  });
  const text = await r.text();
  console.log(`  HTTP ${r.status}: ${text.slice(0, 300)}`);
  let result;
  try { result = JSON.parse(text); } catch {
    throw new Error(`non-JSON (HTTP ${r.status}): ${text.slice(0, 200)}`);
  }
  if (result.error) throw new Error(`broadcast failed: ${result.reason ?? result.error}`);
  return result.txid ?? result;
}

async function waitForTx(txid, maxMs = 300_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const r = await fetch(`${API}/extended/v1/tx/${txid}`);
    const j = await r.json();
    if (j.tx_status === 'success') return j;
    if (j.tx_status?.startsWith('abort')) {
      throw new Error(`tx aborted: ${j.tx_status} | result: ${j.tx_result?.repr ?? 'n/a'}`);
    }
    process.stdout.write('.');
    await new Promise(res => setTimeout(res, 7_000));
  }
  throw new Error('timed out');
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log('deployer :', DEPLOYER);
console.log('contract :', `${DEPLOYER}.${CONTRACT_NAME}`);
console.log(`deposit  : ${DEPOSIT} sats sBTC @ ${RATE} sat/s → ${Number(DEPOSIT / RATE)}s stream`);
console.log(`reserve  : ${RESERVE_RATIO_BPS} BPS (${Number(RESERVE_RATIO_BPS) / 100}% liquid)`);
console.log(`deploy   : ${DEPOSIT - (DEPOSIT * RESERVE_RATIO_BPS / 10000n)} sats → Bitflow sBTC-STX LP`);
console.log();

const balBefore = await sbtcBalance();
console.log('sBTC before:', balBefore);

const nonce = await fetchNonce({ address: DEPLOYER, network: 'mainnet' });
console.log('nonce :', nonce.toString());

const t = await makeContractCall({
  contractAddress: DEPLOYER,
  contractName:    CONTRACT_NAME,
  functionName:    'create-stream-with-yield',
  functionArgs: [
    listCV([tupleCV({
      recipient:       principalCV(RECIPIENT),
      rate_per_second: uintCV(RATE),
    })]),
    uintCV(DEPOSIT),
    stringAsciiCV('yield-smoke-v7'),
    stringAsciiCV('v7 yield test - 500 sats sBTC-STX LP'),
    uintCV(RESERVE_RATIO_BPS),
  ],
  senderKey,
  network:           'mainnet',
  nonce,
  fee:               200_000n,  // 0.2 STX — multi-contract LP call
  anchorMode:        AnchorMode.Any,
  postConditionMode: PostConditionMode.Allow,
});

console.log('\ncalling create-stream-with-yield...');
const txid = await broadcast(t);
console.log(`broadcasted → https://explorer.hiro.so/txid/${txid}?chain=mainnet`);
console.log('waiting for confirmation...');

const confirmed = await waitForTx(txid);
console.log('\nconfirmed!');
console.log('tx_result :', confirmed.tx_result?.repr);

// ── Verify stream state ───────────────────────────────────────────────────────
const senderStreams = await readOnly('get-sender-streams', [principalCV(DEPLOYER)]);
console.log('\nget-sender-streams:', senderStreams);

const ids      = [...(senderStreams ?? '').matchAll(/u(\d+)/g)].map(m => Number(m[1]));
const streamId = ids.at(-1);

if (streamId != null) {
  const stream = await readOnly('get-stream',     [uintCV(BigInt(streamId))]);
  const yield_ = await readOnly('get-yield-info', [uintCV(BigInt(streamId))]);
  console.log(`\nget-stream(${streamId}):`);
  console.log(stream);
  console.log(`\nget-yield-info(${streamId}):`);
  console.log(yield_);
}

const balAfter = await sbtcBalance();
console.log('\nsBTC after :', balAfter);
console.log('\nyield stream smoke test PASSED ✓');
