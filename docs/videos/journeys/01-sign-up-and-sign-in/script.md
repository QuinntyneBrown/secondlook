# 01 · Sign up and sign in

This is the implementation demo for journey one. Everything here is the real application and API running on this machine, with a local mailbox that sends no real email. It shows how a buyer creates an account, proves their email, signs in and out, and recovers a forgotten password.

## Sign up

Start on the sign-up page. With a short email and password and no name, the page refuses and lists exactly what to fix, with focus on the summary. Now a valid account. The page asks you to check your email. Signing in before you verify is refused, with a clear reason.

## Verify and sign in

We open the emailed link, which proves the address, and the page confirms you are verified. A wrong password is rejected with a message that never says which part was wrong. The right password signs you in to your inspections.

## Sign out and reset

Signing out asks first, because your inspections stay in your account. Then the forgotten password path. We ask for a link, which works for thirty minutes, choose a new password, and the page signs you in again.

## Providers

Mechanics and body shops register through the same door. A body shop registers and verifies, and can sign in as a body shop, but the response says it is not approved. Registering never grants approval. And nobody can register as an administrator: that request is refused.

## Recap

Here is what to remember. Accounts need a verified email before sign in. Links expire and work once. Providers wait for approval, and administrators cannot be self registered. Next, journey two: administering mechanics and shops.
