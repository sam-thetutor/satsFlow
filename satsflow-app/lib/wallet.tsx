"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { UserSession } from "@stacks/connect";

let sessionPromise: Promise<UserSession> | null = null;

const isMainnet = process.env.NEXT_PUBLIC_STACKS_NETWORK === "mainnet";
const WALLET_ADDRESS_STORAGE_KEY = "satsflow.connectedAddress";

type ConnectModule = Record<string, unknown> & {
  default?: Record<string, unknown> & { default?: Record<string, unknown> };
};

function resolveConnectExport<T>(mod: ConnectModule, key: string): T | undefined {
  return (
    (mod[key] as T | undefined) ??
    (mod.default?.[key] as T | undefined) ??
    (mod.default?.default?.[key] as T | undefined)
  );
}

export async function getUserSession(): Promise<UserSession> {
  if (!sessionPromise) {
    sessionPromise = import("@stacks/connect").then((connectModule) => {
      const AppConfig = resolveConnectExport<new (scopes: string[]) => unknown>(
        connectModule as ConnectModule,
        "AppConfig"
      );
      const UserSessionCtor = resolveConnectExport<
        new (args: { appConfig: unknown }) => UserSession
      >(connectModule as ConnectModule, "UserSession");

      if (!AppConfig || !UserSessionCtor) {
        throw new Error("Stacks Connect unavailable: AppConfig/UserSession export not found");
      }

      const appConfig = new AppConfig(["store_write", "publish_data"]);
      return new UserSessionCtor({ appConfig });
    });
  }

  return sessionPromise;
}

export function getSessionAddress(session: UserSession): string {
  const data = session.loadUserData();
  return isMainnet ? data.profile.stxAddress.mainnet : data.profile.stxAddress.testnet;
}

interface WalletState {
  connected: boolean;
  address: string | null;
  connect: () => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState>({
  connected: false,
  address: null,
  connect: () => {},
  disconnect: () => {},
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const persistedAddress = window.localStorage.getItem(WALLET_ADDRESS_STORAGE_KEY);

      if (persistedAddress) {
        setAddress(persistedAddress);
        setConnected(true);
        return;
      }

      const userSession = await getUserSession();
      if (userSession.isUserSignedIn()) {
        const sessionAddress = getSessionAddress(userSession);
        window.localStorage.setItem(WALLET_ADDRESS_STORAGE_KEY, sessionAddress);
        setAddress(sessionAddress);
        setConnected(true);
      }
    })();
  }, []);

  const connect = useCallback(() => {
    void (async () => {
      const [connectModule, userSession] = await Promise.all([
        import("@stacks/connect"),
        getUserSession(),
      ]);

      const connectFn = resolveConnectExport<
        (args?: { network?: "mainnet" | "testnet" | "devnet" | "regtest" }) => Promise<{
          addresses: { address: string; symbol?: string }[];
        }>
      >(connectModule as ConnectModule, "connect");

      if (typeof connectFn === "function") {
        const result = await connectFn({ network: isMainnet ? "mainnet" : "testnet" });
        const selectedAddress =
          result.addresses.find((a) => (isMainnet ? a.symbol === "STX" : a.symbol === "STX"))
            ?.address ?? result.addresses[0]?.address;

        if (selectedAddress) {
          window.localStorage.setItem(WALLET_ADDRESS_STORAGE_KEY, selectedAddress);
          setAddress(selectedAddress);
          setConnected(true);
          return;
        }
      }

      const showConnectFn =
        resolveConnectExport<((args: unknown) => Promise<void> | void)>(
          connectModule as ConnectModule,
          "showConnect"
        ) ??
        resolveConnectExport<((args: unknown) => Promise<void> | void)>(
          connectModule as ConnectModule,
          "showBlockstackConnect"
        );

      if (typeof showConnectFn !== "function") {
        throw new Error("Stacks Connect unavailable: no connect/showConnect export found");
      }

      showConnectFn({
        appDetails: { name: "SatsFlow", icon: "/favicon.ico" },
        redirectTo: "/",
        onFinish: () => {
          const sessionAddress = getSessionAddress(userSession);
          window.localStorage.setItem(WALLET_ADDRESS_STORAGE_KEY, sessionAddress);
          setAddress(sessionAddress);
          setConnected(true);
        },
        userSession,
      });
    })();
  }, []);

  const disconnect = useCallback(() => {
    void (async () => {
      window.localStorage.removeItem(WALLET_ADDRESS_STORAGE_KEY);

      const [connectModule, userSession] = await Promise.all([
        import("@stacks/connect"),
        getUserSession(),
      ]);

      const disconnectFn = resolveConnectExport<() => void>(
        connectModule as ConnectModule,
        "disconnect"
      );

      if (typeof disconnectFn === "function") {
        disconnectFn();
      } else {
        userSession.signUserOut();
      }

      setAddress(null);
      setConnected(false);
    })();
  }, []);

  return (
    <WalletContext.Provider value={{ connected, address, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
