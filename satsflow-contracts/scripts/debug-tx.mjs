import tx from '@stacks/transactions';
import { generateWallet } from '@stacks/wallet-sdk';
import { readFileSync } from 'fs';

const { makeContractCall, uintCV, AnchorMode, PostConditionMode } = tx;

const toml = readFileSync('settings/Mainnet.toml', 'utf8');
const mnemonic = toml.match(/mnemonic\s*=\s*"([^"]+)"/)?.[1];
const wallet = await generateWallet({ secretKey: mnemonic, password: 'mainnet-smoke' });
const senderKey = wallet.accounts[0].stxPrivateKey;
console.log('senderKey length:', senderKey.length, '  suffix:', senderKey.slice(-4));

const t = await makeContractCall({
  contractAddress: 'SP12EBY3HBKZ2WAKKSZJNVEJCN0BNXSTPJZWYCCNX',
  contractName: 'satsflow-streams-v6',
  functionName: 'get-stream',
  functionArgs: [uintCV(1n)],
  senderKey,
  network: 'mainnet',
  nonce: 2,
  fee: 50000,
  anchorMode: AnchorMode.Any,
  postConditionMode: PostConditionMode.Allow,
});

const bytes = t.serialize();
console.log('first 16 bytes:', Buffer.from(bytes).slice(0, 16).toString('hex'));
console.log('  byte[0] version :', '0x' + bytes[0].toString(16).padStart(2, '0'), '(should be 0x00 for mainnet)');
console.log('  bytes[1-4] chainId :', Buffer.from(bytes).slice(1, 5).toString('hex'), '(mainnet = 00000001)');
console.log('  byte[5] auth-type :', '0x' + bytes[5].toString(16).padStart(2, '0'), '(decimal:', bytes[5], ') -- should be 0x04');
