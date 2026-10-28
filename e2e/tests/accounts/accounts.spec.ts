import { test } from "@playwright/test";
import {
  ForgotPasswordPage,
  InspectionsPage,
  ResetPasswordPage,
  SignInPage,
  SignUpPage,
  VerifyEmailPage,
  emailedToken,
} from "../../pages/AccountPages";

const unique = () =>
  `jordan.${Date.now()}${Math.floor(Math.random() * 1000)}@example.test`;
const PASSWORD = "a-long-password";

test.describe("Accounts (J01)", () => {
  // L2-006 AC1, L2-007: the sign-up form explains each invalid field and moves focus to the summary.
  test("sign-up shows validation errors", async ({ page }) => {
    const signUp = new SignUpPage(page);
    await signUp.open();
    await signUp.expectLoaded();
    await signUp.fill("", "jordan.lee@", "short", false);
    await signUp.submit();
    await signUp.expectSummary("Fix 3 things to continue", [
      "Enter your name.",
      "Enter a valid email address.",
      "Use at least 10 characters.",
    ]);
    await signUp.expectFieldError("Full name", "Enter your name.");
    await signUp.expectFieldError(
      "Email",
      "Enter a valid email address, like name@example.com.",
    );
  });

  // L2-006 AC2/AC4, L2-012, L2-013: sign up, verify through the emailed link, sign in and out.
  test("a buyer signs up, verifies, signs in and signs out", async ({
    page,
  }) => {
    const email = unique();
    const signUp = new SignUpPage(page);
    await signUp.open();
    await signUp.fill("Jordan Lee", email, PASSWORD);
    await signUp.submit();
    const verify = new VerifyEmailPage(page);
    await verify.expectAskedToVerify(email);

    const signIn = new SignInPage(page);
    await signIn.open();
    await signIn.signIn(email, PASSWORD);
    await signIn.expectNeedsVerification();

    await verify.openLink(await emailedToken(page, email, "verify-email"));
    await verify.expectVerified();

    await signIn.open();
    await signIn.signIn(email, PASSWORD);
    const inspections = new InspectionsPage(page);
    await inspections.expectSignedIn("Jordan Lee");

    await inspections.openSignOut();
    await inspections.cancelSignOut();
    await inspections.expectSignedIn("Jordan Lee");
    await inspections.openSignOut();
    await inspections.confirmSignOut();
    await signIn.expectLoaded();
  });

  // L2-006 AC4: the same email cannot register twice.
  test("sign-up reports an existing account", async ({ page }) => {
    const signUp = new SignUpPage(page);
    await signUp.open();
    await signUp.fill("Sam Buyer", "buyer@example.test", PASSWORD);
    await signUp.submit();
    await signUp.expectAccountExists();
  });

  // L2-008 AC4, L2-009: rejected and invalid sign-ins.
  test("sign-in rejects bad credentials and validates fields", async ({
    page,
  }) => {
    const signIn = new SignInPage(page);
    await signIn.open();
    await signIn.expectLoaded();
    await signIn.signIn("buyer@example.test", "not-the-password");
    await signIn.expectRejected("buyer@example.test");
    await signIn.signIn("jordan.lee@", "");
    await signIn.expectSummary("Fix 2 things to sign in", [
      "Enter a valid email address.",
      "Enter your password.",
    ]);
  });

  // L2-010, L2-011: ask for a reset, choose a new password, end up signed in.
  test("a buyer resets a forgotten password", async ({ page }) => {
    const forgot = new ForgotPasswordPage(page);
    await forgot.open();
    await forgot.request("jordan.lee");
    await forgot.expectInvalidEmail();
    await forgot.request("buyer@example.test");
    await forgot.expectSent("buyer@example.test");

    const reset = new ResetPasswordPage(page);
    await reset.openLink(
      await emailedToken(page, "buyer@example.test", "reset-password"),
    );
    await reset.save("short", "shorter");
    await reset.expectMismatch();
    await reset.save("Password-123!");
    await reset.expectUpdated();
  });

  // L2-011 AC5: a link that is not valid shows the expired state.
  test("an unusable reset link offers a new one", async ({ page }) => {
    const reset = new ResetPasswordPage(page);
    await page.goto("/reset-password?token=not-a-real-token");
    await reset.save("Password-123!");
    await reset.expectExpired();
  });
});
