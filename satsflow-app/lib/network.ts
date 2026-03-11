import { STACKS_TESTNET, STACKS_MAINNET } from "@stacks/network";

export const NETWORK =
  process.env.NEXT_PUBLIC_STACKS_NETWORK === "mainnet"
    ? STACKS_MAINNET
    : STACKS_TESTNET;

export const HIRO_API_BASE =
  process.env.NEXT_PUBLIC_STACKS_NETWORK === "mainnet"
    ? "https://api.hiro.so"
    : "https://api.testnet.hiro.so";

export async function fetchReadOnly<T>(
  contractAddress: string,
  contractName: string,
  functionName: string,
  args: string[],
  senderAddress: string
): Promise<T> {
  const url = `${HIRO_API_BASE}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sender: senderAddress, arguments: args }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export async function fetchAccountBalance(address: string): Promise<bigint> {
  const res = await fetch(`${HIRO_API_BASE}/v2/accounts/${address}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = (await res.json()) as { balance: string };
  return BigInt(data.balance ?? "0");
}
