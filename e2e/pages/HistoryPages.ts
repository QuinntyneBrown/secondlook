import { expect, type Page } from "@playwright/test";

/** The dashboard as the buyer's history (L2-019 to L2-022): Active and Past tabs, rows with estimates, pages of twenty. */
export class HistoryPage {
  constructor(private readonly page: Page) {}

  async open(query = "") {
    await this.page.goto(`/inspections${query}`);
  }

  async expectLoaded() {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Your inspections" }),
    ).toBeVisible();
  }

  async expectSubtitle(text: string | RegExp) {
    await expect(this.page.getByText(text)).toBeVisible();
  }

  async expectTabs(active: number, past: number) {
    await expect(
      this.page.getByRole("tab", { name: `Active ${active}` }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("tab", { name: `Past ${past}` }),
    ).toBeVisible();
  }

  async expectSelected(tab: "Active" | "Past") {
    await expect(
      this.page.getByRole("tab", { name: new RegExp(`^${tab}`) }),
    ).toHaveAttribute("aria-selected", "true");
  }

  async selectTab(tab: "Active" | "Past") {
    await this.page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
  }

  private row(vin: string) {
    return this.page
      .getByRole("listitem")
      .filter({ has: this.page.getByRole("link", { name: vin }) });
  }

  async expectRow(
    vin: string,
    row: { chip: string | RegExp; estimate?: string; meta?: string },
  ) {
    const r = this.row(vin);
    await expect(r).toBeVisible();
    await expect(r.getByText(row.chip)).toBeVisible();
    if (row.estimate) await expect(r.getByText(row.estimate)).toBeVisible();
    if (row.meta) await expect(r).toContainText(row.meta);
  }

  async expectNoRow(vin: string) {
    await expect(this.row(vin)).toHaveCount(0);
  }

  async expectRowCount(count: number) {
    await expect(
      this.page.getByRole("list", { name: "Inspections" }).getByRole("listitem"),
    ).toHaveCount(count);
  }

  async openRow(vin: string) {
    await this.page.getByRole("link", { name: vin }).click();
  }

  async expectOnReport() {
    await this.page.waitForURL(/\/inspections\/[^/]+\/report$/);
  }

  async expectOnDetail() {
    await this.page.waitForURL(/\/inspections\/[^/]+$/);
  }

  /** The detail of a cancelled inspection keeps what it was booked with: the car and the refund (L2-035). */
  async expectCancelledDetail(vin: string) {
    await expect(this.page.getByRole("heading", { level: 1, name: vin })).toBeVisible();
    await expect(this.page.getByText(/^Cancelled · refunded /)).toBeVisible();
    await expect(this.page.getByRole("link", { name: "Rebook this car" })).toBeVisible();
  }

  async goBack() {
    await this.page.goBack();
  }

  // Pages ---------------------------------------------------------------------------------------

  async expectPagination(showing: string, options: { previous: boolean; next: boolean }) {
    const nav = this.page.getByRole("navigation", { name: "Pagination" });
    await expect(nav.getByText(showing)).toBeVisible();
    const previous = nav.getByRole("button", { name: "Previous" });
    const next = nav.getByRole("button", { name: "Next" });
    if (options.previous) await expect(previous).toBeEnabled();
    else await expect(previous).toBeDisabled();
    if (options.next) await expect(next).toBeEnabled();
    else await expect(next).toBeDisabled();
  }

  async expectNoPagination() {
    await expect(this.page.getByRole("navigation", { name: "Pagination" })).toHaveCount(0);
  }

  async next() {
    await this.page.getByRole("navigation", { name: "Pagination" }).getByRole("button", { name: "Next" }).click();
  }

  async previous() {
    await this.page.getByRole("navigation", { name: "Pagination" }).getByRole("button", { name: "Previous" }).click();
  }

  // States --------------------------------------------------------------------------------------

  async expectEmpty() {
    await expect(this.page.getByText("Nothing booked yet")).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "No inspections yet" })).toBeVisible();
    await expect(
      this.page.getByText(
        "Book a mechanic to look at a car over video. Your first inspection is $50 and you get a cost estimate within an hour.",
      ),
    ).toBeVisible();
    await expect(this.page.getByRole("link", { name: "Book an inspection" }).first()).toBeVisible();
    await expect(this.page.getByRole("link", { name: "View sample report" })).toBeVisible();
  }

  async viewSampleReport() {
    await this.page.getByRole("link", { name: "View sample report" }).click();
    await this.page.waitForURL(/\/sample-report$/);
  }

  async expectSampleReport() {
    await expect(this.page.getByRole("heading", { level: 1, name: "Sample report" })).toBeVisible();
    await expect(
      this.page.getByRole("heading", { name: "Estimated cost to get it safety certified" }),
    ).toBeVisible();
    await expect(this.page.getByText("This is an example with made-up details.")).toBeVisible();
  }

  async expectEmptyTab(text: string) {
    await expect(this.page.getByText(text)).toBeVisible();
  }

  /** Makes the history request fail the way a dropped connection would, once. */
  async failLoadOnce() {
    let failed = false;
    await this.page.route(/\/api\/inspections\/history/, async (route) => {
      if (!failed) {
        failed = true;
        await route.abort();
      } else await route.continue();
    });
  }

  async expectLoadFailed() {
    const alert = this.page
      .getByRole("alert")
      .filter({ hasText: "Your inspections didn’t load" });
    await expect(alert).toBeVisible();
    await expect(
      alert.getByText("This is on our side. Your bookings are safe. Try again, or check back in a minute."),
    ).toBeVisible();
    await expect(alert.getByRole("link", { name: "Contact support" })).toBeVisible();
  }

  async tryAgain() {
    await this.page.getByRole("button", { name: "Try again" }).click();
  }

  /** Slows the history request so the busy state can be seen. */
  async slowLoad() {
    await this.page.route(/\/api\/inspections\/history/, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
  }

  async expectLoading() {
    await expect(
      this.page.getByText("Loading your inspections", { exact: true }),
    ).toBeVisible();
    await expect(this.page.getByRole("list", { name: "Inspections" })).toHaveAttribute("aria-busy", "true");
  }
}
