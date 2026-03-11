"use client";

import { useCallback } from "react";
import {
  uintCV,
  principalCV,
  listCV,
  tupleCV,
  stringAsciiCV,
  Pc,
  PostConditionMode,
} from "@stacks/transactions";
import {
  CONTRACT_ADDRESS,
  CONTRACT_NAME,
  SBTC_ASSET_CONTRACT_ID,
  SBTC_ASSET_NAME,
  SBTC_TOKEN,
  STX_TOKEN,
  TokenKey,
} from "@/lib/contract";
import { NETWORK } from "@/lib/network";
import { getUserSession, useWallet } from "@/lib/wallet";

type ConnectModule = Record<string, unknown> & {
  default?: Record<string, unknown> & {
    default?: Record<string, unknown>;
  };
};

function getOpenContractCall(
  connectModule: ConnectModule
) {
  const fn =
    connectModule.openContractCall ??
    (connectModule.default as {
      openContractCall?: typeof connectModule.openContractCall;
      default?: { openContractCall?: typeof connectModule.openContractCall };
    } | undefined)?.openContractCall ??
    (connectModule.default as {
      default?: { openContractCall?: typeof connectModule.openContractCall };
    } | undefined)?.default?.openContractCall;

  if (typeof fn !== "function") {
    throw new Error("Stacks Connect unavailable: openContractCall export not found");
  }

  return fn;
}

function senderSpendPostCondition(senderAddress: string, token: TokenKey, amount: bigint) {
  if (token === "STX") {
    return [Pc.principal(senderAddress).willSendLte(amount).ustx()];
  }

  return [
    Pc.principal(senderAddress)
      .willSendLte(amount)
      .ft(SBTC_ASSET_CONTRACT_ID, SBTC_ASSET_NAME),
  ];
}

// --- create-stream ---
export function useCreateStream() {
  const { address } = useWallet();

  return useCallback(
    async (
      recipientEntries: { recipient: string; rate: bigint }[],
      token: TokenKey,
      deposit: bigint,
      name: string,
      description: string,
      onSuccess: (txId: string) => void,
      onCancel?: () => void
    ) => {
      const [connectModule, userSession] = await Promise.all([
        import("@stacks/connect"),
        getUserSession(),
      ]);
      const openContractCall = getOpenContractCall(connectModule as ConnectModule);
      const tokenPrincipal = token === "STX" ? STX_TOKEN : SBTC_TOKEN;
      if (!address) {
        throw new Error("Wallet not connected");
      }
      const senderAddress = address;
      const postConditions = senderSpendPostCondition(senderAddress, token, deposit);
      const entriesCV = recipientEntries.map((e) =>
        tupleCV({ recipient: principalCV(e.recipient), rate_per_second: uintCV(e.rate) })
      );

      openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        network: NETWORK,
        userSession,
        functionName: "create-stream",
        functionArgs: [
          listCV(entriesCV),
          principalCV(tokenPrincipal),
          uintCV(deposit),
          stringAsciiCV(name),
          stringAsciiCV(description),
        ],
        postConditions,
        postConditionMode: PostConditionMode.Deny,
        onFinish: (data: { txId: string }) => onSuccess(data.txId),
        onCancel,
      });
    },
    [address]
  );
}

// --- withdraw ---
export function useWithdraw() {
  return useCallback(
    async (
      streamId: number,
      onSuccess: (txId: string) => void,
      onCancel?: () => void
    ) => {
      const [connectModule, userSession] = await Promise.all([
        import("@stacks/connect"),
        getUserSession(),
      ]);
      const openContractCall = getOpenContractCall(connectModule as ConnectModule);

      openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        network: NETWORK,
        userSession,
        functionName: "withdraw",
        functionArgs: [uintCV(streamId)],
        postConditions: [],
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data: { txId: string }) => onSuccess(data.txId),
        onCancel,
      });
    },
    []
  );
}

// --- top-up-stream ---
export function useTopUpStream() {
  const { address } = useWallet();

  return useCallback(
    async (
      streamId: number,
      token: TokenKey,
      amount: bigint,
      onSuccess: (txId: string) => void,
      onCancel?: () => void
    ) => {
      const [connectModule, userSession] = await Promise.all([
        import("@stacks/connect"),
        getUserSession(),
      ]);
      const openContractCall = getOpenContractCall(connectModule as ConnectModule);

      if (!address) {
        throw new Error("Wallet not connected");
      }
      const senderAddress = address;
      const postConditions = senderSpendPostCondition(senderAddress, token, amount);

      openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        network: NETWORK,
        userSession,
        functionName: "top-up-stream",
        functionArgs: [uintCV(streamId), uintCV(amount)],
        postConditions,
        postConditionMode: PostConditionMode.Deny,
        onFinish: (data: { txId: string }) => onSuccess(data.txId),
        onCancel,
      });
    },
    [address]
  );
}

// --- cancel-stream ---
export function useCancelStream() {
  return useCallback(
    async (
      streamId: number,
      onSuccess: (txId: string) => void,
      onCancel?: () => void
    ) => {
      const [connectModule, userSession] = await Promise.all([
        import("@stacks/connect"),
        getUserSession(),
      ]);
      const openContractCall = getOpenContractCall(connectModule as ConnectModule);

      openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        network: NETWORK,
        userSession,
        functionName: "cancel-stream",
        functionArgs: [uintCV(streamId)],
        postConditions: [],
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data: { txId: string }) => onSuccess(data.txId),
        onCancel,
      });
    },
    []
  );
}
