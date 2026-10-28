# 00 · Initial setup and platform

This is the implementation demo for the platform gate. Unlike videos one to three, which walk through design mocks, everything here is the real code running on this machine, against a throwaway SQLite database with synthetic people. It shows how a clean checkout becomes a working platform in about two minutes.

## Setup

Start with the database. Migration is an explicit command, and the API never applies it on startup. The start script runs migrate, then seed, then launches the API and waits until it reports ready. Seed is safe to run again: the second run adds nothing. And seed on a file that was never migrated is refused, with a message telling you to migrate first.

## Access

Now the access rules. The health endpoint is open to anyone. Every other endpoint needs a token, so a request without one gets a four oh one problem response. We issue a local token for the synthetic buyer, shown here with the secret part hidden, and the same request now succeeds and names the caller. That buyer token on an admin endpoint is turned away with a four oh three. And when the server really does fail, the caller gets a five hundred problem response with a trace identifier, and no stack trace.

## The apps

The buyer app starts and asks the real API whether it is ready. An address that does not exist shows the four oh four page, with a way back. Now we cut the connection to the API. The app shows the five hundred page, with try again and contact support. We restore the connection, press try again, and the app recovers.

## Recap

Here is what to remember. Migration and seeding are explicit and repeatable. Endpoints require a valid token by default, and roles decide who gets in. Failures are calm, structured, and recoverable. Payments and video calls are local stand-ins in this gate, and no real charge or email is made. Next, journey one: sign up and sign in.
