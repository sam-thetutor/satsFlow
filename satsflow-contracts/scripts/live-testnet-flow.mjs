import tx from '@stacks/transactions';
import { generateWallet } from '@stacks/wallet-sdk';
import { readFileSync } from 'fs';

const {
  makeContractCall,
  broadcastTransaction,
  cvToHex,
  uintCV,
  principalCV,
  fetchNonce,
  AnchorMode,
  PostConditionMode,
  hexToCV,
  cvToString,
} = tx;

const CONTRACT_ADDRESS = 'ST2QFJV445B22TXQXYW0M3EDEYSDGDVV5N15PE2XN';
const CONTRACT_NAME = 'satsflow-streams-v3';
const STX_TOKEN = 'SP000000000000000000002Q6VF78';
const RECIPIENT = 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5';

const toml = readFileSync('settings/Testnet.toml', 'utf8');
const mnemonic = toml.match(/mnemonic\s*=\s*"([^"]+)"/)?.[1];
if (!mnemonic) throw new Error('mnemonic not found in settings/Testnet.toml');

const wallet = await generateWallet({ secretKey: mnemonic, password: 'live-test' });
const senderKey = wallet.accounts[0].stxPrivateKey;
const senderAddress = CONTRACT_ADDRESS;

async function stxBalance(addr) {
  const r = await fetch(`https://api.testnet.hiro.so/extended/v1/address/${addr}/stx`);
  const j = await r.json();
  return BigInt(j.balance || '0');
}

async function readOnly(functionName, args) {
  const r = await fetch(
    `https://api.testnet.hiro.so/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/${functionName}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sender: senderAddress, arguments: args.map(cvToHex) }),
    }
  );
  const j = await r.json();
  const decoded = j.result ? cvToString(hexToCV(j.result)) : 'no-result';
  return { ok: j.ok, decoded, raw: j.result };
}

async function callPublic(functionName, functionArgs, fee = 30000n) {
  const nonce = await fetchNonce({ address: senderAddress, network: 'testnet' });
  const tx = await makeContractCall({
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName,
    functionArgs,
    senderKey,
    network: 'testnet',
    nonce,
    fee,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
  });

  const res = await broadcastTransaction({ transaction: tx, network: 'testnet' });
  if (res.error) {
    throw new Error(`${functionName} broadcast failed: ${res.reason || res.error} ${res.txid || ''}`.trim());
  }
  return res.txid;
}

function parseLastStreamId(decodedListOk) {
  const nums = [...decodedListOk.matchAll(/u(\d+)/g)].map(m => Number(m[1]));
  return nums.length ? nums[nums.length - 1] : null;
}

console.log('sender', senderAddress);
const balBefore = await stxBalance(senderAddress);
console.log('balance_before_uSTX', balBefore.toString());

const createTx = await callPublic('create-stream', [
  principalCV(RECIPIENT),
  principalCV(STX_TOKEN),
  uintCV(1),
  uintCV(2000),
]);
console.log('create_stream_txid', createTx);

await new Promise(r => setTimeout(r, 8000));

const senderStreams = await readOnly('get-sender-streams', [principalCV(senderAddress)]);
console.log('sender_streams', senderStreams.decoded);
const streamId = parseLastStreamId(senderStreams.decoded);
if (!streamId) throw new Error('could not parse created stream id from sender index');
console.log('stream_id', streamId);

const topUpTx = await callPublic('top-up-stream', [uintCV(streamId), uintCV(1000)]);
console.log('top_up_txid', topUpTx);

await new Promise(r => setTimeout(r, 8000));

const cancelTx = await callPublic('cancel-stream', [uintCV(streamId)]);
console.log('cancel_txid', cancelTx);

await new Promise(r => setTimeout(r, 8000));

const streamAfter = await readOnly('get-stream', [uintCV(streamId)]);
console.log('stream_after', streamAfter.decoded);

const balAfter = await stxBalance(senderAddress);
console.log('balance_after_uSTX', balAfter.toString());
console.log('balance_delta_uSTX', (balAfter - balBefore).toString());
