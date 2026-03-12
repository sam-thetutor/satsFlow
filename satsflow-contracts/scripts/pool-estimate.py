#!/usr/bin/env python3
"""Parse sBTC-STX pool reserves and estimate swap output."""
import sys, json, urllib.request

API = "https://api.hiro.so"
DEPLOYER = "SP12EBY3HBKZ2WAKKSZJNVEJCN0BNXSTPJZWYCCNX"

def call_read(addr, contract, fn, args=None):
    url = f"{API}/v2/contracts/call-read/{addr}/{contract}/{fn}"
    body = json.dumps({"sender": DEPLOYER, "arguments": args or []}).encode()
    req = urllib.request.Request(url, data=body, headers={"content-type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as r:
        return json.load(r)

def extract_uint128(hex_str, field_ascii):
    field_hex = field_ascii.encode().hex() + "01"  # 01 = uint128 type byte
    pos = hex_str.find(field_hex)
    if pos == -1:
        return None
    val_hex = hex_str[pos + len(field_hex): pos + len(field_hex) + 32]
    return int(val_hex, 16)

pool_resp = call_read("SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR", "xyk-pool-sbtc-stx-v-1-1", "get-pool")
result_hex = pool_resp["result"].lstrip("0x")

x = extract_uint128(result_hex, "x-balance")
y = extract_uint128(result_hex, "y-balance")

print(f"x-balance (sBTC sats) : {x:,}  = {x/1e8:.8f} sBTC")
print(f"y-balance (uSTX)      : {y:,}  = {y/1e6:.4f} STX")

if x and y:
    price = (y / 1e6) / (x / 1e8)
    print(f"implied price         : 1 sBTC = {price:,.0f} STX")
    for stx_to_swap in [3_000_000, 5_000_000]:
        # XYK formula: dx = x * dy / (y + dy), with 0.5% fee (50 BPS)
        sbtc_out = int((stx_to_swap * x * 9950) / ((y + stx_to_swap) * 10000))
        print(f"  swap {stx_to_swap/1e6:.0f} STX -> ~{sbtc_out} sats sBTC  ({sbtc_out/1e8:.8f} sBTC)")
