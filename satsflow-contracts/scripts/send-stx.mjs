import tx from "@stacks/transactions";
import { generateWallet } from "@stacks/wallet-sdk";

const { makeSTXTokenTransfer, broadcastTransaction, AnchorMode } = tx;

const MNEMONIC = process.env.MNEMONIC;
if (!MNEMONIC) { console.error("Set MNEMONIC env var"); process.exit(1); }

const RECIPIENT    = "SPMTZYC9GKVMYAECH93EGZN54JWSB4HA1MKXANY1";
const AMOUNT_USTX  = 1_000_000n; // 1 STX

const wallet    = await generateWallet({ secretKey: MNEMONIC, password: "" });
const senderKey = wallet.accounts[0].stxPrivateKey;
const sender    = "SP12EBY3HBKZ2WAKKSZJNVEJCN0BNXSTPJZWYCCNX";

console.log(`Sending ${AMOUNT_USTX} uSTX (1 STX)`);
console.log(`  From : ${sender}`);
console.log(`  To   : ${RECIPIENT}`);

const signed = await makeSTXTokenTransfer({
  recipient:  RECIPIENT,
  amount:     AMOUNT_USTX,
  senderKey,
  network:    'mainnet',
  anchorMode: AnchorMode.Any,
  fee:        2000n,
});

const result = await broadcastTransaction({ transaction: signed, network: 'mainnet' });
console.log("\nBroadcast result:", JSON.stringify(result, null, 2));
if (result.txid) {
  console.log(`\nTX: https://explorer.hiro.so/txid/0x${result.txid}?chain=mainnet`);
}
