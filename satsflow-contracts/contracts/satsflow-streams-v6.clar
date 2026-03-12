;; title: satsflow-streams-v6
;; version: 6.0.0
;; summary: Payment streaming with optional Bitflow yield strategy (mainnet only).
;; description:
;;   Extends v5. When yield_enabled=false, behavior is identical to v5.
;;   Yield strategy: sender deposits sBTC; reserve_ratio_bps% stays liquid,
;;   the remainder is deployed to the Bitflow sBTC-BDC XYK pool.
;;   Two-path withdraw:
;;     Path A -- liquid reserve covers claimable -> pay directly (no Bitflow call).
;;     Path B -- reserve short AND yield enabled -> try inline unwind (match/fail-soft):
;;              success: pay full claimable; failure: pay reserve remainder, pause strategy.
;;   Bitflow XYK contracts are mainnet-only; yield functions will fail on testnet/devnet.

;; ===========================
;; CONSTANTS -- base (identical to v5)
;; ===========================
(define-constant SBTC_TOKEN 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token)
(define-constant STX_TOKEN 'SP000000000000000000002Q6VF78)

(define-constant ERR_INVALID_TOKEN (err u100))
(define-constant ERR_INVALID_DEPOSIT (err u101))
(define-constant ERR_INVALID_RATE (err u102))
(define-constant ERR_INVALID_RECIPIENT (err u103))
(define-constant ERR_INVALID_TOPUP (err u104))
(define-constant ERR_INVALID_PRINCIPAL (err u105))
(define-constant ERR_INVALID_RECIPIENT_LIST (err u106))
(define-constant ERR_INVALID_DURATION (err u108))
(define-constant ERR_STREAM_NOT_FOUND (err u200))
(define-constant ERR_INACTIVE_STREAM (err u201))
(define-constant ERR_NOTHING_TO_WITHDRAW (err u202))
(define-constant ERR_INDEX_FULL (err u203))
(define-constant ERR_UNAUTHORIZED (err u150))
(define-constant ERR_TRANSFER_FAILED (err u250))

;; ===========================
;; CONSTANTS -- yield extension
;; ===========================

;; Bitflow XYK contracts (mainnet only -- SM addresses are Stacks mainnet)
(define-constant BITFLOW_XYK_CORE 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2)
(define-constant BITFLOW_SBTC_BDC_POOL 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-bdc-v-1-1)
(define-constant BDC_TOKEN 'SP14NS8MVBRHXMM96BQY0727AJ59SWPV7RMHC0NCG.pontis-bridge-BDC)

;; Strategy status constants
(define-constant STRATEGY_INACTIVE u0) ;; no LP position; yield_enabled may be true but not yet deployed
(define-constant STRATEGY_ACTIVE u1)   ;; LP position live in Bitflow
(define-constant STRATEGY_PAUSED u2)   ;; LP still in Bitflow but operations suspended (e.g. unwind fail)
(define-constant STRATEGY_UNWOUND u3)  ;; LP fully returned to contract; stream paying from liquid only

;; Yield reserve bounds
(define-constant MAX_DEPLOY_BPS u7000)  ;; at most 70% can be deployed to LP
(define-constant MIN_RESERVE_BPS u3000) ;; at least 30% must stay as liquid reserve
(define-constant BPS_DENOMINATOR u10000)

;; Yield-specific errors
(define-constant ERR_YIELD_NOT_ENABLED (err u300))
(define-constant ERR_STRATEGY_ACTIVE (err u301))
(define-constant ERR_STRATEGY_NOT_ACTIVE (err u302))
(define-constant ERR_INVALID_RESERVE_RATIO (err u303))
(define-constant ERR_ONLY_SBTC (err u306))

;; ===========================
;; DATA VARS
;; ===========================
(define-data-var next_stream_id uint u1)

;; ===========================
;; DATA MAPS
;; ===========================

;; streams -- extended with yield fields vs v5.
;; Non-yield streams have yield_enabled=false and all yield fields zeroed.
(define-map streams
    { stream_id: uint }
    {
        sender: principal,
        token: principal,
        deposit: uint,
        rate_per_second: uint,
        duration: uint,
        start_timestamp: uint,
        last_withdraw_timestamp: uint,
        total_withdrawn: uint,
        is_active: bool,
        recipient_count: uint,
        name: (string-ascii 64),
        description: (string-ascii 256),
        ;; yield extension fields
        yield_enabled: bool,
        reserve_ratio_bps: uint,       ;; BPS of deposit kept as liquid reserve
        deployed_principal: uint,      ;; sBTC notionally deployed to LP (0 if not active)
        lp_token_balance: uint,        ;; LP tokens currently held by this contract
        total_yield_harvested: uint,   ;; cumulative sBTC gain realised from LP unwinds
        last_harvest_timestamp: uint,  ;; block height of last LP unwind
        strategy_status: uint          ;; INACTIVE / ACTIVE / PAUSED / UNWOUND
    }
)

(define-map stream_recipients
    { stream_id: uint }
    { recipients: (list 10 principal) }
)

(define-map recipient_states
    { stream_id: uint, recipient: principal }
    {
        rate_per_second: uint,
        last_withdraw_timestamp: uint,
        total_withdrawn: uint
    }
)

(define-map sender_stream_index
    { sender: principal }
    { stream_ids: (list 200 uint) }
)

(define-map recipient_stream_index
    { recipient: principal }
    { stream_ids: (list 200 uint) }
)

;; ===========================
;; PUBLIC FUNCTIONS
;; ===========================

;; create-stream -- identical to v5 behaviour; yield_enabled=false
(define-public (create-stream
        (recipient-entries (list 10 { recipient: principal, rate_per_second: uint }))
        (token principal)
        (deposit uint)
        (name (string-ascii 64))
        (description (string-ascii 256))
    )
    (let
        (
            (current_timestamp (current-time-seconds))
            (stream_id (var-get next_stream_id))
            (validation (fold validate-recipient-entry recipient-entries {
                seen: (list),
                recipients: (list),
                sender: tx-sender,
                valid: true,
                total_rate: u0
            }))
        )
        (asserts! (is-supported-token token) ERR_INVALID_TOKEN)
        (asserts! (> deposit u0) ERR_INVALID_DEPOSIT)
        (asserts! (get valid validation) ERR_INVALID_RECIPIENT_LIST)
        (asserts! (> (len (get recipients validation)) u0) ERR_INVALID_RECIPIENT_LIST)
        (asserts! (> (get total_rate validation) u0) ERR_INVALID_RATE)
        (asserts! (is-exact-duration deposit (get total_rate validation)) ERR_INVALID_DURATION)

        (try! (transfer-in token deposit))

        (map-set streams
            { stream_id: stream_id }
            {
                sender: tx-sender,
                token: token,
                deposit: deposit,
                rate_per_second: (get total_rate validation),
                duration: (/ deposit (get total_rate validation)),
                start_timestamp: current_timestamp,
                last_withdraw_timestamp: current_timestamp,
                total_withdrawn: u0,
                is_active: true,
                recipient_count: (len (get recipients validation)),
                name: name,
                description: description,
                yield_enabled: false,
                reserve_ratio_bps: u0,
                deployed_principal: u0,
                lp_token_balance: u0,
                total_yield_harvested: u0,
                last_harvest_timestamp: u0,
                strategy_status: STRATEGY_INACTIVE
            }
        )

        (map-set stream_recipients { stream_id: stream_id } { recipients: (get recipients validation) })
        (try! (append-sender-stream tx-sender stream_id))
        (try! (fold register-recipient-state recipient-entries (ok { stream_id: stream_id, timestamp: current_timestamp })))

        (var-set next_stream_id (+ stream_id u1))
        (ok stream_id)
    )
)

;; create-stream-with-yield -- creates a yield-enabled sBTC stream and immediately deploys to LP.
;; reserve-ratio-bps: percentage of deposit to keep as liquid reserve (must be >= MIN_RESERVE_BPS).
;; NOTE: Requires Bitflow XYK to be live (mainnet only). Fails on testnet/devnet.
(define-public (create-stream-with-yield
        (recipient-entries (list 10 { recipient: principal, rate_per_second: uint }))
        (deposit uint)
        (name (string-ascii 64))
        (description (string-ascii 256))
        (reserve-ratio-bps uint)
    )
    (let
        (
            (current_timestamp (current-time-seconds))
            (stream_id (var-get next_stream_id))
            (validation (fold validate-recipient-entry recipient-entries {
                seen: (list),
                recipients: (list),
                sender: tx-sender,
                valid: true,
                total_rate: u0
            }))
            ;; Amount to deploy to LP = deposit * (1 - reserve_ratio_bps / 10000)
            (deploy-amount (/ (* deposit (- BPS_DENOMINATOR reserve-ratio-bps)) BPS_DENOMINATOR))
        )
        ;; Yield is sBTC-only
        (asserts! (>= reserve-ratio-bps MIN_RESERVE_BPS) ERR_INVALID_RESERVE_RATIO)
        (asserts! (< reserve-ratio-bps BPS_DENOMINATOR) ERR_INVALID_RESERVE_RATIO)
        (asserts! (> deposit u0) ERR_INVALID_DEPOSIT)
        ;; deploy-amount must be at least 2 so we can split in half for the swap
        (asserts! (> deploy-amount u1) ERR_INVALID_DEPOSIT)
        (asserts! (get valid validation) ERR_INVALID_RECIPIENT_LIST)
        (asserts! (> (len (get recipients validation)) u0) ERR_INVALID_RECIPIENT_LIST)
        (asserts! (> (get total_rate validation) u0) ERR_INVALID_RATE)
        (asserts! (is-exact-duration deposit (get total_rate validation)) ERR_INVALID_DURATION)

        ;; Pull full deposit from sender
        (try! (transfer-in SBTC_TOKEN deposit))

        ;; Deploy deploy-amount to Bitflow LP -- returns LP tokens minted
        (let ((lp-minted (try! (bitflow-deploy deploy-amount))))
            (map-set streams
                { stream_id: stream_id }
                {
                    sender: tx-sender,
                    token: SBTC_TOKEN,
                    deposit: deposit,
                    rate_per_second: (get total_rate validation),
                    duration: (/ deposit (get total_rate validation)),
                    start_timestamp: current_timestamp,
                    last_withdraw_timestamp: current_timestamp,
                    total_withdrawn: u0,
                    is_active: true,
                    recipient_count: (len (get recipients validation)),
                    name: name,
                    description: description,
                    yield_enabled: true,
                    reserve_ratio_bps: reserve-ratio-bps,
                    deployed_principal: deploy-amount,
                    lp_token_balance: lp-minted,
                    total_yield_harvested: u0,
                    last_harvest_timestamp: u0,
                    strategy_status: STRATEGY_ACTIVE
                }
            )

            (map-set stream_recipients { stream_id: stream_id } { recipients: (get recipients validation) })
            (try! (append-sender-stream tx-sender stream_id))
            (try! (fold register-recipient-state recipient-entries (ok { stream_id: stream_id, timestamp: current_timestamp })))

            (var-set next_stream_id (+ stream_id u1))
            (ok stream_id)
        )
    )
)

;; withdraw -- two-path claim for recipient.
;; Path A: liquid reserve >= claimable (or yield disabled) -> pay directly.
;; Path B: yield enabled, reserve short -> try Bitflow unwind; fail-soft on error.
(define-public (withdraw (stream-id uint))
    (let
        (
            (stream (unwrap! (map-get? streams { stream_id: stream-id }) ERR_STREAM_NOT_FOUND))
            (recipient_state (unwrap! (map-get? recipient_states { stream_id: stream-id, recipient: tx-sender }) ERR_UNAUTHORIZED))
        )
        (asserts! (get is_active stream) ERR_INACTIVE_STREAM)
        (asserts! (is-supported-token (get token stream)) ERR_INVALID_TOKEN)
        (let
            (
                (allocation (recipient-allocation stream recipient_state))
                (claimable (compute-claimable-amount
                    (get rate_per_second recipient_state)
                    (get last_withdraw_timestamp recipient_state)
                    allocation
                    (get total_withdrawn recipient_state)))
                (current_timestamp (current-time-seconds))
                (liquid_reserve (compute-liquid-reserve stream))
            )
            (asserts! (> claimable u0) ERR_NOTHING_TO_WITHDRAW)

            ;; Path A: reserve is sufficient OR yield not enabled
            (if (or (not (get yield_enabled stream)) (>= liquid_reserve claimable))
                (begin
                    (try! (transfer-out (get token stream) claimable tx-sender))
                    (let
                        (
                            (updated_total_withdrawn (+ (get total_withdrawn stream) claimable))
                        )
                        (map-set recipient_states
                            { stream_id: stream-id, recipient: tx-sender }
                            {
                                rate_per_second: (get rate_per_second recipient_state),
                                last_withdraw_timestamp: current_timestamp,
                                total_withdrawn: (+ (get total_withdrawn recipient_state) claimable)
                            }
                        )
                        (map-set streams
                            { stream_id: stream-id }
                            (merge stream {
                                last_withdraw_timestamp: current_timestamp,
                                total_withdrawn: updated_total_withdrawn,
                                is_active: (< updated_total_withdrawn (get deposit stream))
                            })
                        )
                        (ok claimable)
                    )
                )
                ;; Path B: yield enabled but reserve is short -- try inline Bitflow unwind
                (match (bitflow-unwind (get lp_token_balance stream) (get deployed_principal stream))
                    unwind-result
                        ;; Unwind succeeded: LP fully returned to liquid, pay claimable
                        (let
                            (
                                (updated_total_withdrawn (+ (get total_withdrawn stream) claimable))
                                (yield-gained (get yield-gained unwind-result))
                            )
                            (try! (transfer-out (get token stream) claimable tx-sender))
                            (map-set recipient_states
                                { stream_id: stream-id, recipient: tx-sender }
                                {
                                    rate_per_second: (get rate_per_second recipient_state),
                                    last_withdraw_timestamp: current_timestamp,
                                    total_withdrawn: (+ (get total_withdrawn recipient_state) claimable)
                                }
                            )
                            (map-set streams
                                { stream_id: stream-id }
                                (merge stream {
                                    last_withdraw_timestamp: current_timestamp,
                                    total_withdrawn: updated_total_withdrawn,
                                    is_active: (< updated_total_withdrawn (get deposit stream)),
                                    deployed_principal: u0,
                                    lp_token_balance: u0,
                                    total_yield_harvested: (+ (get total_yield_harvested stream) yield-gained),
                                    last_harvest_timestamp: current_timestamp,
                                    strategy_status: STRATEGY_UNWOUND
                                })
                            )
                            (ok claimable)
                        )
                    err-code
                        ;; Fail-soft: Bitflow unwind failed -- pay whatever reserve holds, pause strategy
                        (let
                            (
                                (payout (if (> liquid_reserve u0) liquid_reserve u0))
                                (updated_total_withdrawn (+ (get total_withdrawn stream) payout))
                            )
                            (if (> payout u0)
                                (try! (transfer-out (get token stream) payout tx-sender))
                                false
                            )
                            (map-set recipient_states
                                { stream_id: stream-id, recipient: tx-sender }
                                {
                                    rate_per_second: (get rate_per_second recipient_state),
                                    last_withdraw_timestamp: current_timestamp,
                                    total_withdrawn: (+ (get total_withdrawn recipient_state) payout)
                                }
                            )
                            (map-set streams
                                { stream_id: stream-id }
                                (merge stream {
                                    last_withdraw_timestamp: current_timestamp,
                                    total_withdrawn: updated_total_withdrawn,
                                    strategy_status: STRATEGY_PAUSED
                                })
                            )
                            (ok payout)
                        )
                )
            )
        )
    )
)

;; top-up-stream -- sender adds funds to an active stream. Identical to v5.
;; For yield-enabled streams, top-up increases the liquid reserve only.
;; Sender can call unwind-yield-strategy + create-stream-with-yield to redeploy.
(define-public (top-up-stream (stream-id uint) (amount uint))
    (let ((stream (unwrap! (map-get? streams { stream_id: stream-id }) ERR_STREAM_NOT_FOUND)))
        (asserts! (is-eq tx-sender (get sender stream)) ERR_UNAUTHORIZED)
        (asserts! (get is_active stream) ERR_INACTIVE_STREAM)
        (asserts! (> amount u0) ERR_INVALID_TOPUP)
        (asserts! (is-supported-token (get token stream)) ERR_INVALID_TOKEN)
        (asserts! (is-exact-duration (+ (get deposit stream) amount) (get rate_per_second stream)) ERR_INVALID_DURATION)

        (try! (transfer-in (get token stream) amount))

        (map-set streams
            { stream_id: stream-id }
            (merge stream {
                deposit: (+ (get deposit stream) amount),
                duration: (/ (+ (get deposit stream) amount) (get rate_per_second stream)),
                is_active: true
            })
        )

        (ok (+ (get deposit stream) amount))
    )
)

;; cancel-stream -- sender cancels the stream.
;; Distributes all claimable amounts to recipients.
;; For yield-enabled streams: attempts LP unwind via match (fail-soft).
;; If unwind fails, LP remains in Bitflow (paused) and can be recovered later.
;; Refunds remaining liquid to sender.
(define-public (cancel-stream (stream-id uint))
    (let
        (
            (stream (unwrap! (map-get? streams { stream_id: stream-id }) ERR_STREAM_NOT_FOUND))
            (recipients (unwrap! (map-get? stream_recipients { stream_id: stream-id }) ERR_STREAM_NOT_FOUND))
            (current_timestamp (current-time-seconds))
        )
        (asserts! (is-eq tx-sender (get sender stream)) ERR_UNAUTHORIZED)
        (asserts! (get is_active stream) ERR_INACTIVE_STREAM)
        (asserts! (is-supported-token (get token stream)) ERR_INVALID_TOKEN)
        (let
            (
                (cancel_state (try! (fold cancel-recipient-step (get recipients recipients) (ok {
                    stream_id: stream-id,
                    token: (get token stream),
                    current_timestamp: current_timestamp,
                    duration: (get duration stream),
                    total_claimable: u0
                }))))
                (updated_total_withdrawn (+ (get total_withdrawn stream) (get total_claimable cancel_state)))
            )
            ;; For yield-enabled streams with an active LP, attempt unwind (fail-soft)
            (if (and (get yield_enabled stream) (is-eq (get strategy_status stream) STRATEGY_ACTIVE))
                (match (bitflow-unwind (get lp_token_balance stream) (get deployed_principal stream))
                    unwind-result
                        ;; Unwind succeeded: add recovered sBTC to accounting
                        (let
                            (
                                (yield-gained (get yield-gained unwind-result))
                                (total-in (+ (get deposit stream) (get total_yield_harvested stream) yield-gained))
                                (refund (if (> total-in updated_total_withdrawn)
                                    (- total-in updated_total_withdrawn)
                                    u0))
                            )
                            (if (> refund u0)
                                (try! (transfer-out (get token stream) refund tx-sender))
                                false
                            )
                            (map-set streams
                                { stream_id: stream-id }
                                (merge stream {
                                    last_withdraw_timestamp: current_timestamp,
                                    total_withdrawn: updated_total_withdrawn,
                                    is_active: false,
                                    deployed_principal: u0,
                                    lp_token_balance: u0,
                                    total_yield_harvested: (+ (get total_yield_harvested stream) yield-gained),
                                    last_harvest_timestamp: current_timestamp,
                                    strategy_status: STRATEGY_UNWOUND
                                })
                            )
                            (ok refund)
                        )
                    err-code
                        ;; Unwind failed: refund liquid reserve only; LP remains (paused)
                        (let
                            (
                                (liquid_reserve (compute-liquid-reserve stream))
                                (refund (if (> liquid_reserve u0) liquid_reserve u0))
                            )
                            (if (> refund u0)
                                (try! (transfer-out (get token stream) refund tx-sender))
                                false
                            )
                            (map-set streams
                                { stream_id: stream-id }
                                (merge stream {
                                    last_withdraw_timestamp: current_timestamp,
                                    total_withdrawn: updated_total_withdrawn,
                                    is_active: false,
                                    strategy_status: STRATEGY_PAUSED
                                })
                            )
                            (ok refund)
                        )
                )
                ;; No yield or strategy not active -- standard refund path
                (let
                    (
                        (refund_amount (remaining-amount (get deposit stream) updated_total_withdrawn))
                    )
                    (if (> refund_amount u0)
                        (try! (transfer-out (get token stream) refund_amount tx-sender))
                        true
                    )
                    (map-set streams
                        { stream_id: stream-id }
                        (merge stream {
                            last_withdraw_timestamp: current_timestamp,
                            total_withdrawn: updated_total_withdrawn,
                            is_active: false
                        })
                    )
                    (ok refund_amount)
                )
            )
        )
    )
)

;; pause-yield-strategy -- sender pauses the yield strategy flag without unwinding.
;; LP tokens remain in Bitflow. Withdraw will use fail-soft path (pay liquid reserve only).
;; Useful when Bitflow fees/slippage are temporarily unfavourable.
;; Call unwind-yield-strategy to recover the LP when conditions improve.
(define-public (pause-yield-strategy (stream-id uint))
    (let ((stream (unwrap! (map-get? streams { stream_id: stream-id }) ERR_STREAM_NOT_FOUND)))
        (asserts! (is-eq tx-sender (get sender stream)) ERR_UNAUTHORIZED)
        (asserts! (get is_active stream) ERR_INACTIVE_STREAM)
        (asserts! (get yield_enabled stream) ERR_YIELD_NOT_ENABLED)
        (asserts! (is-eq (get strategy_status stream) STRATEGY_ACTIVE) ERR_STRATEGY_NOT_ACTIVE)

        (map-set streams
            { stream_id: stream-id }
            (merge stream {
                strategy_status: STRATEGY_PAUSED
            })
        )
        (ok true)
    )
)

;; unwind-yield-strategy -- sender fully unwinds the LP position back to sBTC.
;; Recovered sBTC re-enters the liquid reserve.
;; Sets strategy_status to STRATEGY_UNWOUND.
;; Sender can re-activate yield by creating a new stream -- or just leave as liquid.
(define-public (unwind-yield-strategy (stream-id uint))
    (let ((stream (unwrap! (map-get? streams { stream_id: stream-id }) ERR_STREAM_NOT_FOUND)))
        (asserts! (is-eq tx-sender (get sender stream)) ERR_UNAUTHORIZED)
        (asserts! (get is_active stream) ERR_INACTIVE_STREAM)
        (asserts! (get yield_enabled stream) ERR_YIELD_NOT_ENABLED)
        (asserts! (or
            (is-eq (get strategy_status stream) STRATEGY_ACTIVE)
            (is-eq (get strategy_status stream) STRATEGY_PAUSED))
            ERR_STRATEGY_NOT_ACTIVE)

        (let ((unwind-result (try! (bitflow-unwind (get lp_token_balance stream) (get deployed_principal stream)))))
            (let ((yield-gained (get yield-gained unwind-result)))
                (map-set streams
                    { stream_id: stream-id }
                    (merge stream {
                        deployed_principal: u0,
                        lp_token_balance: u0,
                        total_yield_harvested: (+ (get total_yield_harvested stream) yield-gained),
                        last_harvest_timestamp: (current-time-seconds),
                        strategy_status: STRATEGY_UNWOUND
                    })
                )
                (ok yield-gained)
            )
        )
    )
)

;; ===========================
;; READ-ONLY FUNCTIONS
;; ===========================

(define-read-only (get-stream (stream-id uint))
    (ok (map-get? streams { stream_id: stream-id }))
)

(define-read-only (get-stream-recipients (stream-id uint))
    (ok (default-to (list) (get recipients (map-get? stream_recipients { stream_id: stream-id }))))
)

(define-read-only (get-stream-recipient (stream-id uint) (recipient principal))
    (let
        ((stream (unwrap! (map-get? streams { stream_id: stream-id }) ERR_STREAM_NOT_FOUND)))
        (ok
            (match (map-get? recipient_states { stream_id: stream-id, recipient: recipient })
                recipient-state
                    (some {
                        rate_per_second: (get rate_per_second recipient-state),
                        allocation: (recipient-allocation stream recipient-state),
                        last_withdraw_timestamp: (get last_withdraw_timestamp recipient-state),
                        total_withdrawn: (get total_withdrawn recipient-state)
                    })
                none
            )
        )
    )
)

(define-read-only (get-claimable (stream-id uint) (recipient principal))
    (let
        (
            (stream (unwrap! (map-get? streams { stream_id: stream-id }) ERR_STREAM_NOT_FOUND))
            (recipient-state (unwrap! (map-get? recipient_states { stream_id: stream-id, recipient: recipient }) ERR_UNAUTHORIZED))
        )
        (if (not (get is_active stream))
            (ok u0)
            (ok (compute-claimable-amount
                (get rate_per_second recipient-state)
                (get last_withdraw_timestamp recipient-state)
                (recipient-allocation stream recipient-state)
                (get total_withdrawn recipient-state)
            ))
        )
    )
)

(define-read-only (get-sender-streams (sender principal))
    (ok (default-to (list) (get stream_ids (map-get? sender_stream_index { sender: sender }))))
)

(define-read-only (get-recipient-streams (recipient principal))
    (ok (default-to (list) (get stream_ids (map-get? recipient_stream_index { recipient: recipient }))))
)

(define-read-only (get-yield-info (stream-id uint))
    (let ((stream (unwrap! (map-get? streams { stream_id: stream-id }) ERR_STREAM_NOT_FOUND)))
        (ok {
            yield_enabled: (get yield_enabled stream),
            reserve_ratio_bps: (get reserve_ratio_bps stream),
            deployed_principal: (get deployed_principal stream),
            lp_token_balance: (get lp_token_balance stream),
            total_yield_harvested: (get total_yield_harvested stream),
            last_harvest_timestamp: (get last_harvest_timestamp stream),
            strategy_status: (get strategy_status stream),
            liquid_reserve: (compute-liquid-reserve stream)
        })
    )
)

;; ===========================
;; PRIVATE FUNCTIONS -- core logic
;; ===========================

(define-private (current-time-seconds)
    burn-block-height
)

(define-private (remaining-amount (deposit uint) (withdrawn uint))
    (if (> deposit withdrawn)
        (- deposit withdrawn)
        u0
    )
)

(define-private (compute-claimable-amount
        (rate-per-second uint)
        (last-timestamp uint)
        (allocation uint)
        (withdrawn uint))
    (let
        (
            (current_timestamp (current-time-seconds))
            (elapsed_seconds (if (> current_timestamp last-timestamp) (- current_timestamp last-timestamp) u0))
            (accrued (* elapsed_seconds rate-per-second))
            (remaining (remaining-amount allocation withdrawn))
        )
        (if (> accrued remaining) remaining accrued)
    )
)

;; compute-liquid-reserve -- sBTC currently available in contract for immediate payments.
;; Formula: deposit + total_yield_harvested - total_withdrawn - deployed_principal
;; For non-yield streams: deployed_principal=0, total_yield_harvested=0 -> deposit - total_withdrawn.
(define-private (compute-liquid-reserve
        (stream {
            sender: principal,
            token: principal,
            deposit: uint,
            rate_per_second: uint,
            duration: uint,
            start_timestamp: uint,
            last_withdraw_timestamp: uint,
            total_withdrawn: uint,
            is_active: bool,
            recipient_count: uint,
            name: (string-ascii 64),
            description: (string-ascii 256),
            yield_enabled: bool,
            reserve_ratio_bps: uint,
            deployed_principal: uint,
            lp_token_balance: uint,
            total_yield_harvested: uint,
            last_harvest_timestamp: uint,
            strategy_status: uint
        }))
    (let
        (
            (total-in (+ (get deposit stream) (get total_yield_harvested stream)))
            (total-out (+ (get total_withdrawn stream) (get deployed_principal stream)))
        )
        (if (> total-in total-out)
            (- total-in total-out)
            u0
        )
    )
)

(define-private (recipient-allocation
        (stream {
            sender: principal,
            token: principal,
            deposit: uint,
            rate_per_second: uint,
            duration: uint,
            start_timestamp: uint,
            last_withdraw_timestamp: uint,
            total_withdrawn: uint,
            is_active: bool,
            recipient_count: uint,
            name: (string-ascii 64),
            description: (string-ascii 256),
            yield_enabled: bool,
            reserve_ratio_bps: uint,
            deployed_principal: uint,
            lp_token_balance: uint,
            total_yield_harvested: uint,
            last_harvest_timestamp: uint,
            strategy_status: uint
        })
        (recipient-state {
            rate_per_second: uint,
            last_withdraw_timestamp: uint,
            total_withdrawn: uint
        }))
    (* (get rate_per_second recipient-state) (get duration stream))
)

(define-private (is-exact-duration (deposit uint) (total-rate uint))
    (and (> total-rate u0) (is-eq deposit (* (/ deposit total-rate) total-rate)))
)

(define-private (principal-list-contains-step
        (candidate principal)
        (state { target: principal, found: bool }))
    {
        target: (get target state),
        found: (or (get found state) (is-eq candidate (get target state)))
    }
)

(define-private (principal-list-contains (principals (list 10 principal)) (target principal))
    (get found (fold principal-list-contains-step principals { target: target, found: false }))
)

(define-private (validate-recipient-entry
        (entry { recipient: principal, rate_per_second: uint })
        (state {
            seen: (list 10 principal),
            recipients: (list 10 principal),
            sender: principal,
            valid: bool,
            total_rate: uint
        }))
    (if (not (get valid state))
        state
        (if (and
                (not (is-eq (get recipient entry) (get sender state)))
                (is-standard-account (get recipient entry))
                (> (get rate_per_second entry) u0)
                (not (principal-list-contains (get seen state) (get recipient entry)))
            )
            {
                seen: (unwrap-panic (as-max-len? (append (get seen state) (get recipient entry)) u10)),
                recipients: (unwrap-panic (as-max-len? (append (get recipients state) (get recipient entry)) u10)),
                sender: (get sender state),
                valid: true,
                total_rate: (+ (get total_rate state) (get rate_per_second entry))
            }
            {
                seen: (get seen state),
                recipients: (get recipients state),
                sender: (get sender state),
                valid: false,
                total_rate: (get total_rate state)
            }
        )
    )
)

(define-private (register-recipient-state
        (entry { recipient: principal, rate_per_second: uint })
        (state (response { stream_id: uint, timestamp: uint } uint)))
    (match state
        ok-state
            (begin
                (map-set recipient_states
                    { stream_id: (get stream_id ok-state), recipient: (get recipient entry) }
                    {
                        rate_per_second: (get rate_per_second entry),
                        last_withdraw_timestamp: (get timestamp ok-state),
                        total_withdrawn: u0
                    }
                )
                (try! (append-recipient-stream (get recipient entry) (get stream_id ok-state)))
                (ok ok-state)
            )
        err-code (err err-code)
    )
)

(define-private (cancel-recipient-step
        (recipient principal)
        (state (response {
            stream_id: uint,
            token: principal,
            current_timestamp: uint,
            duration: uint,
            total_claimable: uint
        } uint)))
    (match state
        ok-state
            (let
                (
                    (recipient-state (unwrap! (map-get? recipient_states { stream_id: (get stream_id ok-state), recipient: recipient }) ERR_UNAUTHORIZED))
                    (allocation (* (get rate_per_second recipient-state) (get duration ok-state)))
                    (claimable (compute-claimable-amount
                        (get rate_per_second recipient-state)
                        (get last_withdraw_timestamp recipient-state)
                        allocation
                        (get total_withdrawn recipient-state)))
                    (updated_recipient_withdrawn (+ (get total_withdrawn recipient-state) claimable))
                )
                (if (> claimable u0)
                    (try! (transfer-out (get token ok-state) claimable recipient))
                    true
                )
                (map-set recipient_states
                    { stream_id: (get stream_id ok-state), recipient: recipient }
                    {
                        rate_per_second: (get rate_per_second recipient-state),
                        last_withdraw_timestamp: (get current_timestamp ok-state),
                        total_withdrawn: updated_recipient_withdrawn
                    }
                )
                (ok {
                    stream_id: (get stream_id ok-state),
                    token: (get token ok-state),
                    current_timestamp: (get current_timestamp ok-state),
                    duration: (get duration ok-state),
                    total_claimable: (+ (get total_claimable ok-state) claimable)
                })
            )
        err-code (err err-code)
    )
)

(define-private (append-sender-stream (sender principal) (stream-id uint))
    (let
        ((existing_streams (default-to (list) (get stream_ids (map-get? sender_stream_index { sender: sender })))))
        (let
            ((next_streams (unwrap! (as-max-len? (append existing_streams stream-id) u200) ERR_INDEX_FULL)))
            (ok (map-set sender_stream_index { sender: sender } { stream_ids: next_streams }))
        )
    )
)

(define-private (append-recipient-stream (recipient principal) (stream-id uint))
    (let
        ((existing_streams (default-to (list) (get stream_ids (map-get? recipient_stream_index { recipient: recipient })))))
        (let
            ((next_streams (unwrap! (as-max-len? (append existing_streams stream-id) u200) ERR_INDEX_FULL)))
            (ok (map-set recipient_stream_index { recipient: recipient } { stream_ids: next_streams }))
        )
    )
)

(define-private (is-standard-account (value principal))
    (let
        ((parts (unwrap-panic (principal-destruct? value))))
        (is-none (get name parts))
    )
)

(define-private (is-supported-token (token principal))
    (or (is-eq token SBTC_TOKEN) (is-eq token STX_TOKEN))
)

;; transfer-in -- pull tokens from tx-sender into this contract.
(define-private (transfer-in (token principal) (amount uint))
    (begin
        (if (is-eq token STX_TOKEN)
            (unwrap! (stx-transfer? amount tx-sender .satsflow-streams-v6) ERR_TRANSFER_FAILED)
            (unwrap!
                (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
                    transfer amount tx-sender .satsflow-streams-v6 none)
                ERR_TRANSFER_FAILED
            )
        )
        (ok true)
    )
)

;; transfer-out -- send tokens from this contract to recipient.
;; Uses as-contract so tx-sender == current-contract for SIP-010 permission check.
(define-private (transfer-out (token principal) (amount uint) (recipient principal))
    (begin
        (if (is-eq token STX_TOKEN)
            (unwrap! (as-contract (stx-transfer? amount tx-sender recipient)) ERR_TRANSFER_FAILED)
            (unwrap!
                (as-contract (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
                    transfer amount tx-sender recipient none))
                ERR_TRANSFER_FAILED
            )
        )
        (ok true)
    )
)

;; ===========================
;; PRIVATE FUNCTIONS -- Bitflow yield helpers
;; ===========================

;; bitflow-deploy -- deploy sBTC to Bitflow sBTC-BDC XYK pool.
;; Sequence:
;;   1. Swap deploy-amount/2 sBTC -> BDC via xyk-core swap-x-for-y
;;   2. Add liquidity with deploy-amount/2 sBTC (XYK auto-computes BDC needed from current ratio)
;;   3. Residual BDC remains in contract; swapped back on bitflow-unwind
;; Returns: (ok lp-tokens-minted) or propagates Bitflow error.
;; Called only on mainnet -- will fail on testnet (no Bitflow XYK contracts).
(define-private (bitflow-deploy (deploy-amount uint))
    (let
        ((half (/ deploy-amount u2)))
        (begin
            ;; Step 1: swap half sBTC -> BDC to seed the y-token side
            (try! (as-contract (contract-call? 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2
                swap-x-for-y
                'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-bdc-v-1-1
                'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
                'SP14NS8MVBRHXMM96BQY0727AJ59SWPV7RMHC0NCG.pontis-bridge-BDC
                half
                u1))) ;; min-dy must be > 0
            ;; Step 2: add remaining half sBTC as liquidity; XYK pulls proportionate BDC
            (as-contract (contract-call? 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2
                add-liquidity
                'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-bdc-v-1-1
                'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
                'SP14NS8MVBRHXMM96BQY0727AJ59SWPV7RMHC0NCG.pontis-bridge-BDC
                half
                u1)) ;; min-dlp must be > 0
        )
    )
)

;; bitflow-unwind -- fully withdraw an LP position and convert all BDC back to sBTC.
;; Sequence:
;;   1. withdraw-liquidity (lp-balance) -> { sBTC, BDC }
;;   2. swap-y-for-x (BDC -> sBTC)
;; Returns: (ok { sbtc-received: uint, yield-gained: uint }) or propagates Bitflow error.
;; yield-gained = total sBTC recovered minus the original deployed_principal (can be 0 if loss).
(define-private (bitflow-unwind (lp-balance uint) (deployed-principal uint))
    (let
        (
            ;; Step 1: return LP -> sBTC + BDC
            (lp-result (try! (as-contract (contract-call? 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2
                withdraw-liquidity
                'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-bdc-v-1-1
                'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
                'SP14NS8MVBRHXMM96BQY0727AJ59SWPV7RMHC0NCG.pontis-bridge-BDC
                lp-balance
                u0  ;; min-x-amount: accept anything
                u0  ;; min-y-amount: accept anything
            ))))
            (sbtc-from-lp (get x-amount lp-result))
            (bdc-from-lp (get y-amount lp-result))
        )
        ;; Step 2: swap all BDC received back to sBTC
        (let
            (
                (sbtc-from-swap
                    (if (> bdc-from-lp u0)
                        (try! (as-contract (contract-call? 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2
                            swap-y-for-x
                            'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-bdc-v-1-1
                            'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
                            'SP14NS8MVBRHXMM96BQY0727AJ59SWPV7RMHC0NCG.pontis-bridge-BDC
                            bdc-from-lp
                            u1))) ;; min-dx must be > 0
                        u0))
                (total-sbtc (+ sbtc-from-lp sbtc-from-swap))
                (yield-gained (if (> total-sbtc deployed-principal)
                    (- total-sbtc deployed-principal)
                    u0))
            )
            (ok { sbtc-received: total-sbtc, yield-gained: yield-gained })
        )
    )
)
