;; title: satsflow-streams-v4
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
(define-constant ERR_INVALID_RECIPIENT_LIST (err u106))
(define-constant ERR_INVALID_SPLIT (err u107))
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
		is_active: bool,
		recipient_count: uint,
		name: (string-ascii 64),
		description: (string-ascii 256)
	}
)

(define-map stream_recipients
	{ stream_id: uint }
	{ recipients: (list 10 principal) }
)

(define-map recipient_withdrawals
	{ stream_id: uint, recipient: principal }
	{
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

;; public functions
(define-public (create-stream (recipient principal) (token principal) (rate-per-second uint) (deposit uint))
	(create-stream-internal
		(unwrap-panic (as-max-len? (list recipient) u10))
		token
		rate-per-second
		deposit
		""
		""
	)
)

(define-public (create-stream-with-details
		(recipient principal)
		(token principal)
		(rate-per-second uint)
		(deposit uint)
		(name (string-ascii 64))
		(description (string-ascii 256))
	)
	(create-stream-internal
		(unwrap-panic (as-max-len? (list recipient) u10))
		token
		rate-per-second
		deposit
		name
		description
	)
)

(define-public (create-stream-multi
		(recipients (list 10 principal))
		(token principal)
		(rate-per-second uint)
		(deposit uint)
		(name (string-ascii 64))
		(description (string-ascii 256))
	)
	(create-stream-internal recipients token rate-per-second deposit name description)
)

(define-public (withdraw (stream-id uint))
	(let
		(
			(stream (unwrap! (map-get? streams { stream_id: stream-id }) ERR_STREAM_NOT_FOUND))
			(recipient_state (unwrap! (map-get? recipient_withdrawals { stream_id: stream-id, recipient: tx-sender }) ERR_UNAUTHORIZED))
		)
		(asserts! (get is_active stream) ERR_INACTIVE_STREAM)
		(asserts! (is-supported-token (get token stream)) ERR_INVALID_TOKEN)
		(let
			(
				(recipient_count (get recipient_count stream))
				(rate_share (share-amount (get rate_per_second stream) recipient_count))
				(deposit_share (share-amount (get deposit stream) recipient_count))
				(claimable (compute-claimable-amount rate_share (get last_withdraw_timestamp recipient_state) deposit_share (get total_withdrawn recipient_state)))
				(current_timestamp (current-time-seconds))
				(updated_recipient_withdrawn (+ (get total_withdrawn recipient_state) claimable))
				(updated_total_withdrawn (+ (get total_withdrawn stream) claimable))
			)
			(asserts! (> claimable u0) ERR_NOTHING_TO_WITHDRAW)

			(try! (transfer-out (get token stream) claimable tx-sender))

			(map-set recipient_withdrawals
				{ stream_id: stream-id, recipient: tx-sender }
				{
					last_withdraw_timestamp: current_timestamp,
					total_withdrawn: updated_recipient_withdrawn
				}
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
					is_active: (< updated_total_withdrawn (get deposit stream)),
					recipient_count: recipient_count,
					name: (get name stream),
					description: (get description stream)
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
		(asserts! (is-valid-split amount (get recipient_count stream)) ERR_INVALID_SPLIT)

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
				is_active: true,
				recipient_count: (get recipient_count stream),
				name: (get name stream),
				description: (get description stream)
			}
		)

		(ok (+ (get deposit stream) amount))
	)
)

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
					rate_share: (share-amount (get rate_per_second stream) (get recipient_count stream)),
					deposit_share: (share-amount (get deposit stream) (get recipient_count stream)),
					total_claimable: u0
				}))))
				(updated_total_withdrawn (+ (get total_withdrawn stream) (get total_claimable cancel_state)))
				(refund_amount (remaining-amount (get deposit stream) updated_total_withdrawn))
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
					is_active: false,
					recipient_count: (get recipient_count stream),
					name: (get name stream),
					description: (get description stream)
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

(define-read-only (get-stream-recipients (stream-id uint))
	(ok (default-to (list) (get recipients (map-get? stream_recipients { stream_id: stream-id }))))
)

