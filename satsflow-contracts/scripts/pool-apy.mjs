/**
 * pool-apy.mjs
 * Computes live APY for the Bitflow sBTC-STX XYK pool by:
 *  1. Fetching recent swap txs via Hiro Extended API to estimate 24h volume
 *  2. Applying the 0.25% Bitflow LP fee to get annualised fee yield
 *  3. Comparing to our 6,203 LP token position
 */

const API      = 'https://api.hiro.so';
const POOL     = 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-stx-v-1-1';
const DEPLOYER = 'SP12EBY3HBKZ2WAKKSZJNVEJCN0BNXSTPJZWYCCNX';
const V7       = 'satsflow-streams-v7';

// Bitflow XYK fee is 0.25% LP fee + 0.05% protocol = 0.3% total swap fee
// LP holders earn the 0.25% LP portion
const LP_FEE_BPS = 25; // 0.25%

async function get(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

async function main() {
  // ── 1. Pool reserves (already known but refresh) ──────────────────────────
  const reservesResp = await fetch(`${API}/v2/contracts/call-read/${POOL.split('.')[0]}/${POOL.split('.')[1]}/get-pool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sender: DEPLOYER, arguments: [] }),
  });
  const reservesJ  = await reservesResp.json();
  const hex        = reservesJ.result?.replace(/^0x/, '') ?? '';

  function extractUint(hex, fieldName) {
    const key    = Buffer.from(fieldName, 'utf8').toString('hex');
    const lenB   = key.length / 2;
    const marker = lenB.toString(16).padStart(2, '0') + key + '01';
    const pos    = hex.indexOf(marker);
    if (pos === -1) return null;
    return BigInt('0x' + hex.slice(pos + marker.length, pos + marker.length + 32));
  }

  const xReserve = extractUint(hex, 'x-balance');   // sBTC sats
  const yReserve = extractUint(hex, 'y-balance');   // uSTX

  // ── 2. Fetch recent swap txs on the pool contract ─────────────────────────
  // We want swap-x-for-y and swap-y-for-x calls to estimate volume
  let swapTxs = [];
  let offset = 0;
  const limit = 50;
  let nowTs = Date.now();
  let cutoffTs = nowTs - 7 * 24 * 60 * 60 * 1000; // 7 days ago

  console.log('Fetching recent swap transactions on the pool...');
  outer: for (let page = 0; page < 6; page++) {
    const url  = `${API}/extended/v1/contract/${POOL}/events?limit=${limit}&offset=${offset}`;
    let data;
    try { data = await get(url); } catch { break; }
    const events = data.results ?? [];
    if (events.length === 0) break;

    for (const ev of events) {
      const ts = new Date(ev.burn_block_time_iso ?? ev.block_time_iso ?? 0).getTime();
      if (ts < cutoffTs) break outer;
      swapTxs.push(ev);
    }
    if (events.length < limit) break;
    offset += limit;
  }

  // ── 3. Also pull contract tx list for function names + amounts ─────────────
  let contractTxs = [];
  offset = 0;
  console.log('Fetching contract call transactions...');
  outer2: for (let page = 0; page < 8; page++) {
    const url = `${API}/extended/v1/address/${POOL}/transactions?limit=${limit}&offset=${offset}`;
    let data;
    try { data = await get(url); } catch { break; }
    const txs = data.results ?? [];
    if (txs.length === 0) break;

    for (const tx of txs) {
      const ts = new Date(tx.burn_block_time_iso ?? tx.block_time_iso ?? 0).getTime();
      if (ts < cutoffTs) { break outer2; }
      if (tx.tx_status !== 'success') continue;
      const fn = tx.contract_call?.function_name ?? '';
      if (fn.includes('swap')) contractTxs.push(tx);
    }
    if (txs.length < limit) break;
    offset += limit;
  }

  // ── 4. Parse swap volumes ──────────────────────────────────────────────────
  let totalSbtcVolume = 0n; // sats
  for (const tx of contractTxs) {
    const args = tx.contract_call?.function_args ?? [];
    for (const a of args) {
      if (a.name === 'dx' || a.name === 'dy') {
        try { totalSbtcVolume += BigInt(a.repr?.replace('u','') ?? '0'); } catch {}
      }
    }
  }

  // Estimate 24h volume from span of collected txs
  const spanMs  = contractTxs.length > 1
    ? new Date(contractTxs[0].burn_block_time_iso ?? 0).getTime()
      - new Date(contractTxs[contractTxs.length-1].burn_block_time_iso ?? 0).getTime()
    : 7 * 24 * 60 * 60 * 1000;
  const spanDays = Math.max(spanMs / (1000 * 60 * 60 * 24), 0.1);

  // ── 5. TVL & APY math ─────────────────────────────────────────────────────
  // sBTC price: use STX price proxy or a rough $95k BTC approximation
  const BTC_USD = 95_000;    // conservative current BTC price
  const STX_USD = 0.26;      // approximate STX price

  const tvlSbtcUSD  = xReserve ? Number(xReserve) / 1e8 * BTC_USD : 0;
  const tvlStxUSD   = yReserve ? Number(yReserve) / 1e6 * STX_USD : 0;
  const tvlUSD      = tvlSbtcUSD + tvlStxUSD;

  const daily7dSbtcVol  = Number(totalSbtcVolume) / 1e8 / spanDays; // sBTC/day
  const daily7dUSDVol   = daily7dSbtcVol * BTC_USD;
  const daily7dFeeUSD   = daily7dUSDVol * LP_FEE_BPS / 10_000;
  const annualFeeUSD    = daily7dFeeUSD * 365;
  const apyPct          = tvlUSD > 0 ? annualFeeUSD / tvlUSD * 100 : 0;

  // Our position
  const totalSupply   = 51_475_290_006n;
  const ourLp         = 6_203n;
  const ownershipPct  = Number(ourLp) / Number(totalSupply) * 100;
  const ourTvlUSD     = tvlUSD * ownershipPct / 100;
  const ourAnnualFee  = annualFeeUSD * ownershipPct / 100;
  const sbtcInLP      = xReserve ? Number(xReserve * ourLp / totalSupply) : 0;

  // ── 6. Output ─────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  BITFLOW sBTC-STX POOL — APY ESTIMATE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Pool            : ${POOL}`);
  console.log(`  LP fee          : ${LP_FEE_BPS / 100}% per swap`);
  console.log('');
  console.log('  ── Pool Reserves ──');
  console.log(`  sBTC (x)        : ${xReserve ? (Number(xReserve)/1e8).toFixed(8) : '?'} sBTC  (~$${tvlSbtcUSD.toLocaleString('en', {maximumFractionDigits:0})})`);
  console.log(`  STX  (y)        : ${yReserve ? (Number(yReserve)/1e6).toFixed(2) : '?'} STX  (~$${tvlStxUSD.toLocaleString('en', {maximumFractionDigits:0})})`);
  console.log(`  Total TVL       : ~$${tvlUSD.toLocaleString('en', {maximumFractionDigits:0})}`);
  console.log('');
  console.log('  ── Volume (7-day sample) ──');
  console.log(`  Swap txs found  : ${contractTxs.length} (over ${spanDays.toFixed(1)} days)`);
  console.log(`  Total sBTC vol  : ${(Number(totalSbtcVolume)/1e8).toFixed(4)} sBTC`);
  console.log(`  Daily sBTC vol  : ~${daily7dSbtcVol.toFixed(4)} sBTC/day  (~$${daily7dUSDVol.toLocaleString('en', {maximumFractionDigits:0})}/day)`);
  console.log(`  Daily LP fees   : ~$${daily7dFeeUSD.toLocaleString('en', {maximumFractionDigits:0})}`);
  console.log(`  Annualised fees : ~$${annualFeeUSD.toLocaleString('en', {maximumFractionDigits:0})}`);
  console.log('');
  console.log('  ── APY ──');
  console.log(`  Pool LP fee APY : ~${apyPct.toFixed(2)}%`);
  
  // Note on impermanent loss
  console.log('  (excludes impermanent loss risk; sBTC-STX has correlated price movements)');
  console.log('');
  console.log('  ── Our Position (6,203 LP tokens) ──');
  console.log(`  Pool ownership  : ${ownershipPct.toFixed(8)}%`);
  console.log(`  Est. sBTC in LP : ~${sbtcInLP} sats  (of our 250 deployed)`);
  console.log(`  Our TVL         : ~$${ourTvlUSD.toFixed(4)}`);
  console.log(`  Annual yield    : ~$${ourAnnualFee.toFixed(6)}  (tiny test position)`);
  console.log('');
  console.log(`  Pool explorer   : https://explorer.hiro.so/address/${POOL}?chain=mainnet`);
  console.log(`  Bitflow app     : https://bitflow.finance/pools`);
  console.log('');

  // Assumptions note
  console.log('  ╔══ ASSUMPTIONS ══════════════════════════════════════╗');
  console.log(`  ║  BTC price  : $${BTC_USD.toLocaleString()}`);
  console.log(`  ║  STX price  : $${STX_USD}`);
  console.log('  ║  LP fee     : 0.25% (standard Bitflow XYK)');
  console.log('  ╚═════════════════════════════════════════════════════╝');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
