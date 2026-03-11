// SatsFlow contract configuration
// Deployed: ST2QFJV445B22TXQXYW0M3EDEYSDGDVV5N15PE2XN.satsflow-streams-v5

export const CONTRACT_ADDRESS = "ST2QFJV445B22TXQXYW0M3EDEYSDGDVV5N15PE2XN";
export const CONTRACT_NAME = "satsflow-streams-v5";
export const CONTRACT_ID = `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`;

export const SBTC_TOKEN =
  "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
export const STX_TOKEN = "SP000000000000000000002Q6VF78";

// SIP-010 FT post-condition metadata for sBTC
export const SBTC_ASSET_CONTRACT_ID = SBTC_TOKEN;
export const SBTC_ASSET_NAME = "sbtc-token";

export const SUPPORTED_TOKENS = {
  STX: STX_TOKEN,
  sBTC: SBTC_TOKEN,
} as const;

export type TokenKey = keyof typeof SUPPORTED_TOKENS;

export const TOKEN_DECIMALS: Record<TokenKey, number> = {
  STX: 6, // microSTX
  sBTC: 8, // satoshis
};

export const TOKEN_SYMBOLS: Record<TokenKey, string> = {
  STX: "STX",
  sBTC: "sBTC",
};

export function tokenKeyFromPrincipal(principal: string): TokenKey | null {
  if (principal === STX_TOKEN) return "STX";
  if (principal === SBTC_TOKEN) return "sBTC";
  return null;
}

export function formatTokenAmount(amount: bigint, token: TokenKey): string {
  const decimals = TOKEN_DECIMALS[token];
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const frac = amount % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 2);
  return `${whole}.${fracStr} ${TOKEN_SYMBOLS[token]}`;
}

// Error codes from the contract
export const CONTRACT_ERRORS: Record<number, string> = {
  100: "Invalid token",
  101: "Invalid deposit amount",
  102: "Invalid rate",
  103: "Invalid recipient (cannot be sender)",
  104: "Invalid top-up amount",
  105: "Invalid principal",
  150: "Unauthorized",
  200: "Stream not found",
  201: "Stream is inactive",
  202: "Nothing to withdraw",
  203: "Index full",
  250: "Transfer failed",
};





