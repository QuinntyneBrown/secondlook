import { expect, type Page } from "@playwright/test";

/** The pricing window banner on the dashboard, and the "Add another car" dialog it opens (L2-033, L2-034). */
export class WindowBanner {
  constructor(private readonly page: Page) {}

  private get banner() {
    return this.page.getByRole("region", { name: "Pricing window" });
  }

  async expectOpen(endsOn: string) {
    await expect(
      this.banner.getByText(`Your window is open until ${endsOn}`, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      this.banner.getByText("Add another car to compare for $25 each."),
    ).toBeVisible();
    await expect(
      this.banner.getByRole("button", { name: "Add another car · $25" }),
    ).toBeVisible();
  }

  async expectAdded(vehicle: string, amount: string, count: string) {
    const status = this.page
      .getByRole("status")
      .filter({ hasText: `${vehicle} added for ${amount}` });
    await expect(status).toBeVisible();
    await expect(
      status.getByText(
        `${count} cars are in your window. Compare them side by side when the reports land.`,
      ),
    ).toBeVisible();
  }

  async openAddAnother() {
    await this.banner
      .getByRole("button", { name: "Add another car · $25" })
      .click();
    await expect(this.dialog).toBeVisible();
  }

  private get dialog() {
    return this.page.getByRole("dialog", { name: "Add another car for $25" });
  }

  async expectDialog(note: string) {
    await expect(
      this.dialog.getByText(
        "Compare more cars within your window. We’ll ask for the seller’s details next.",
      ),
    ).toBeVisible();
    for (const name of ["Mechanic", "Body shop", "Both"])
      await expect(
        this.dialog.getByRole("radio", { name: new RegExp(`^${name}`) }),
      ).toBeVisible();
    await expect(this.dialog.getByText("+$20")).toBeVisible();
    await expect(this.dialog.getByText(note)).toBeVisible();
  }

  async continueWithVin(vin: string) {
    await this.dialog
      .getByLabel("VIN of the next car", { exact: true })
      .fill(vin);
    await this.dialog.getByRole("button", { name: "Continue" }).click();
  }

  async continueEmpty() {
    await this.dialog.getByRole("button", { name: "Continue" }).click();
  }

  async expectVinRequired() {
    const field = this.dialog.getByLabel("VIN of the next car", {
      exact: true,
    });
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAccessibleDescription(
      "Enter the full 17-character VIN.",
    );
  }

  async chooseReview(label: "Mechanic" | "Body shop" | "Both") {
    await this.dialog
      .getByRole("radio", { name: new RegExp(`^${label}`) })
      .check();
  }

  async expectCouldNotAdd() {
    const alert = this.dialog
      .getByRole("alert")
      .filter({ hasText: "We couldn’t add the car" });
    await expect(alert).toBeVisible();
    await expect(
      alert.getByText(
        "Your window is still open. Check your connection and try again.",
      ),
    ).toBeVisible();
    await expect(
      alert.getByRole("button", { name: "Try again" }),
    ).toBeVisible();
  }

  async breakWindowCheck() {
    await this.page.route("**/api/pricing-window", (route) =>
      route.abort("connectionrefused"),
    );
  }

  async restoreWindowCheck() {
    await this.page.unroute("**/api/pricing-window");
  }

  async tryAgain() {
    await this.dialog.getByRole("button", { name: "Try again" }).click();
  }
}
