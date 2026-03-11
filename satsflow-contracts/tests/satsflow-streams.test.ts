import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const sender = accounts.get("wallet_1")!;
const sender2 = accounts.get("wallet_3")!;
const recipientA = accounts.get("wallet_2")!;
const recipientB = accounts.get("wallet_4")!;
const recipientC = accounts.get("wallet_5")!;

const CONTRACT = "satsflow-streams-v5";
const STX_TOKEN = "SP000000000000000000002Q6VF78";
const INVALID_TOKEN = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-registry";

function recipientEntry(recipient: string, ratePerSecond: number) {
    return Cl.tuple({
        recipient: Cl.principal(recipient),
        rate_per_second: Cl.uint(ratePerSecond),
    });
}

describe(CONTRACT, () => {
    it("creates a dynamic multi-recipient stream and indexes each participant", () => {
        const create = simnet.callPublicFn(
            CONTRACT,
            "create-stream",
            [
                Cl.list([
                    recipientEntry(recipientA, 3),
                    recipientEntry(recipientB, 7),
                ]),
                Cl.principal(STX_TOKEN),
                Cl.uint(1000),
                Cl.stringAscii("Payroll"),
                Cl.stringAscii("Custom split stream"),
            ],
            sender
        );

        expect(create.result).toBeOk(Cl.uint(1));

        const senderStreams = simnet.callReadOnlyFn(
            CONTRACT,
            "get-sender-streams",
            [Cl.principal(sender)],
            sender
        );
        const recipientStreams = simnet.callReadOnlyFn(
            CONTRACT,
            "get-recipient-streams",
            [Cl.principal(recipientB)],
            recipientB
        );
        const recipients = simnet.callReadOnlyFn(
            CONTRACT,
            "get-stream-recipients",
            [Cl.uint(1)],
            sender
        );

        expect(senderStreams.result).toBeOk(Cl.list([Cl.uint(1)]));
        expect(recipientStreams.result).toBeOk(Cl.list([Cl.uint(1)]));
        expect(recipients.result).toBeOk(Cl.list([Cl.principal(recipientA), Cl.principal(recipientB)]));
    });

    it("exposes per-recipient rate and allocation state", () => {
        const create = simnet.callPublicFn(
            CONTRACT,
            "create-stream",
            [
                Cl.list([
                    recipientEntry(recipientA, 2),
                    recipientEntry(recipientB, 8),
                ]),
                Cl.principal(STX_TOKEN),
                Cl.uint(1000),
                Cl.stringAscii("Ops"),
                Cl.stringAscii("State lookup"),
            ],
            sender
        );

        expect(create.result).toBeOk(Cl.uint(1));

        const recipientState = simnet.callReadOnlyFn(
            CONTRACT,
            "get-stream-recipient",
            [Cl.uint(1), Cl.principal(recipientB)],
            recipientB
        );

        expect(recipientState.result).toBeOk(
            Cl.some(
                Cl.tuple({
                    rate_per_second: Cl.uint(8),
                    allocation: Cl.uint(800),
                    last_withdraw_timestamp: Cl.uint(3),
                    total_withdrawn: Cl.uint(0),
                })
            )
        );
    });

    it("rejects invalid token", () => {
        const create = simnet.callPublicFn(
            CONTRACT,
            "create-stream",
            [
                Cl.list([recipientEntry(recipientA, 5)]),
                Cl.principal(INVALID_TOKEN),
                Cl.uint(500),
                Cl.stringAscii("Bad"),
                Cl.stringAscii("Bad token"),
            ],
            sender
        );

        expect(create.result).toBeErr(Cl.uint(100));
    });

    it("rejects empty recipient lists", () => {
        const create = simnet.callPublicFn(
            CONTRACT,
            "create-stream",
            [
                Cl.list([]),
                Cl.principal(STX_TOKEN),
                Cl.uint(500),
                Cl.stringAscii("Empty"),
                Cl.stringAscii("Should fail"),
            ],
            sender
        );

        expect(create.result).toBeErr(Cl.uint(106));
    });

    it("rejects duplicate recipients and zero rates", () => {
        const duplicate = simnet.callPublicFn(
            CONTRACT,
            "create-stream",
            [
                Cl.list([
                    recipientEntry(recipientA, 3),
                    recipientEntry(recipientA, 4),
                ]),
                Cl.principal(STX_TOKEN),
                Cl.uint(700),
                Cl.stringAscii("Dup"),
                Cl.stringAscii("Should fail"),
            ],
            sender
        );

        const zeroRate = simnet.callPublicFn(
            CONTRACT,
            "create-stream",
            [
                Cl.list([
                    recipientEntry(recipientA, 0),
                    recipientEntry(recipientB, 5),
                ]),
                Cl.principal(STX_TOKEN),
                Cl.uint(500),
                Cl.stringAscii("Zero"),
                Cl.stringAscii("Should fail"),
            ],
            sender
        );

        expect(duplicate.result).toBeErr(Cl.uint(106));
        expect(zeroRate.result).toBeErr(Cl.uint(106));
    });

    it("rejects deposits and top-ups that do not produce a whole-number duration", () => {
        const create = simnet.callPublicFn(
            CONTRACT,
            "create-stream",
            [
                Cl.list([
                    recipientEntry(recipientA, 3),
                    recipientEntry(recipientB, 7),
                ]),
                Cl.principal(STX_TOKEN),
                Cl.uint(999),
                Cl.stringAscii("Duration"),
                Cl.stringAscii("Invalid deposit"),
            ],
            sender
        );

        expect(create.result).toBeErr(Cl.uint(108));

        const validCreate = simnet.callPublicFn(
            CONTRACT,
            "create-stream",
            [
                Cl.list([
                    recipientEntry(recipientA, 3),
                    recipientEntry(recipientB, 7),
                ]),
                Cl.principal(STX_TOKEN),
                Cl.uint(1000),
                Cl.stringAscii("Duration"),
                Cl.stringAscii("Valid deposit"),
            ],
            sender
        );

        expect(validCreate.result).toBeOk(Cl.uint(1));

        const invalidTopUp = simnet.callPublicFn(
            CONTRACT,
            "top-up-stream",
            [Cl.uint(1), Cl.uint(1)],
            sender
        );

        expect(invalidTopUp.result).toBeErr(Cl.uint(108));
    });

    it("accrues claimable amounts based on each recipient's own rate", () => {
        const create = simnet.callPublicFn(
            CONTRACT,
            "create-stream",
            [
                Cl.list([
                    recipientEntry(recipientA, 3),
                    recipientEntry(recipientB, 7),
                ]),
                Cl.principal(STX_TOKEN),
                Cl.uint(1000),
                Cl.stringAscii("Rates"),
                Cl.stringAscii("Custom accrual"),
            ],
            sender
        );

        expect(create.result).toBeOk(Cl.uint(1));

        simnet.mineEmptyBlocks(3);

        const claimableA = simnet.callReadOnlyFn(
            CONTRACT,
            "get-claimable",
            [Cl.uint(1), Cl.principal(recipientA)],
            recipientA
        );
        const claimableB = simnet.callReadOnlyFn(
            CONTRACT,
            "get-claimable",
            [Cl.uint(1), Cl.principal(recipientB)],
            recipientB
        );

        expect(claimableA.result).toBeOk(Cl.uint(9));
        expect(claimableB.result).toBeOk(Cl.uint(21));
    });

    it("lets recipients withdraw independently based on their configured rates", () => {
        const create = simnet.callPublicFn(
            CONTRACT,
            "create-stream",
            [
                Cl.list([
                    recipientEntry(recipientA, 3),
                    recipientEntry(recipientB, 7),
                ]),
                Cl.principal(STX_TOKEN),
                Cl.uint(1000),
                Cl.stringAscii("Rates"),
                Cl.stringAscii("Independent withdraws"),
            ],
            sender
        );

        expect(create.result).toBeOk(Cl.uint(1));

        simnet.mineEmptyBlocks(2);

        const withdrawA = simnet.callPublicFn(
            CONTRACT,
            "withdraw",
            [Cl.uint(1)],
            recipientA
        );

        expect(withdrawA.result).toBeOk(Cl.uint(6));

        simnet.mineEmptyBlocks(2);

        const withdrawB = simnet.callPublicFn(
            CONTRACT,
            "withdraw",
            [Cl.uint(1)],
            recipientB
        );

        expect(withdrawB.result).toBeOk(Cl.uint(28));
    });

    it("extends the stream duration on top-up and increases recipient allocations proportionally", () => {
        const create = simnet.callPublicFn(
            CONTRACT,
            "create-stream",
            [
                Cl.list([
                    recipientEntry(recipientA, 2),
                    recipientEntry(recipientB, 8),
                ]),
                Cl.principal(STX_TOKEN),
                Cl.uint(1000),
                Cl.stringAscii("Topup"),
                Cl.stringAscii("Extend duration"),
            ],
            sender
        );

        expect(create.result).toBeOk(Cl.uint(1));

        const topUp = simnet.callPublicFn(
            CONTRACT,
            "top-up-stream",
            [Cl.uint(1), Cl.uint(500)],
            sender
        );

        expect(topUp.result).toBeOk(Cl.uint(1500));

        const recipientState = simnet.callReadOnlyFn(
            CONTRACT,
            "get-stream-recipient",
            [Cl.uint(1), Cl.principal(recipientA)],
            recipientA
        );

        expect(recipientState.result).toBeOk(
            Cl.some(
                Cl.tuple({
                    rate_per_second: Cl.uint(2),
                    allocation: Cl.uint(300),
                    last_withdraw_timestamp: Cl.uint(3),
                    total_withdrawn: Cl.uint(0),
                })
            )
        );
    });

    it("cancels a stream and refunds only the unaccrued remainder", () => {
        const create = simnet.callPublicFn(
            CONTRACT,
            "create-stream",
            [
                Cl.list([
                    recipientEntry(recipientA, 3),
                    recipientEntry(recipientB, 7),
                ]),
                Cl.principal(STX_TOKEN),
                Cl.uint(1000),
                Cl.stringAscii("Cancel"),
                Cl.stringAscii("Refund remainder"),
            ],
            sender
        );

        expect(create.result).toBeOk(Cl.uint(1));

        simnet.mineEmptyBlocks(3);

        const cancel = simnet.callPublicFn(
            CONTRACT,
            "cancel-stream",
            [Cl.uint(1)],
            sender
        );

        expect(cancel.result).toBeOk(Cl.uint(970));

        const claimableAfterCancel = simnet.callReadOnlyFn(
            CONTRACT,
            "get-claimable",
            [Cl.uint(1), Cl.principal(recipientA)],
            recipientA
        );

        expect(claimableAfterCancel.result).toBeOk(Cl.uint(0));
    });

    it("keeps sender indexing separate across different senders", () => {
        const create1 = simnet.callPublicFn(
            CONTRACT,
            "create-stream",
            [
                Cl.list([
                    recipientEntry(recipientA, 4),
                    recipientEntry(recipientB, 6),
                ]),
                Cl.principal(STX_TOKEN),
                Cl.uint(1000),
                Cl.stringAscii("Team A"),
                Cl.stringAscii("Sender one"),
            ],
            sender
        );

        const create2 = simnet.callPublicFn(
            CONTRACT,
            "create-stream",
            [
                Cl.list([
                    recipientEntry(recipientA, 1),
                    recipientEntry(recipientC, 9),
                ]),
                Cl.principal(STX_TOKEN),
                Cl.uint(1000),
                Cl.stringAscii("Team B"),
                Cl.stringAscii("Sender two"),
            ],
            sender2
        );

        expect(create1.result).toBeOk(Cl.uint(1));
        expect(create2.result).toBeOk(Cl.uint(2));

        const sender1Streams = simnet.callReadOnlyFn(
            CONTRACT,
            "get-sender-streams",
            [Cl.principal(sender)],
            sender
        );
        const sender2Streams = simnet.callReadOnlyFn(
            CONTRACT,
            "get-sender-streams",
            [Cl.principal(sender2)],
            sender2
        );

        expect(sender1Streams.result).toBeOk(Cl.list([Cl.uint(1)]));
        expect(sender2Streams.result).toBeOk(Cl.list([Cl.uint(2)]));
    });
});
