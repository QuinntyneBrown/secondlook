import { expect, type Page } from "@playwright/test";

const API = "http://localhost:5100";

/** The emailed link token, read from the local mail adapter (development hosts only). */
export async function emailedToken(
  page: Page,
  email: string,
  purpose: "verify-email" | "reset-password",
) {
  const response = await page.request.get(
    `${API}/api/platform/diagnostics/mailbox?email=${encodeURIComponent(email)}&purpose=${purpose}`,
  );
  return (await response.json()).token as string;
}

export class SignUpPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto("/sign-up");
  }

  async expectLoaded() {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Create your account" }),
    ).toBeVisible();
    for (const label of ["Full name", "Email", "Password"])
      await expect(this.page.getByLabel(label, { exact: true })).toBeVisible();
    await expect(this.page.getByText("At least 10 characters.")).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: "Create account" }),
    ).toBeVisible();
  }

  async fill(name: string, email: string, password: string, agree = true) {
    await this.page.getByLabel("Full name", { exact: true }).fill(name);
    await this.page.getByLabel("Email", { exact: true }).fill(email);
    await this.page.getByLabel("Password", { exact: true }).fill(password);
    if (agree)
      await this.page
        .getByRole("checkbox", {
          name: /I agree to the Terms and Privacy policy/,
        })
        .check();
  }

  async submit() {
    await this.page.getByRole("button", { name: "Create account" }).click();
  }

  async expectSummary(title: string, items: string[]) {
    const summary = this.page.getByRole("alert").filter({ hasText: title });
    await expect(summary).toBeVisible();
    for (const item of items)
      await expect(summary.getByRole("link", { name: item })).toBeVisible();
    await expect(summary).toBeFocused();
  }

  async expectFieldError(label: string, message: string) {
    const field = this.page.getByLabel(label, { exact: true });
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAccessibleDescription(message);
  }

  async expectAccountExists() {
    const alert = this.page
      .getByRole("alert")
      .filter({ hasText: "There’s already an account for that email" });
    await expect(alert).toBeVisible();
    await expect(alert.getByRole("link", { name: "Sign in" })).toBeVisible();
  }
}

export class VerifyEmailPage {
  constructor(private readonly page: Page) {}

  async expectAskedToVerify(email: string) {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Check your email" }),
    ).toBeVisible();
    await expect(
      this.page.getByText(
        `We sent a link to ${email}. Open it on this device to finish setting up.`,
      ),
    ).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: "Resend email" }),
    ).toBeVisible();
  }

  async openLink(token: string) {
    await this.page.goto(`/verify-email?token=${encodeURIComponent(token)}`);
  }

  async expectVerified() {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "You’re verified" }),
    ).toBeVisible();
    await expect(
      this.page.getByText(
        "You’re all set. Book your first inspection whenever you’re ready.",
      ),
    ).toBeVisible();
  }

  async expectExpired() {
    await expect(
      this.page.getByRole("heading", {
        level: 1,
        name: "We couldn’t verify that link",
      }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("alert").filter({ hasText: "That link has expired" }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: "Send a new link" }),
    ).toBeVisible();
  }
}

export class SignInPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto("/sign-in");
  }

  async expectLoaded() {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Sign in" }),
    ).toBeVisible();
    await expect(
      this.page.getByText("Welcome back. Your inspections are waiting."),
    ).toBeVisible();
    await expect(
      this.page.getByRole("link", { name: "Forgot your password?" }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("link", { name: "Create an account" }),
    ).toBeVisible();
  }

  async signIn(email: string, password: string) {
    await this.page.getByLabel("Email", { exact: true }).fill(email);
    await this.page.getByLabel("Password", { exact: true }).fill(password);
    await this.page.getByRole("button", { name: "Sign in" }).click();
  }

  async expectRejected(email: string) {
    const alert = this.page
      .getByRole("alert")
      .filter({ hasText: "That email and password don’t match" });
    await expect(alert).toBeVisible();
    await expect(
      alert.getByRole("link", { name: "Reset password" }),
    ).toBeVisible();
    await expect(this.page.getByLabel("Password", { exact: true })).toHaveValue(
      "",
    );
    await expect(this.page.getByLabel("Email", { exact: true })).toHaveValue(
      email,
    );
  }

  async expectSummary(title: string, items: string[]) {
    const summary = this.page.getByRole("alert").filter({ hasText: title });
    await expect(summary).toBeVisible();
    for (const item of items)
      await expect(summary.getByRole("link", { name: item })).toBeVisible();
  }

  async expectNeedsVerification() {
    await expect(
      this.page
        .getByRole("alert")
        .filter({ hasText: "Verify your email to sign in" }),
    ).toBeVisible();
  }
}

