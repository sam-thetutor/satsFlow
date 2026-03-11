;; title: satsflow-streams
;; version:
;; summary:
;; description:

;; constants
(define-constant SBTC_TOKEN 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token)
(define-constant STX_TOKEN 'SP000000000000000000002Q6VF78)

(define-constant ERR_INVALID_TOKEN (err u100))
(define-constant ERR_INVALID_DEPOSIT (err u101))
(define-constant ERR_INVALID_RATE (err u102))
(define-constant ERR_INVALID_RECIPIENT (err u103))
(define-constant ERR_INVALID_TOPUP (err u104))
(define-constant ERR_INVALID_PRINCIPAL (err u105))
(define-constant ERR_STREAM_NOT_FOUND (err u200))
(define-constant ERR_INACTIVE_STREAM (err u201))
(define-constant ERR_NOTHING_TO_WITHDRAW (err u202))
(define-constant ERR_INDEX_FULL (err u203))
(define-constant ERR_UNAUTHORIZED (err u150))
(define-constant ERR_TRANSFER_FAILED (err u250))

;; data vars
(define-data-var next_stream_id uint u1)

;; data maps
(define-map streams
	{ stream_id: uint }
	{
		sender: principal,
		recipient: principal,
		token: principal,
		deposit: uint,
		rate_per_second: uint,
		start_timestamp: uint,
		last_withdraw_timestamp: uint,
		total_withdrawn: uint,
		is_active: bool
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

;; public functions
(define-public (create-stream (recipient principal) (token principal) (rate-per-second uint) (deposit uint))
	(let
		(
			(current_timestamp (current-time-seconds))
			(stream_id (var-get next_stream_id))
		)
		(asserts! (is-supported-token token) ERR_INVALID_TOKEN)
		(asserts! (> deposit u0) ERR_INVALID_DEPOSIT)
		(asserts! (> rate-per-second u0) ERR_INVALID_RATE)
		(asserts! (not (is-eq recipient tx-sender)) ERR_INVALID_RECIPIENT)
		(asserts! (is-standard-account recipient) ERR_INVALID_PRINCIPAL)

		(try! (transfer-in token deposit))

		(map-set streams
			{ stream_id: stream_id }
			{
				sender: tx-sender,
				recipient: recipient,
				token: token,
				deposit: deposit,
				rate_per_second: rate-per-second,
				start_timestamp: current_timestamp,
				last_withdraw_timestamp: current_timestamp,
				total_withdrawn: u0,
				is_active: true
			}
		)

		(try! (append-sender-stream tx-sender stream_id))
		(try! (append-recipient-stream recipient stream_id))

		(var-set next_stream_id (+ stream_id u1))
		(ok stream_id)
	)
)

(define-public (withdraw (stream-id uint))
	(let
		((stream (unwrap! (map-get? streams { stream_id: stream-id }) ERR_STREAM_NOT_FOUND)))
		(asserts! (is-eq tx-sender (get recipient stream)) ERR_UNAUTHORIZED)
		(asserts! (get is_active stream) ERR_INACTIVE_STREAM)
		(asserts! (is-supported-token (get token stream)) ERR_INVALID_TOKEN)
		(let
			(
				(claimable (compute-claimable stream))
				(current_timestamp (current-time-seconds))
				(updated_total_withdrawn (+ (get total_withdrawn stream) claimable))
			)
			(asserts! (> claimable u0) ERR_NOTHING_TO_WITHDRAW)

			(try! (transfer-out (get token stream) claimable tx-sender))

			(map-set streams
				{ stream_id: stream-id }
				{
					sender: (get sender stream),
					recipient: (get recipient stream),
					token: (get token stream),
					deposit: (get deposit stream),
					rate_per_second: (get rate_per_second stream),
					start_timestamp: (get start_timestamp stream),
					last_withdraw_timestamp: current_timestamp,
					total_withdrawn: updated_total_withdrawn,
					is_active: (< updated_total_withdrawn (get deposit stream))
				}
			)

			(ok claimable)
		)
	)
)

(define-public (top-up-stream (stream-id uint) (amount uint))
	(let
		((stream (unwrap! (map-get? streams { stream_id: stream-id }) ERR_STREAM_NOT_FOUND)))
		(asserts! (is-eq tx-sender (get sender stream)) ERR_UNAUTHORIZED)
		(asserts! (get is_active stream) ERR_INACTIVE_STREAM)
		(asserts! (> amount u0) ERR_INVALID_TOPUP)
		(asserts! (is-supported-token (get token stream)) ERR_INVALID_TOKEN)

		(try! (transfer-in (get token stream) amount))

		(map-set streams
			{ stream_id: stream-id }
			{
				sender: (get sender stream),
				recipient: (get recipient stream),
				token: (get token stream),
				deposit: (+ (get deposit stream) amount),
				rate_per_second: (get rate_per_second stream),
				start_timestamp: (get start_timestamp stream),
				last_withdraw_timestamp: (get last_withdraw_timestamp stream),
				total_withdrawn: (get total_withdrawn stream),
				is_active: true
			}
		)

		(ok (+ (get deposit stream) amount))
	)
)

(define-public (cancel-stream (stream-id uint))
	(let
		(
			(stream (unwrap! (map-get? streams { stream_id: stream-id }) ERR_STREAM_NOT_FOUND))
			(current_timestamp (current-time-seconds))
		)
		(asserts! (is-eq tx-sender (get sender stream)) ERR_UNAUTHORIZED)
		(asserts! (get is_active stream) ERR_INACTIVE_STREAM)
		(asserts! (is-supported-token (get token stream)) ERR_INVALID_TOKEN)
		(let
			(
				(claimable (compute-claimable stream))
				(remaining_deposit (remaining-deposit stream))
				(refund_amount (if (> remaining_deposit claimable) (- remaining_deposit claimable) u0))
				(updated_total_withdrawn (+ (get total_withdrawn stream) claimable))
			)
			(if (> claimable u0)
				(try! (transfer-out (get token stream) claimable (get recipient stream)))
				true
			)

			(if (> refund_amount u0)
				(try! (transfer-out (get token stream) refund_amount tx-sender))
				true
			)

			(map-set streams
				{ stream_id: stream-id }
				{
					sender: (get sender stream),
					recipient: (get recipient stream),
					token: (get token stream),
					deposit: (get deposit stream),
					rate_per_second: (get rate_per_second stream),
					start_timestamp: (get start_timestamp stream),
					last_withdraw_timestamp: current_timestamp,
					total_withdrawn: updated_total_withdrawn,
					is_active: false
				}
			)

			(ok refund_amount)
		)
	)
)

;; read only functions
(define-read-only (get-stream (stream-id uint))
	(ok (map-get? streams { stream_id: stream-id }))
)

(define-read-only (get-claimable (stream-id uint) (recipient principal))
	(let
		((stream (unwrap! (map-get? streams { stream_id: stream-id }) ERR_STREAM_NOT_FOUND)))
		(asserts! (is-eq recipient (get recipient stream)) ERR_UNAUTHORIZED)
		(if (not (get is_active stream))
			(ok u0)
			(ok (compute-claimable stream))
		)
	)
)

(define-read-only (get-sender-streams (sender principal))
	(ok (default-to (list) (get stream_ids (map-get? sender_stream_index { sender: sender }))))
)

(define-read-only (get-recipient-streams (recipient principal))
	(ok (default-to (list) (get stream_ids (map-get? recipient_stream_index { recipient: recipient }))))
)

;; private functions
(define-private (current-time-seconds)
	burn-block-height
)

(define-private (remaining-deposit
		(stream {
			sender: principal,
			recipient: principal,
			token: principal,
			deposit: uint,
			rate_per_second: uint,
			start_timestamp: uint,
			last_withdraw_timestamp: uint,
			total_withdrawn: uint,
			is_active: bool
		})
	)
	(if (> (get deposit stream) (get total_withdrawn stream))
		(- (get deposit stream) (get total_withdrawn stream))
		u0
	)
)

(define-private (compute-claimable
		(stream {
			sender: principal,
			recipient: principal,
			token: principal,
			deposit: uint,
			rate_per_second: uint,
			start_timestamp: uint,
			last_withdraw_timestamp: uint,
			total_withdrawn: uint,
			is_active: bool
		})
	)
	(let
		(
			(current_timestamp (current-time-seconds))
			(last_timestamp (get last_withdraw_timestamp stream))
			(elapsed_seconds (if (> current_timestamp last_timestamp) (- current_timestamp last_timestamp) u0))
			(accrued (* elapsed_seconds (get rate_per_second stream)))
			(remaining (remaining-deposit stream))
		)
		(if (> accrued remaining) remaining accrued)
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

(define-private (transfer-in (token principal) (amount uint))
	(begin
		(if (is-eq token STX_TOKEN)
			(unwrap! (stx-transfer? amount tx-sender current-contract) ERR_TRANSFER_FAILED)
			(unwrap!
				(contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer amount tx-sender current-contract none)
				ERR_TRANSFER_FAILED
			)
		)
		(ok true)
	)
)

(define-private (transfer-out (token principal) (amount uint) (recipient principal))
	(begin
		(if (is-eq token STX_TOKEN)
			(unwrap!
				(as-contract? ((with-stx amount))
					(try! (stx-transfer? amount tx-sender recipient))
				)
				ERR_TRANSFER_FAILED
			)
			(unwrap!
				(contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer amount current-contract recipient none)
				ERR_TRANSFER_FAILED
			)
		)
		(ok true)
	)
)

