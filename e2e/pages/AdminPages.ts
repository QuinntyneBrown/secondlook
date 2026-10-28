import { expect, type Locator, type Page } from "@playwright/test";

export class AdminSignInPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto("/sign-in");
  }

  async signIn(email: string, password: string) {
    await this.page.getByLabel("Email", { exact: true }).fill(email);
    await this.page.getByLabel("Password", { exact: true }).fill(password);
    await this.page.getByRole("button", { name: "Sign in" }).click();
  }

  async expectRejected() {
    await expect(
      this.page
        .getByRole("alert")
        .filter({ hasText: "That email and password don’t match" }),
    ).toBeVisible();
  }
}

export class ProvidersPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto("/providers");
  }

  async expectLoaded() {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Providers" }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("table", { name: "Mechanics and body shops" }),
    ).toBeVisible();
  }

  private row(name: string): Locator {
    return this.page
      .getByRole("row")
      .filter({ has: this.page.getByRole("rowheader", { name }) });
  }

  async expectProvider(name: string, kind: string, status: string) {
    const row = this.row(name);
    await expect(row).toBeVisible();
    await expect(
      row.getByRole("cell", { name: kind, exact: true }),
    ).toBeVisible();
    await expect(
      row.getByRole("cell", { name: status, exact: true }),
    ).toBeVisible();
  }

  async expectNoProvider(name: string) {
    await expect(this.row(name)).toHaveCount(0);
  }

  async filterByStatus(status: string) {
    await this.page.getByLabel("Status", { exact: true }).selectOption(status);
  }

  async expectNoMatches() {
    await expect(
      this.page.getByRole("heading", { name: "No providers match" }),
    ).toBeVisible();
  }

  // Onboard dialog
  async openOnboard() {
    await this.page
      .getByRole("button", { name: "Onboard provider" })
      .first()
      .click();
    await expect(
      this.page.getByRole("dialog", { name: "Onboard a provider" }),
    ).toBeVisible();
  }

  private get onboardDialog() {
    return this.page.getByRole("dialog", { name: "Onboard a provider" });
  }

  async fillOnboard(values: {
    kind?: string;
    name: string;
    email: string;
    licence: string;
    location: string;
  }) {
    const d = this.onboardDialog;
    if (values.kind)
      await d.getByLabel("Kind", { exact: true }).selectOption(values.kind);
    await d.getByLabel("Name", { exact: true }).fill(values.name);
    await d.getByLabel("Email", { exact: true }).fill(values.email);
    await d.getByLabel("Licence number", { exact: true }).fill(values.licence);
    await d.getByLabel("Location", { exact: true }).fill(values.location);
  }

  async submitOnboard() {
    await this.onboardDialog
      .getByRole("button", { name: "Onboard provider" })
      .click();
  }

  async expectOnboardSummary(title: string, items: string[]) {
    const summary = this.onboardDialog
      .getByRole("alert")
      .filter({ hasText: title });
    await expect(summary).toBeVisible();
    for (const item of items)
      await expect(summary.getByRole("link", { name: item })).toBeVisible();
  }

  async expectOnboardClosed() {
    await expect(this.page.getByRole("dialog")).toBeHidden();
  }

  async cancelOnboard() {
    await this.onboardDialog.getByRole("button", { name: "Cancel" }).click();
  }

  // Approve / deactivate dialogs
  async approve(name: string) {
    await this.row(name)
      .getByRole("button", { name: /^Approve/ })
      .click();
    const dialog = this.page.getByRole("dialog", { name: `Approve ${name}?` });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Approve" }).click();
  }

  async startDeactivate(name: string) {
    await this.row(name).getByRole("button", { name: "Deactivate" }).click();
    const dialog = this.page.getByRole("dialog", {
      name: `Deactivate ${name}?`,
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    return dialog;
  }

  async confirmDeactivate(name: string) {
    const dialog = await this.startDeactivate(name);
    await dialog.getByRole("button", { name: "Deactivate" }).click();
  }

  async cancelDeactivate(name: string) {
    const dialog = await this.startDeactivate(name);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(this.page.getByRole("dialog")).toBeHidden();
  }

  // Failure and access states
  async breakProviderList() {
    await this.page.route("**/api/admin/providers**", (route) =>
      route.abort("connectionrefused"),
    );
  }

  async restoreProviderList() {
    await this.page.unroute("**/api/admin/providers**");
  }

  async expectLoadFailed() {
    const alert = this.page
      .getByRole("alert")
      .filter({ hasText: "We couldn’t load the providers" });
    await expect(alert).toBeVisible();
    await expect(
      alert.getByRole("button", { name: "Try again" }),
    ).toBeVisible();
  }

  async tryAgain() {
    await this.page.getByRole("button", { name: "Try again" }).click();
  }

  async expectAdministratorsOnly() {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Administrators only" }),
    ).toBeVisible();
  }

  async expectRedirectedToSignIn() {
    await expect(this.page).toHaveURL(/\/sign-in$/);
  }
}
