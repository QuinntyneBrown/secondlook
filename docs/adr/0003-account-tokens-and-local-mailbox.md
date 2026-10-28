# ADR 0003: Account link tokens and the local mailbox

## Status
Accepted (J01)

## Context
Email verification and password reset need single-use, expiring links. Real mail must not be sent from local, test or demo hosts, and tests must be able to read the link.

## Decision
- Link tokens are 32 random bytes, base64url. Only the SHA-256 hash is stored in `AccountTokens` with purpose, expiry (24 h verify, 30 min reset) and used-at.
- `IEmailSender` is the port; `LocalMailbox` is the in-memory adapter. In Development (or with `SecondLook:Diagnostics:EnableFaultEndpoint`) `GET /api/platform/diagnostics/mailbox` returns the last token for an address and purpose. A production mail adapter is a later decision.
- Time comes from `TimeProvider` so tests can expire links.
- Forgot-password, resend-verification and login never reveal whether an account exists.

## Consequences
Tokens survive restarts of the database but the local mailbox does not. The diagnostics endpoint must stay Development-only; a test asserts it is absent in Production.
