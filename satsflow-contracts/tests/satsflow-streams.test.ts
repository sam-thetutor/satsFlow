import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const sender = accounts.get("wallet_1")!;
const recipient = accounts.get("wallet_2")!;

const SBTC_TOKEN = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";
const INVALID_TOKEN = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-registry";

describe("satsflow-streams", () => {
    it("creates a stream and returns stream id", () => {
        const create = simnet.callPublicFn(
            "satsflow-streams",
            "create-stream",
            [
                Cl.principal(recipient),
                Cl.principal(SBTC_TOKEN),
                Cl.uint(10),
                Cl.uint(1000),
            ],
            sender
        );

        expect(create.result).toBeOk(Cl.uint(1));
    });

    it("rejects invalid token", () => {
        const create = simnet.callPublicFn(
            "satsflow-streams",
            "create-stream",
            [
                Cl.principal(recipient),
                Cl.principal(INVALID_TOKEN),
                Cl.uint(10),
                Cl.uint(1000),
            ],
            sender
        );

        expect(create.result).toBeErr(Cl.uint(100));
    });

    it("returns increasing claimable amount over time", () => {
        const create = simnet.callPublicFn(
            "satsflow-streams",
            "create-stream",
            [
                Cl.principal(recipient),
                Cl.principal(SBTC_TOKEN),
                Cl.uint(5),
                Cl.uint(10000),
            ],
            sender
        );

        expect(create.result).toBeOk(Cl.uint(1));

        const immediate = simnet.callReadOnlyFn(
            "satsflow-streams",
            "get-claimable",
            [Cl.uint(1), Cl.principal(recipient)],
            recipient
        );

        expect(immediate.result).toBeOk(Cl.uint(0));

        simnet.mineEmptyBlocks(3);

        const later = simnet.callReadOnlyFn(
            "satsflow-streams",
            "get-claimable",
            [Cl.uint(1), Cl.principal(recipient)],
            recipient
        );

        expect(later.result).toBeOk(Cl.uint(15));
    });
});
