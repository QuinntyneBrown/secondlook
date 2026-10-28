import { expect, type Locator, type Page } from "@playwright/test";

export interface VehicleValues {
  vin: string;
  km: string;
  price: string;
  url: string;
  name: string;
  phone: string;
}

export class VehiclesPage {
  constructor(private readonly page: Page) {}

  async openFromInspections() {
    await this.page.getByRole("link", { name: "Vehicles" }).click();
    await this.expectLoaded();
  }

  async open() {
    await this.page.goto("/vehicles");
  }

  async expectLoaded() {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Your vehicles" }),
    ).toBeVisible();
  }

  async expectEmpty() {
    await expect(
      this.page.getByRole("heading", { name: "No saved vehicles yet" }),
    ).toBeVisible();
  }

  private row(vin: string): Locator {
    return this.page
      .getByRole("row")
      .filter({ has: this.page.getByRole("rowheader", { name: vin }) });
  }

  async expectVehicle(
    vin: string,
    odometer: string,
    price: string,
    seller: string,
  ) {
    const row = this.row(vin);
    await expect(row).toBeVisible();
    await expect(
      row.getByRole("cell", { name: odometer, exact: true }),
    ).toBeVisible();
    await expect(
      row.getByRole("cell", { name: price, exact: true }),
    ).toBeVisible();
    await expect(
      row.getByRole("cell", { name: seller, exact: true }),
    ).toBeVisible();
  }

  async expectNoVehicle(vin: string) {
    await expect(this.row(vin)).toHaveCount(0);
  }

  async expectLoadFailed() {
    const alert = this.page
      .getByRole("alert")
      .filter({ hasText: "We couldn’t load your vehicles" });
    await expect(alert).toBeVisible();
    await expect(
      alert.getByRole("button", { name: "Try again" }),
    ).toBeVisible();
  }

  async breakList() {
    await this.page.route("**/api/vehicles", (route) =>
      route.abort("connectionrefused"),
    );
  }

  async restoreList() {
    await this.page.unroute("**/api/vehicles");
  }

  async tryAgain() {
    await this.page.getByRole("button", { name: "Try again" }).click();
  }

  // Dialogs
  private dialog(name: string) {
    return this.page.getByRole("dialog", { name });
  }

  async openAdd() {
    await this.page
      .getByRole("button", { name: "Add a vehicle" })
      .first()
      .click();
    await expect(this.dialog("Add a vehicle")).toBeVisible();
  }

  async fill(dialogName: string, v: VehicleValues) {
    const d = this.dialog(dialogName);
    await d.getByLabel("VIN", { exact: true }).fill(v.vin);
    await d.getByLabel("Odometer (km)", { exact: true }).fill(v.km);
    await d.getByLabel("Asking price ($)", { exact: true }).fill(v.price);
    await d.getByLabel("Listing link (optional)", { exact: true }).fill(v.url);
    await d.getByLabel("Seller’s name", { exact: true }).fill(v.name);
    await d.getByLabel("Seller’s phone", { exact: true }).fill(v.phone);
  }

  async save(dialogName: string, button: "Save vehicle" | "Save changes") {
    await this.dialog(dialogName)
      .getByRole("button", { name: button, exact: true })
      .click();
  }

  async expectSummary(dialogName: string, title: string, items: string[]) {
    const summary = this.dialog(dialogName)
      .getByRole("alert")
      .filter({ hasText: title });
    await expect(summary).toBeVisible();
    for (const item of items)
      await expect(summary.getByRole("link", { name: item })).toBeVisible();
  }

  async expectFieldError(dialogName: string, label: string, message: string) {
    const field = this.dialog(dialogName).getByLabel(label, { exact: true });
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAccessibleDescription(message);
  }

  async expectDialogAlert(dialogName: string, title: string) {
    await expect(
      this.dialog(dialogName).getByRole("alert").filter({ hasText: title }),
    ).toBeVisible();
  }

  async cancelDialog(dialogName: string) {
    await this.dialog(dialogName)
      .getByRole("button", { name: "Cancel" })
      .click();
    await expect(this.page.getByRole("dialog")).toBeHidden();
  }

  async expectDialogClosed() {
    await expect(this.page.getByRole("dialog")).toBeHidden();
  }

  async startEdit(vin: string) {
    await this.row(vin).getByRole("button", { name: "Edit" }).click();
    await expect(this.dialog("Edit vehicle")).toBeVisible();
  }

  async startRemove(vin: string) {
    await this.row(vin).getByRole("button", { name: "Remove" }).click();
    const dialog = this.page.getByRole("dialog", { name: /^Remove / });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    return dialog;
  }

  async cancelRemove(vin: string) {
    const dialog = await this.startRemove(vin);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(this.page.getByRole("dialog")).toBeHidden();
  }

  async confirmRemove(vin: string) {
    const dialog = await this.startRemove(vin);
    await dialog.getByRole("button", { name: "Remove", exact: true }).click();
  }
}
