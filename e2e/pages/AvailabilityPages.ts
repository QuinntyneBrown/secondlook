import { expect, type Locator, type Page } from "@playwright/test";

export class AvailabilityPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto("/availability");
  }

  async expectLoaded() {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Your availability" }),
    ).toBeVisible();
  }

  private row(day: string): Locator {
    return this.page
      .getByRole("row")
      .filter({ has: this.page.getByRole("rowheader", { name: day }) });
  }

  async expectWindow(day: string, hours: string, slots: string) {
    const row = this.row(day);
    await expect(row).toBeVisible();
    await expect(
      row.getByRole("cell", { name: hours, exact: true }),
    ).toBeVisible();
    await expect(
      row.getByRole("cell", { name: slots, exact: true }),
    ).toBeVisible();
  }

  async expectNoWindow(day: string) {
    await expect(this.row(day)).toHaveCount(0);
  }

  async expectNotApproved() {
    await expect(
      this.page
        .getByRole("status")
        .filter({ hasText: "Your account isn’t approved yet" }),
    ).toBeVisible();
  }

  async expectProvidersOnly() {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Providers only" }),
    ).toBeVisible();
  }

  async expectLoadFailed() {
    const alert = this.page
      .getByRole("alert")
      .filter({ hasText: "We couldn’t load your availability" });
    await expect(alert).toBeVisible();
    await expect(
      alert.getByRole("button", { name: "Try again" }),
    ).toBeVisible();
  }

  async breakList() {
    await this.page.route("**/api/availability", (route) =>
      route.abort("connectionrefused"),
    );
  }

  async restoreList() {
    await this.page.unroute("**/api/availability");
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
      .getByRole("button", { name: "Add availability" })
      .first()
      .click();
    await expect(this.dialog("Add availability")).toBeVisible();
  }

  async fillWindow(
    dialogName: string,
    day: string,
    start: string,
    end: string,
  ) {
    const d = this.dialog(dialogName);
    await d.getByLabel("Day", { exact: true }).fill(day);
    await d.getByLabel("Start (Eastern Time)", { exact: true }).fill(start);
    await d.getByLabel("End (Eastern Time)", { exact: true }).fill(end);
  }

  async saveWindow(dialogName: string, button: "Save" | "Save changes") {
    await this.dialog(dialogName)
      .getByRole("button", { name: button, exact: true })
      .click();
  }

  async expectDialogSummary(
    dialogName: string,
    title: string,
    items: string[],
  ) {
    const summary = this.dialog(dialogName)
      .getByRole("alert")
      .filter({ hasText: title });
    await expect(summary).toBeVisible();
    for (const item of items)
      await expect(summary.getByRole("link", { name: item })).toBeVisible();
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

  async addWindow(day: string, start: string, end: string) {
    await this.openAdd();
    await this.fillWindow("Add availability", day, start, end);
    await this.saveWindow("Add availability", "Save");
  }

  async startEdit(dayLabel: string) {
    await this.row(dayLabel).getByRole("button", { name: "Edit" }).click();
    await expect(this.dialog("Edit availability")).toBeVisible();
  }

  async startRemove(dayLabel: string) {
    await this.row(dayLabel).getByRole("button", { name: "Remove" }).click();
    const dialog = this.page.getByRole("dialog", { name: /^Remove / });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    return dialog;
  }

  async cancelRemove(dayLabel: string) {
    const dialog = await this.startRemove(dayLabel);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(this.page.getByRole("dialog")).toBeHidden();
  }

  async confirmRemove(dayLabel: string) {
    const dialog = await this.startRemove(dayLabel);
    await dialog.getByRole("button", { name: "Remove", exact: true }).click();
  }

  async expectOnPage() {
    await expect(this.page).toHaveURL(/\/availability$/);
  }
}
