import tx from "@stacks/transactions";
import { generateWallet } from "@stacks/wallet-sdk";

const {
  makeContractCall,
  broadcastTransaction,
  uintCV,
  principalCV,
  noneCV,
  PostConditionMode,
  Pc,
  AnchorMode,
} = tx;

const MNEMONIC   = process.env.MNEMONIC;
if (!MNEMONIC) { console.error("Set MNEMONIC env var"); process.exit(1); }

const RECIPIENT  = "SPMTZYC9GKVMYAECH93EGZN54JWSB4HA1MKXANY1";
const SBTC_CONTRACT = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";
const SBTC_NAME     = "sbtc-token";
const AMOUNT_SATS   = 586n; // all sats

const wallet    = await generateWallet({ secretKey: MNEMONIC, password: "" });
const senderKey = wallet.accounts[0].stxPrivateKey;
const sender    = "SP12EBY3HBKZ2WAKKSZJNVEJCN0BNXSTPJZWYCCNX";

console.log(`Sending ${AMOUNT_SATS} sats sBTC`);
console.log(`  From : ${sender}`);
console.log(`  To   : ${RECIPIENT}`);

const signed = await makeContractCall({
  contractAddress: SBTC_CONTRACT,
  contractName:    SBTC_NAME,
  functionName:    "transfer",
  functionArgs: [
    uintCV(AMOUNT_SATS),
    principalCV(sender),
    principalCV(RECIPIENT),
    noneCV(), // optional memo
  ],
  senderKey,
  network: 'mainnet',
  postConditionMode: PostConditionMode.Deny,
  postConditions: [
    Pc.principal(sender)
      .willSendEq(AMOUNT_SATS)
      .ft(`${SBTC_CONTRACT}.${SBTC_NAME}`, SBTC_NAME),
  ],
  fee: 2000n,
  anchorMode: AnchorMode.Any,
});

const result = await broadcastTransaction({ transaction: signed, network: 'mainnet' });
console.log("\nBroadcast result:", JSON.stringify(result, null, 2));
if (result.txid) {
  console.log(`\nTX: https://explorer.hiro.so/txid/0x${result.txid}?chain=mainnet`);
}
