/**
 * check-yield-stream.mjs
 * Reads current state of yield stream #1 on v7 and the
 * contract's LP position in the Bitflow sBTC-STX pool.
 */
import tx from '@stacks/transactions';
const { principalCV, contractPrincipalCV, uintCV, cvToHex, hexToCV, cvToString } = tx;

const API      = 'https://api.hiro.so';
const DEPLOYER = 'SP12EBY3HBKZ2WAKKSZJNVEJCN0BNXSTPJZWYCCNX';
const V7       = 'satsflow-streams-v7';
const SBTC     = { addr: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4', name: 'sbtc-token' };
const POOL     = { addr: 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR', name: 'xyk-pool-sbtc-stx-v-1-1' };
const RECIPIENT = 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9';

async function readOnly(addr, name, fn, args = []) {
  const body = JSON.stringify({ sender: DEPLOYER, arguments: args.map(cvToHex) });
  const r = await fetch(`${API}/v2/contracts/call-read/${addr}/${name}/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
  if (!r.ok) return `HTTP_ERROR:${r.status}`;
  const j = await r.json();
  if (!j.okay && !j.result) return `ERROR: ${JSON.stringify(j)}`;
  return cvToString(hexToCV(j.result.replace(/^0x/, '')));
}

// hex field extractors for pool tuple
function extractUint(hex, fieldName) {
  const key = Buffer.from(fieldName, 'utf8').toString('hex');
  const lenByte = key.length / 2;
  // fields stored as: <field-name-len-byte><name-hex>01<16-byte-bigendian>
  const marker = lenByte.toString(16).padStart(2,'0') + key + '01';
  const pos = hex.indexOf(marker);
  if (pos === -1) return null;
  return BigInt('0x' + hex.slice(pos + marker.length, pos + marker.length + 32));
}

async function main() {
  // ── Stream state ────────────────────────────────────────────────────────────
  const [streamRaw, yieldRaw, claimableRaw] = await Promise.all([
    readOnly(DEPLOYER, V7, 'get-stream', [uintCV(1n)]),
    readOnly(DEPLOYER, V7, 'get-yield-info', [uintCV(1n)]),
    readOnly(DEPLOYER, V7, 'get-claimable', [uintCV(1n), principalCV(RECIPIENT)]),
  ]);

  // ── LP balance held by v7 contract (pool LP token is the pool contract itself)
  const [lpBalanceRaw, sbtcContractBalRaw, poolTotalSupplyRaw] = await Promise.all([
    readOnly(POOL.addr, POOL.name, 'get-balance', [contractPrincipalCV(DEPLOYER, V7)]),
    readOnly(SBTC.addr, SBTC.name, 'get-balance', [contractPrincipalCV(DEPLOYER, V7)]),
    readOnly(POOL.addr, POOL.name, 'get-total-supply'),
  ]);

  // ── Pool reserve raw tuple ───────────────────────────────────────────────────
  const poolResp = await fetch(`${API}/v2/contracts/call-read/${POOL.addr}/${POOL.name}/get-pool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sender: DEPLOYER, arguments: [] }),
  });
  const poolJ   = await poolResp.json();
  const poolHex = poolJ.result?.replace(/^0x/, '') ?? '';
  const xReserve = extractUint(poolHex, 'x-balance');
  const yReserve = extractUint(poolHex, 'y-balance');
  const poolStr  = poolJ.result ? cvToString(hexToCV(poolJ.result.replace(/^0x/,''))) : 'N/A';

  // ── Parse numbers ────────────────────────────────────────────────────────────
  const lpHeld       = BigInt(lpBalanceRaw.match(/(ok\s+)?u(\d+)/)?.[2] ?? '0');
  const totalSupply  = BigInt((poolTotalSupplyRaw).match(/(ok\s+)?u(\d+)/)?.[2] ?? '1');
  const claimable    = BigInt(claimableRaw.match(/(ok\s+)?u(\d+)/)?.[2] ?? '0');
  const ownershipPct = totalSupply > 0n ? Number(lpHeld * 1_000_000n / totalSupply) / 10_000 : 0;
  const sbtcInLP     = (xReserve && totalSupply > 0n) ? (xReserve * lpHeld / totalSupply) : null;

  // ── Pretty print ─────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  STREAM #1  —  satsflow-streams-v7  (mainnet)');
  console.log('═══════════════════════════════════════════════════════');
  console.log(streamRaw.replace(/\) \(/g, ')\n    ('));

  console.log('\n─── YIELD INFO ────────────────────────────────────────');
  console.log(yieldRaw.replace(/\) \(/g, ')\n    ('));
  console.log(`    claimable by recipient : ${claimable} sats`);

  console.log('\n─── BITFLOW sBTC-STX LP POSITION ──────────────────────');
  console.log(`    LP tokens held by v7 contract : ${lpHeld.toLocaleString()}`);
  console.log(`    Pool total LP supply          : ${totalSupply.toLocaleString()}`);
  console.log(`    Pool ownership                : ${ownershipPct.toFixed(6)}%`);
  if (xReserve !== null && yReserve !== null) {
    console.log(`    Pool x-reserve (sBTC)         : ${xReserve} sats  (${(Number(xReserve)/1e8).toFixed(8)} sBTC)`);
    console.log(`    Pool y-reserve (uSTX)         : ${yReserve}  (${(Number(yReserve)/1e6).toFixed(2)} STX)`);
    if (sbtcInLP !== null) {
      console.log(`    Est. sBTC value of LP share   : ~${sbtcInLP} sats`);
    }
  }
  console.log(`    sBTC liquid reserve in v7     : ${sbtcContractBalRaw}`);

  console.log('\n─── LINKS ──────────────────────────────────────────────');
  console.log(`    Contract : https://explorer.hiro.so/address/${DEPLOYER}.${V7}?chain=mainnet`);
  console.log(`    Pool     : https://explorer.hiro.so/address/${POOL.addr}.${POOL.name}?chain=mainnet`);
  console.log(`    Deployer : https://explorer.hiro.so/address/${DEPLOYER}?chain=mainnet`);
  console.log(`    Create tx: https://explorer.hiro.so/txid/8e14ca726a70ff9c0744c3584ac60d0ad1f2f7b8131fb2eb5e76889fd95b13b5?chain=mainnet`);
  console.log();
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
