# ADR-0002: Local JWT and dev token CLI

- Status: Accepted
- Date: 2026-10-28
- Category: security
- Journey: J00

## Context

`AGENTS.md` requires local JWTs. Sign-in and registration belong to J01, but J00 must prove authentication, 401 and 403 behaviour, and give tests and demos a way to act as a seeded user.

## Decision

1. The API validates HS256 bearer tokens: signature, `SecondLook:Jwt:Issuer`, `SecondLook:Jwt:Audience` and expiry. Claims carry the user id and role.
2. `SecondLook:Jwt:SigningKey` is never committed. Developers set it with `dotnet user-secrets` or the environment variable `SecondLook__Jwt__SigningKey`. The API fails at startup when it is absent outside the test and E2E hosts, which supply a fixed throwaway key.
3. After validating a token, the API loads the user and rejects the request with 401 if the user is missing or inactive.
4. `JwtTokenService` in Infrastructure issues tokens. In J00 its only caller is the CLI command `secondlook token --email <e>`, which issues a short-lived token for a seeded identity.
5. J01 adds the public sign-in endpoint on top of the same service; this ADR is then extended, not replaced.

## Consequences

- Tests and demos obtain tokens without a login screen.
- The signing key must be rotated if ever exposed; there is no key rollover in J00.
- Symmetric keys are acceptable for a single local issuer and validator.

## Alternatives considered

- External identity provider: out of scope; no cloud setup in J00.
- A development-only anonymous bypass: rejected; it would not exercise the real validation path.
