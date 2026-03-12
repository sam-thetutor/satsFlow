/**
 * deploy-v7.mjs
 * Deploys satsflow-streams-v7 directly to Stacks mainnet,
 * bypassing Clarinet's batch planner entirely.
 *
 * Usage: node scripts/deploy-v7.mjs
 */

import tx from '@stacks/transactions';
import { generateWallet } from '@stacks/wallet-sdk';
import { readFileSync } from 'fs';

const {
  makeContractDeploy,
  AnchorMode,
  PostConditionMode,
  fetchNonce,
} = tx;

const DEPLOYER = 'SP12EBY3HBKZ2WAKKSZJNVEJCN0BNXSTPJZWYCCNX';
const API      = 'https://api.hiro.so';

// ── Wallet ────────────────────────────────────────────────────────────────
const toml     = readFileSync('settings/Mainnet.toml', 'utf8');
const mnemonic = toml.match(/mnemonic\s*=\s*"([^"]+)"/)?.[1];
if (!mnemonic) throw new Error('mnemonic not found in settings/Mainnet.toml');

const wallet    = await generateWallet({ secretKey: mnemonic, password: 'mainnet-smoke' });
const senderKey = wallet.accounts[0].stxPrivateKey;

// ── Contract source ───────────────────────────────────────────────────────
const codeBody = readFileSync('contracts/satsflow-streams-v7.clar', 'utf8');
console.log(`contract size: ${codeBody.length} chars`);

// ── Balance + nonce ───────────────────────────────────────────────────────
const balResp = await fetch(`${API}/v2/accounts/${DEPLOYER}?proof=0`);
const balData = await balResp.json();
const balance = parseInt(balData.balance, 16);
const nonce   = await fetchNonce({ address: DEPLOYER, network: 'mainnet' });
console.log(`balance: ${balance} uSTX  (${(balance / 1e6).toFixed(4)} STX)`);
console.log(`nonce  : ${nonce}`);

// ── Build contract-deploy tx ──────────────────────────────────────────────
// Fee: ~0.5 STX for a large contract deploy
const t = await makeContractDeploy({
  contractName:      'satsflow-streams-v7',
  codeBody,
  senderKey,
  network:           'mainnet',
  nonce,
  fee:               500_000n,
  anchorMode:        AnchorMode.Any,
  postConditionMode: PostConditionMode.Allow,
  clarityVersion:    3,
});

// ── Broadcast ─────────────────────────────────────────────────────────────
const txHex   = t.serialize();
const txBytes = Buffer.from(txHex, 'hex');

console.log(`\nbroadcasting deploy tx...`);
const r    = await fetch(`${API}/v2/transactions`, {
  method:  'POST',
  headers: { 'Content-Type': 'application/octet-stream' },
  body:    txBytes,
});
const text = await r.text();
console.log(`HTTP ${r.status}: ${text.slice(0, 300)}`);

let result;
try { result = JSON.parse(text); } catch {
  throw new Error(`non-JSON response (HTTP ${r.status}): ${text.slice(0, 200)}`);
}
if (result.error) throw new Error(`deploy failed: ${result.reason ?? result.error}`);

const txid = result.txid ?? result;
console.log(`\nbroadcasted → https://explorer.hiro.so/txid/${txid}?chain=mainnet`);

// ── Wait for confirmation ─────────────────────────────────────────────────
console.log('waiting for confirmation (anchor block ~10 min max)...');
const deadline = Date.now() + 600_000;
while (Date.now() < deadline) {
  const r2 = await fetch(`${API}/extended/v1/tx/${txid}`);
  const j  = await r2.json();
  if (j.tx_status === 'success') {
    console.log('\nCONFIRMED ✓');
    console.log('tx_result:', j.tx_result?.repr);
    break;
  }
  if (j.tx_status?.startsWith('abort')) {
    throw new Error(`tx aborted: ${j.tx_result?.repr ?? j.tx_status}`);
  }
  process.stdout.write('.');
  await new Promise(res => setTimeout(res, 8_000));
}

console.log(`\nv7 deployed: SP12EBY3HBKZ2WAKKSZJNVEJCN0BNXSTPJZWYCCNX.satsflow-streams-v7`);