export class InspectionsPage {
  constructor(private readonly page: Page) {}

  async expectSignedIn(name: string) {
    await expect(this.page).toHaveURL(/\/inspections$/);
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Your inspections" }),
    ).toBeVisible();
    await expect(this.page.getByText(name)).toBeVisible();
  }

  async openSignOut() {
    await this.page.getByRole("button", { name: "Sign out" }).click();
  }

  async confirmSignOut() {
    const dialog = this.page.getByRole("dialog", {
      name: "Sign out of SecondLook?",
    });
    await expect(
      dialog.getByText(
        "Your inspections and reports stay in your account. You’ll need your email and password to get back in.",
      ),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Sign out" }).click();
  }

  async cancelSignOut() {
    await this.page
      .getByRole("dialog", { name: "Sign out of SecondLook?" })
      .getByRole("button", { name: "Cancel" })
      .click();
    await expect(this.page.getByRole("dialog")).toBeHidden();
  }
}

export class ForgotPasswordPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto("/forgot-password");
  }

  async request(email: string) {
    await this.page.getByLabel("Email", { exact: true }).fill(email);
    await this.page.getByRole("button", { name: "Send reset link" }).click();
  }

  async expectSent(email: string) {
    await expect(
      this.page.getByRole("status").filter({ hasText: "Check your email" }),
    ).toBeVisible();
    await expect(
      this.page.getByText(
        `If there’s an account for ${email}, a reset link is on its way. It works for 30 minutes.`,
      ),
    ).toBeVisible();
  }

  async expectInvalidEmail() {
    await expect(
      this.page
        .getByRole("alert")
        .filter({ hasText: "Enter your email address" }),
    ).toBeVisible();
    await expect(
      this.page.getByText(
        "Enter a valid email address, like name@example.com.",
      ),
    ).toBeVisible();
  }
}

export class ResetPasswordPage {
  constructor(private readonly page: Page) {}

  async openLink(token: string) {
    await this.page.goto(`/reset-password?token=${encodeURIComponent(token)}`);
    await expect(
      this.page.getByRole("heading", {
        level: 1,
        name: "Choose a new password",
      }),
    ).toBeVisible();
  }

  async save(password: string, confirm = password) {
    await this.page.getByLabel("New password", { exact: true }).fill(password);
    await this.page
      .getByLabel("Confirm new password", { exact: true })
      .fill(confirm);
    await this.page.getByRole("button", { name: "Save password" }).click();
  }

  async expectMismatch() {
    const summary = this.page
      .getByRole("alert")
      .filter({ hasText: "Fix 2 things to save" });
    await expect(
      summary.getByRole("link", { name: "Use at least 10 characters." }),
    ).toBeVisible();
    await expect(
      summary.getByRole("link", { name: "The passwords don’t match." }),
    ).toBeVisible();
  }

  async expectUpdated() {
    await expect(
      this.page.getByRole("status").filter({ hasText: "Password updated" }),
    ).toBeVisible();
    await expect(
      this.page.getByText(
        "You’re signed in. Your inspections are one tap away.",
      ),
    ).toBeVisible();
    await expect(
      this.page.getByRole("link", { name: "Go to inspections" }),
    ).toBeVisible();
  }

  async expectExpired() {
    await expect(
      this.page.getByRole("alert").filter({ hasText: "That link has expired" }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("link", { name: "Send a new link" }),
    ).toBeVisible();
  }
}
