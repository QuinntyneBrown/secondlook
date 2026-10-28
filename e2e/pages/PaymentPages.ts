import { expect, type Locator, type Page } from "@playwright/test";

export interface CardValues {
  number: string;
  expiry: string;
  security: string;
  name: string;
  postal: string;
}

export const VISA: CardValues = {
  number: "4242 4242 4242 4242",
  expiry: "12 / 34",
  security: "123",
  name: "Jordan Lee",
  postal: "L8P 1A1",
};

export class CheckoutPage {
  constructor(private readonly page: Page) {}

  async open(review: "Mechanic" | "BodyShop" | "Both" = "Mechanic") {
    await this.page.goto(`/checkout?review=${review}`);
  }

  async expectLoaded(payLabel: string) {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Pay now" }),
    ).toBeVisible();
    await expect(
      this.page.getByText(
        "Pay now. If the seller doesn’t join, you’re refunded in full.",
      ),
    ).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: payLabel, exact: true }),
    ).toBeVisible();
    await expect(this.page.getByRole("button", { name: "Back" })).toBeVisible();
  }

  async expectOrder(lines: string[], total: string) {
    const order = this.page.getByRole("region", { name: "Your order" });
    for (const line of lines)
      await expect(order.getByText(line, { exact: true })).toBeVisible();
    await expect(
      order.getByText(`Total ${total}`, { exact: true }),
    ).toBeVisible();
  }

  async fillCard(card: CardValues, confirmSeller = true) {
    await this.page
      .getByLabel("Card number", { exact: true })
      .fill(card.number);
    await this.page.getByLabel("Expiry", { exact: true }).fill(card.expiry);
    await this.page
      .getByLabel("Security code", { exact: true })
      .fill(card.security);
    await this.page.getByLabel("Name on card", { exact: true }).fill(card.name);
    await this.page
      .getByLabel("Postal code", { exact: true })
      .fill(card.postal);
    const box = this.page.getByRole("checkbox", {
      name: /I’ve told the seller about the video call/,
    });
    if (confirmSeller) await box.check();
  }

  async pay(label: string) {
    await this.page.getByRole("button", { name: label, exact: true }).click();
  }

  async expectSummary(title: string, items: string[]) {
    const summary = this.page.getByRole("alert").filter({ hasText: title });
    await expect(summary).toBeVisible();
    for (const item of items)
      await expect(summary.getByRole("link", { name: item })).toBeVisible();
  }

  async expectDeclined(amount: string) {
    const alert = this.page
      .getByRole("alert")
      .filter({ hasText: "Your card was declined" });
    await expect(alert).toBeVisible();
    await expect(
      alert.getByText(
        `Your bank didn’t approve ${amount}. Try another card, or call the number on the back of this one. You haven’t been charged.`,
      ),
    ).toBeVisible();
    await expect(
      alert.getByRole("button", { name: "Add a different card" }),
    ).toBeVisible();
  }

  async addDifferentCard() {
    await this.page
      .getByRole("button", { name: "Add a different card" })
      .click();
    await expect(
      this.page.getByLabel("Card number", { exact: true }),
    ).toBeFocused();
  }

  async expectBankApproval(amount: string) {
    const status = this.page
      .getByRole("status")
      .filter({ hasText: "Confirm with your bank" });
    await expect(status).toBeVisible();
    await expect(
      status.getByText(
        `Your bank may ask you to approve ${amount} in its app.`,
      ),
    ).toBeVisible();
  }

  async expectPaid(amount: string, last4: string) {
    const status = this.page
      .getByRole("status")
      .filter({ hasText: "Payment received" });
    await expect(status).toBeVisible();
    await expect(
      status.getByText(
        `You paid ${amount} with Visa ending ${last4}. Your receipt is in billing history.`,
      ),
    ).toBeVisible();
  }

  async openBillingFromReceipt() {
    await this.page.getByRole("link", { name: "View billing history" }).click();
  }
}

export class BillingPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto("/billing");
  }

  async expectLoaded() {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Billing history" }),
    ).toBeVisible();
    await expect(
      this.page.getByText("Receipts for every inspection."),
    ).toBeVisible();
  }

  async expectEmpty() {
    await expect(
      this.page.getByRole("heading", { name: "No receipts yet" }),
    ).toBeVisible();
    await expect(
      this.page.getByText("Receipts appear here after your first booking."),
    ).toBeVisible();
    await expect(
      this.page.getByRole("link", { name: "Book an inspection" }),
    ).toBeVisible();
  }

  private row(text: string): Locator {
    return this.page.getByRole("row").filter({
      has: this.page.getByRole("cell", { name: text, exact: true }),
    });
  }

  async expectReceipt(forWhat: string, amount: string, status: string) {
    const row = this.row(forWhat);
    await expect(row).toBeVisible();
    await expect(
      row.getByRole("cell", { name: amount, exact: true }),
    ).toBeVisible();
    await expect(
      row.getByRole("cell", { name: status, exact: true }),
    ).toBeVisible();
    await expect(
      row.getByRole("button", { name: /^Download receipt/ }),
    ).toBeVisible();
  }

  async expectLoadFailed() {
    const alert = this.page
      .getByRole("alert")
      .filter({ hasText: "Receipts didn’t load" });
    await expect(alert).toBeVisible();
    await expect(
      alert.getByText("Your payments are safe. Try again."),
    ).toBeVisible();
    await expect(
      alert.getByRole("button", { name: "Try again" }),
    ).toBeVisible();
  }

  async breakList() {
    await this.page.route("**/api/billing/receipts", (route) =>
      route.abort("connectionrefused"),
    );
  }

  async restoreList() {
    await this.page.unroute("**/api/billing/receipts");
  }

  async tryAgain() {
    await this.page.getByRole("button", { name: "Try again" }).click();
  }
}