(define-read-only (get-claimable (stream-id uint) (recipient principal))
	(let
		(
			(stream (unwrap! (map-get? streams { stream_id: stream-id }) ERR_STREAM_NOT_FOUND))
			(recipient_state (unwrap! (map-get? recipient_withdrawals { stream_id: stream-id, recipient: recipient }) ERR_UNAUTHORIZED))
		)
		(if (not (get is_active stream))
			(ok u0)
			(ok (compute-claimable-amount
				(share-amount (get rate_per_second stream) (get recipient_count stream))
				(get last_withdraw_timestamp recipient_state)
				(share-amount (get deposit stream) (get recipient_count stream))
				(get total_withdrawn recipient_state)
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

;; private functions
(define-private (create-stream-internal
		(recipients (list 10 principal))
		(token principal)
		(rate-per-second uint)
		(deposit uint)
		(name (string-ascii 64))
		(description (string-ascii 256))
	)
	(let
		(
			(current_timestamp (current-time-seconds))
			(stream_id (var-get next_stream_id))
			(recipient_count (len recipients))
		)
		(asserts! (is-supported-token token) ERR_INVALID_TOKEN)
		(asserts! (> deposit u0) ERR_INVALID_DEPOSIT)
		(asserts! (> rate-per-second u0) ERR_INVALID_RATE)
		(asserts! (> recipient_count u0) ERR_INVALID_RECIPIENT_LIST)
		(asserts! (are-valid-recipients recipients tx-sender) ERR_INVALID_RECIPIENT_LIST)
		(asserts! (is-valid-split deposit recipient_count) ERR_INVALID_SPLIT)
		(asserts! (is-valid-split rate-per-second recipient_count) ERR_INVALID_SPLIT)

		(try! (transfer-in token deposit))

		(map-set streams
			{ stream_id: stream_id }
			{
				sender: tx-sender,
				recipient: (unwrap! (element-at? recipients u0) ERR_INVALID_RECIPIENT_LIST),
				token: token,
				deposit: deposit,
				rate_per_second: rate-per-second,
				start_timestamp: current_timestamp,
				last_withdraw_timestamp: current_timestamp,
				total_withdrawn: u0,
				is_active: true,
				recipient_count: recipient_count,
				name: name,
				description: description
			}
		)

		(map-set stream_recipients { stream_id: stream_id } { recipients: recipients })

		(try! (append-sender-stream tx-sender stream_id))
		(try! (fold register-recipient-step recipients (ok { stream_id: stream_id, timestamp: current_timestamp })))

		(var-set next_stream_id (+ stream_id u1))
		(ok stream_id)
	)
)

(define-private (current-time-seconds)
	burn-block-height
)

(define-private (remaining-amount (deposit uint) (withdrawn uint))
	(if (> deposit withdrawn)
		(- deposit withdrawn)
		u0
	)
)

(define-private (compute-claimable-amount (rate-share uint) (last-timestamp uint) (deposit-share uint) (withdrawn uint))
	(let
		(
			(current_timestamp (current-time-seconds))
			(elapsed_seconds (if (> current_timestamp last-timestamp) (- current_timestamp last-timestamp) u0))
			(accrued (* elapsed_seconds rate-share))
			(remaining (remaining-amount deposit-share withdrawn))
		)
		(if (> accrued remaining) remaining accrued)
	)
)

(define-private (share-amount (amount uint) (count uint))
	(/ amount count)
)

(define-private (is-valid-split (amount uint) (count uint))
	(is-eq amount (* (/ amount count) count))
)

(define-private (principal-list-contains-step (candidate principal) (state { target: principal, found: bool }))
	{
		target: (get target state),
		found: (or (get found state) (is-eq candidate (get target state)))
	}
)

(define-private (principal-list-contains (principals (list 10 principal)) (target principal))
	(get found (fold principal-list-contains-step principals { target: target, found: false }))
)

(define-private (validate-recipient-step (recipient principal) (state { seen: (list 10 principal), sender: principal, valid: bool }))
	(if (not (get valid state))
		state
		(if (and
				(not (is-eq recipient (get sender state)))
				(is-standard-account recipient)
				(not (principal-list-contains (get seen state) recipient))
			)
			{
				seen: (unwrap-panic (as-max-len? (append (get seen state) recipient) u10)),
				sender: (get sender state),
				valid: true
			}
			{
				seen: (get seen state),
				sender: (get sender state),
				valid: false
			}
		)
	)
)

(define-private (are-valid-recipients (recipients (list 10 principal)) (sender principal))
	(get valid (fold validate-recipient-step recipients { seen: (list), sender: sender, valid: true }))
)

(define-private (register-recipient-step (recipient principal) (state (response { stream_id: uint, timestamp: uint } uint)))
	(match state
		ok-state
			(begin
				(map-set recipient_withdrawals
					{ stream_id: (get stream_id ok-state), recipient: recipient }
					{
						last_withdraw_timestamp: (get timestamp ok-state),
						total_withdrawn: u0
					}
				)
				(try! (append-recipient-stream recipient (get stream_id ok-state)))
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
			rate_share: uint,
			deposit_share: uint,
			total_claimable: uint
		} uint))
	)
	(match state
		ok-state
			(let
				(
					(recipient_state (unwrap! (map-get? recipient_withdrawals { stream_id: (get stream_id ok-state), recipient: recipient }) ERR_UNAUTHORIZED))
					(claimable (compute-claimable-amount (get rate_share ok-state) (get last_withdraw_timestamp recipient_state) (get deposit_share ok-state) (get total_withdrawn recipient_state)))
					(updated_recipient_withdrawn (+ (get total_withdrawn recipient_state) claimable))
				)
				(if (> claimable u0)
					(try! (transfer-out (get token ok-state) claimable recipient))
					true
				)

				(map-set recipient_withdrawals
					{ stream_id: (get stream_id ok-state), recipient: recipient }
					{
						last_withdraw_timestamp: (get current_timestamp ok-state),
						total_withdrawn: updated_recipient_withdrawn
					}
				)

				(ok {
					stream_id: (get stream_id ok-state),
					token: (get token ok-state),
					current_timestamp: (get current_timestamp ok-state),
					rate_share: (get rate_share ok-state),
					deposit_share: (get deposit_share ok-state),
					total_claimable: (+ (get total_claimable ok-state) claimable)
				})
			)
		err-code (err err-code)
	)
)

(define-private (append-sender-stream (sender principal) (stream-id uint))
	(let
		((existing_streams (default-to (list) (get stream_ids (map-get? sender_stream_index { sender: sender })))) )
		(let
			((next_streams (unwrap! (as-max-len? (append existing_streams stream-id) u200) ERR_INDEX_FULL)))
			(ok (map-set sender_stream_index { sender: sender } { stream_ids: next_streams }))
		)
	)
)

(define-private (append-recipient-stream (recipient principal) (stream-id uint))
	(let
		((existing_streams (default-to (list) (get stream_ids (map-get? recipient_stream_index { recipient: recipient })))) )
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