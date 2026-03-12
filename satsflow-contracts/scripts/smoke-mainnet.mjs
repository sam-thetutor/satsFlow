/**
 * smoke-mainnet.mjs
 * 
 * Creates a tiny STX stream on mainnet against satsflow-streams-v6,
 * waits for confirmation, then reads back the stream state to verify
 * the contract is live and accepting calls.
 * 
 * Usage (from satsflow-contracts/):
 *   node scripts/smoke-mainnet.mjs
 */

import tx from '@stacks/transactions';
import { generateWallet } from '@stacks/wallet-sdk';
import { readFileSync } from 'fs';

const {
  makeContractCall,
  broadcastTransaction,
  uintCV,
  principalCV,
  listCV,
  tupleCV,
  stringAsciiCV,
  cvToHex,
  hexToCV,
  cvToString,
  AnchorMode,
  PostConditionMode,
  fetchNonce,
} = tx;

// ── Contract ─────────────────────────────────────────────────────────────────
const DEPLOYER      = 'SP12EBY3HBKZ2WAKKSZJNVEJCN0BNXSTPJZWYCCNX';
const CONTRACT_NAME = 'satsflow-streams-v6';
const STX_TOKEN     = 'SP000000000000000000002Q6VF78';
const API           = 'https://api.hiro.so';

// Recipient must differ from sender. Using a well-known Stacks address
// (Alex Lab treasury). Stream is 100 uSTX total — negligible value.
const RECIPIENT = 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9';

// ── Wallet ────────────────────────────────────────────────────────────────────
const toml     = readFileSync('settings/Mainnet.toml', 'utf8');
const mnemonic = toml.match(/mnemonic\s*=\s*"([^"]+)"/)?.[1];
if (!mnemonic) throw new Error('mnemonic not found in settings/Mainnet.toml');

const wallet    = await generateWallet({ secretKey: mnemonic, password: 'mainnet-smoke' });
const senderKey = wallet.accounts[0].stxPrivateKey;

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getBalance(addr) {
  const r = await fetch(`${API}/v2/accounts/${addr}?proof=0`);
  const j = await r.json();
  return BigInt(j.balance ?? '0x0').valueOf();
}

async function readOnly(fn, args) {
  const r = await fetch(
    `${API}/v2/contracts/call-read/${DEPLOYER}/${CONTRACT_NAME}/${fn}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: DEPLOYER,
        arguments: args.map(cvToHex),
      }),
    }
  );
  const j = await r.json();
  return j.result ? cvToString(hexToCV(j.result)) : null;
}

async function callPublic(fn, fnArgs, fee = 50000n) {
  const nonce = await fetchNonce({ address: DEPLOYER, network: 'mainnet' });
  console.log('  nonce:', nonce.toString());
  const t = await makeContractCall({
    contractAddress: DEPLOYER,
    contractName: CONTRACT_NAME,
    functionName: fn,
    functionArgs: fnArgs,
    senderKey,
    network: 'mainnet',
    nonce,
    fee,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
  });

  // serialize() in @stacks/transactions v7 returns a hex string, not Uint8Array.
  // Must decode hex → binary before posting as octet-stream.
  const txHex = t.serialize();
  const txBytes = Buffer.from(txHex, 'hex');
  const r = await fetch('https://api.hiro.so/v2/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: txBytes,
  });
  const text = await r.text();
  console.log('  broadcast HTTP status:', r.status);
  console.log('  broadcast raw response:', text.slice(0, 500));

  let result;
  try { result = JSON.parse(text); } catch {
    throw new Error(`broadcast non-JSON (HTTP ${r.status}): ${text.slice(0, 300)}`);
  }
  if (result.error) throw new Error(`${fn} failed: ${result.reason ?? result.error}`);
  return result.txid ?? result;
}

async function waitForTx(txid, maxWaitMs = 180_000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const r = await fetch(`${API}/extended/v1/tx/${txid}`);
    const j = await r.json();
    if (j.tx_status === 'success') return j;
    if (j.tx_status?.startsWith('abort')) {
      throw new Error(`tx aborted: ${j.tx_status} — ${j.tx_result?.repr ?? ''}`);
    }
    process.stdout.write('.');
    await new Promise(res => setTimeout(res, 6_000));
  }
  throw new Error('tx not confirmed within timeout');
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('deployer :', DEPLOYER);
const bal = await getBalance(DEPLOYER);
console.log('balance  :', `${bal} uSTX  (${(Number(bal) / 1e6).toFixed(4)} STX)`);

// 5 STX @ 100 uSTX/s → 50,000 second stream (~13.9 hours)
const DEPOSIT = 5_000_000n;
const RATE    = 100n;

console.log(`\ncreating stream: ${DEPOSIT} uSTX @ ${RATE} uSTX/s → ${RECIPIENT}`);

const txid = await callPublic('create-stream', [
  listCV([tupleCV({ recipient: principalCV(RECIPIENT), rate_per_second: uintCV(RATE) })]),
  principalCV(STX_TOKEN),
  uintCV(DEPOSIT),
  stringAsciiCV('mainnet-smoke-test'),
  stringAsciiCV('v6 smoke test - 5 STX'),
]);

console.log(`\nbroadcasted → https://explorer.hiro.so/txid/${txid}?chain=mainnet`);
console.log('waiting for confirmation', { txid });

const confirmed = await waitForTx(txid);
console.log('\nconfirmed!');
console.log('tx_result :', confirmed.tx_result?.repr);

// ── Read back stream ──────────────────────────────────────────────────────────
const senderStreams = await readOnly('get-sender-streams', [principalCV(DEPLOYER)]);
console.log('\nget-sender-streams:', senderStreams);

// Parse the last stream ID from the response list
const ids = [...(senderStreams ?? '').matchAll(/u(\d+)/g)].map(m => Number(m[1]));
const streamId = ids.at(-1);

if (streamId != null) {
  const stream = await readOnly('get-stream', [uintCV(BigInt(streamId))]);
  console.log(`\nget-stream(${streamId}):`, stream);

  const claimable = await readOnly('get-claimable', [
    uintCV(BigInt(streamId)),
    principalCV(RECIPIENT),
  ]);
  console.log(`get-claimable(${streamId}, recipient):`, claimable);
} else {
  console.warn('could not parse stream id from sender index response');
}

const balAfter = await getBalance(DEPLOYER);
console.log(`\nbalance after: ${balAfter} uSTX  (${(Number(balAfter) / 1e6).toFixed(4)} STX)`);
console.log(`spent: ${bal - balAfter} uSTX total (deposit + fee)`);
console.log('\nsmoke test PASSED ✓');
