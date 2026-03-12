/**
 * check-claimable.mjs
 * Checks how much sBTC has accrued and is claimable by the recipient
 * on stream #1 of satsflow-streams-v7.
 */
import tx from '@stacks/transactions';
const { principalCV, uintCV, cvToHex, hexToCV, cvToString } = tx;

const API       = 'https://api.hiro.so';
const DEPLOYER  = 'SP12EBY3HBKZ2WAKKSZJNVEJCN0BNXSTPJZWYCCNX';
const V7        = 'satsflow-streams-v7';
const RECIPIENT = 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9';

async function ro(addr, name, fn, args = []) {
  const r = await fetch(`${API}/v2/contracts/call-read/${addr}/${name}/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sender: DEPLOYER, arguments: args.map(cvToHex) }),
  });
  const j = await r.json();
  return j.result ? cvToString(hexToCV(j.result.replace(/^0x/, ''))) : `ERROR:${JSON.stringify(j)}`;
}

async function main() {
  const [claimableRaw, streamRaw, infoResp] = await Promise.all([
    ro(DEPLOYER, V7, 'get-claimable', [uintCV(1n), principalCV(RECIPIENT)]),
    ro(DEPLOYER, V7, 'get-stream', [uintCV(1n)]),
    fetch(`${API}/v2/info`).then(r => r.json()),
  ]);

  // parse stream fields
  const totalWithdrawn = streamRaw.match(/total_withdrawn u(\d+)/)?.[1] ?? '?';
  const deposit        = parseInt(streamRaw.match(/deposit u(\d+)/)?.[1] ?? '0');
  const rate           = parseInt(streamRaw.match(/rate_per_second u(\d+)/)?.[1] ?? '1');
  const startTs        = parseInt(streamRaw.match(/start_timestamp u(\d+)/)?.[1] ?? '0');
  const duration       = parseInt(streamRaw.match(/duration u(\d+)/)?.[1] ?? '0');
  const isActive       = streamRaw.includes('is_active true');

  const burnNow  = infoResp.burn_block_height;
  const elapsed  = burnNow - startTs;
  const expected = Math.min(elapsed * rate, deposit);
  const claimable = claimableRaw.match(/(ok\s+)?u(\d+)/)?.[2] ?? '?';
  const pct       = deposit > 0 ? (expected / deposit * 100).toFixed(1) : '0';
  const streamDone = elapsed >= duration;

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  STREAM #1 — RECIPIENT CLAIMABLE CHECK');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Recipient       : ${RECIPIENT}`);
  console.log(`  Explorer        : https://explorer.hiro.so/address/${RECIPIENT}?chain=mainnet`);
  console.log('');
  console.log(`  Claimable now   : ${claimable} sats  ← call withdraw-from-stream to collect`);
  console.log(`  Total withdrawn : ${totalWithdrawn} sats (nothing claimed yet)`);
  console.log('');
  console.log('  ── Stream progress ──');
  console.log(`  Deposit         : ${deposit} sats total`);
  console.log(`  Rate            : ${rate} sat/block`);
  console.log(`  Start block     : ${startTs}`);
  console.log(`  Current block   : ${burnNow}`);
  console.log(`  Blocks elapsed  : ${elapsed}  (~${(elapsed * 10 / 60).toFixed(1)} hrs)`);
  console.log(`  Expected accrual: ${expected} sats  (${pct}% of stream)`);
  console.log(`  Stream status   : ${streamDone ? 'COMPLETED (all sats vested)' : `ACTIVE — ${duration - elapsed} blocks remaining`}`);
  console.log('');
  console.log(`  Contract : https://explorer.hiro.so/address/${DEPLOYER}.${V7}?chain=mainnet`);
  console.log('');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
