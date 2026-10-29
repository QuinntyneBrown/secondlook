import { expect, type Page } from "@playwright/test";
import { slotLabels } from "./BookingPages";

export class ManageInspectionPage {
  constructor(private readonly page: Page) {}

  async open(id: string) {
    await this.page.goto(`/inspections/${id}`);
  }

  async expectScheduled(startIso: string) {
    const l = slotLabels(startIso);
    await expect(
      this.page.getByText(`Scheduled · ${l.day}, ${l.time}`),
    ).toBeVisible();
  }

  // Reschedule
  private get rescheduleDialog() {
    return this.page.getByRole("dialog", { name: "Pick a new time" });
  }

  async openReschedule() {
    await this.page.getByRole("button", { name: "Reschedule" }).click();
    await expect(this.rescheduleDialog).toBeVisible();
  }

  async expectRescheduleIntro(mechanic: string) {
    await expect(
      this.rescheduleDialog.getByText(
        `${mechanic} is free at these times. The seller gets a new text.`,
      ),
    ).toBeVisible();
  }

  async submitReschedule() {
    await this.rescheduleDialog
      .getByRole("button", { name: "Reschedule", exact: true })
      .click();
  }

  async expectChooseTime() {
    await expect(
      this.rescheduleDialog.getByText("Choose a new time."),
    ).toBeVisible();
  }

  async chooseNewTime(startIso: string) {
    const l = slotLabels(startIso);
    await this.rescheduleDialog
      .getByRole("button", { name: l.day, exact: true })
      .click();
    await this.rescheduleDialog
      .getByRole("button", { name: l.time, exact: true })
      .click();
  }

  async expectCouldNotMove() {
    const alert = this.rescheduleDialog
      .getByRole("alert")
      .filter({ hasText: "We couldn’t move the call" });
    await expect(alert).toBeVisible();
    await expect(
      alert.getByText("Your original time is still booked. Try again."),
    ).toBeVisible();
    await expect(
      alert.getByRole("button", { name: "Try again" }),
    ).toBeVisible();
  }

  async expectRescheduled(startIso: string, seller: string) {
    const l = slotLabels(startIso);
    const toast = this.page
      .getByRole("status")
      .filter({ hasText: `Rescheduled to ${l.day}, ${l.time}` });
    await expect(toast).toBeVisible();
    await expect(
      toast.getByText(`${seller} has a new text with the time.`),
    ).toBeVisible();
  }

  async undo() {
    await this.page.getByRole("button", { name: "Undo" }).click();
  }

  // Cancel
  private get cancelDialog() {
    return this.page.getByRole("dialog", {
      name: /^Cancel the .* inspection\?$/,
    });
  }

  async openCancel() {
    await this.page.getByRole("button", { name: "Cancel inspection" }).click();
    await expect(this.cancelDialog).toBeVisible();
  }

  async expectCancelDialog(slotText: string, refund: string, card: string) {
    await expect(
      this.cancelDialog.getByRole("button", { name: "Keep inspection" }),
    ).toBeFocused();
    await expect(this.cancelDialog.getByText(slotText)).toBeVisible();
    await expect(this.cancelDialog.getByText(refund)).toBeVisible();
    await expect(
      this.cancelDialog.getByText(`full refund to the card ending ${card}`, {
        exact: false,
      }),
    ).toBeVisible();
    for (const reason of [
      "I bought a different car",
      "The seller backed out",
      "The price changed",
      "Something else",
    ])
      await expect(
        this.cancelDialog.getByRole("radio", { name: reason }),
      ).toBeVisible();
  }

  async confirmCancel() {
    await this.cancelDialog
      .getByRole("button", { name: "Cancel inspection" })
      .click();
  }

  async expectReasonRequired() {
    await expect(
      this.cancelDialog.getByText("Choose a reason so we can improve."),
    ).toBeVisible();
  }

  async chooseReason(reason: string) {
    await this.cancelDialog.getByRole("radio", { name: reason }).check();
  }

  async expectCancelled(
    on: string,
    refunded: string,
    card: string,
    chip: string,
  ) {
    await expect(this.page.getByText(`Cancelled on ${on}`)).toBeVisible();
    await expect(
      this.page.getByText(
        `We refunded ${refunded} to the card ending ${card}. Rebook any time; your answers are saved.`,
      ),
    ).toBeVisible();
    await expect(this.page.getByText(chip)).toBeVisible();
    await expect(
      this.page.getByRole("link", { name: "Rebook this car" }),
    ).toBeVisible();
    for (const name of ["Join the call", "Reschedule", "Cancel inspection"])
      await expect(this.page.getByRole("button", { name })).toHaveCount(0);
  }

  async openPastTab() {
    await this.page.getByRole("tab", { name: "Past" }).click();
  }

  async expectInPast(vehicle: string) {
    await expect(
      this.page.getByRole("list", { name: "Inspections" }).getByRole("listitem").filter({ hasText: vehicle }),
    ).toBeVisible();
  }
}
