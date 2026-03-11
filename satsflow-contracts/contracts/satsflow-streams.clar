;; title: satsflow-streams
;; version:
;; summary:
;; description:

;; constants
(define-constant SBTC_TOKEN 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token)

(define-constant ERR_INVALID_TOKEN (err u100))
(define-constant ERR_INVALID_DEPOSIT (err u101))
(define-constant ERR_INVALID_RATE (err u102))
(define-constant ERR_INVALID_RECIPIENT (err u103))
(define-constant ERR_STREAM_NOT_FOUND (err u200))
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

;; public functions
(define-public (create-stream (recipient principal) (token principal) (rate-per-second uint) (deposit uint))
	(let
		(
			(current_timestamp (current-time-seconds))
			(stream_id (var-get next_stream_id))
		)
		(asserts! (is-eq token SBTC_TOKEN) ERR_INVALID_TOKEN)
		(asserts! (> deposit u0) ERR_INVALID_DEPOSIT)
		(asserts! (> rate-per-second u0) ERR_INVALID_RATE)
		(asserts! (not (is-eq recipient tx-sender)) ERR_INVALID_RECIPIENT)

		(unwrap!
			(contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer deposit tx-sender current-contract none)
			ERR_TRANSFER_FAILED
		)

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

		(var-set next_stream_id (+ stream_id u1))
		(ok stream_id)
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
			(let
				(
					(current_timestamp (current-time-seconds))
					(last_timestamp (get last_withdraw_timestamp stream))
					(elapsed_seconds (if (> current_timestamp last_timestamp) (- current_timestamp last_timestamp) u0))
					(accrued (* elapsed_seconds (get rate_per_second stream)))
					(remaining_deposit (if (> (get deposit stream) (get total_withdrawn stream)) (- (get deposit stream) (get total_withdrawn stream)) u0))
				)
				(ok (if (> accrued remaining_deposit) remaining_deposit accrued))
			)
		)
	)
)

;; private functions
(define-private (current-time-seconds)
	burn-block-height
)

