import { expect, type Page } from "@playwright/test";

/** The "Compare cars" page (L2-051, L2-052): the buyer's cars from one window, side by side. */
export class ComparePage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto("/compare");
  }

  async openFromNav() {
    await this.page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Compare" })
      .click();
    await this.page.waitForURL(/\/compare$/);
  }

  async expectLoaded(cars: number) {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Compare cars" }),
    ).toBeVisible();
    await expect(
      this.page.getByText(`Same window, ${cars} reports. Lowest all-in first.`),
    ).toBeVisible();
  }

  private get list() {
    return this.page.getByRole("list", { name: "Cars" });
  }

  private column(vin: string) {
    return this.list.getByRole("listitem").filter({ hasText: vin });
  }

  async expectOrder(vins: string[]) {
    const items = this.list.getByRole("listitem");
    await expect(items).toHaveCount(vins.length);
    for (const [n, vin] of vins.entries())
      await expect(items.nth(n)).toContainText(vin);
  }

  async expectReady(
    vin: string,
    column: { allIn: string; asking: string; certify: string; lowest: boolean },
  ) {
    const c = this.column(vin);
    await expect(c).toContainText("All-in, asking price plus certification");
    await expect(c).toContainText(column.allIn);
    await expect(c).toContainText(`Asking ${column.asking}`);
    await expect(c).toContainText(`To certify ${column.certify}`);
    if (column.lowest) await expect(c).toContainText("Lowest all-in");
    else await expect(c).not.toContainText("Lowest all-in");
    await expect(c.getByRole("link", { name: "View report" })).toBeVisible();
  }

  async expectPending(vin: string) {
    const c = this.column(vin);
    await expect(c).toContainText("Estimate not ready yet");
    await expect(c).toContainText("The mechanic is still writing it.");
    await expect(c).not.toContainText("All-in, asking price plus certification");
  }

  async expectNoEstimate(vin: string) {
    await expect(this.column(vin)).toContainText("No certification estimate");
  }

  async expectNote() {
    await expect(
      this.page.getByText(
        "Costs are estimates from each mechanic’s call. The cheapest car all-in isn’t always the best car. That’s your decision.",
      ),
    ).toBeVisible();
  }

  async viewReport(vin: string) {
    await this.column(vin).getByRole("link", { name: "View report" }).click();
    await this.page.waitForURL(/\/inspections\/[^/]+\/report$/);
  }

  async expectOneCar() {
    await expect(
      this.page.getByRole("heading", { name: "Compare needs two cars" }),
    ).toBeVisible();
    await expect(
      this.page.getByText(
        "You’ve only had one inspection. Add another car in this window for $25 and we’ll line them up.",
      ),
    ).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: "Add a second car" }),
    ).toBeVisible();
  }

  async expectNoCars() {
    await expect(
      this.page.getByRole("heading", { name: "Compare needs two cars" }),
    ).toBeVisible();
    await expect(
      this.page.getByText("You haven’t had an inspection yet."),
    ).toBeVisible();
    await expect(
      this.page.getByRole("link", { name: "Book an inspection" }),
    ).toBeVisible();
  }

  async addSecondCar() {
    await this.page.getByRole("button", { name: "Add a second car" }).click();
    await this.expectAddAnotherDialog();
  }

  async addAnother() {
    await this.page
      .getByRole("button", { name: "Add another car · $25" })
      .click();
    await this.expectAddAnotherDialog();
  }

  private async expectAddAnotherDialog() {
    await expect(
      this.page.getByRole("dialog", { name: "Add another car for $25" }),
    ).toBeVisible();
  }

  /** Makes the comparison request fail the way a dropped connection would, once. */
  async failLoadOnce() {
    let failed = false;
    await this.page.route(/\/api\/comparisons$/, async (route) => {
      if (!failed) {
        failed = true;
        await route.abort();
      } else await route.continue();
    });
  }

  async expectLoadFailed() {
    const alert = this.page
      .getByRole("alert")
      .filter({ hasText: "The comparison didn’t load" });
    await expect(alert).toBeVisible();
    await expect(alert.getByText("Your reports are fine. Try again.")).toBeVisible();
  }

  async tryAgain() {
    await this.page.getByRole("button", { name: "Try again" }).click();
  }

  /** Slows the comparison request so the busy state can be seen. */
  async slowLoad() {
    await this.page.route(/\/api\/comparisons$/, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
  }

  private get region() {
    return this.page.getByRole("region", { name: "Comparison" });
  }

  async expectBusy() {
    await expect(this.region).toHaveAttribute("aria-busy", "true");
  }

  async expectNotBusy() {
    await expect(this.region).not.toHaveAttribute("aria-busy", "true");
  }

  /** On a narrow screen the cars stack one under another and the page does not scroll sideways (L2-051). */
  async expectStackedWithoutSideScroll() {
    await expect
      .poll(() =>
        this.page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    const items = this.list.getByRole("listitem");
    const first = await items.nth(0).boundingBox();
    const second = await items.nth(1).boundingBox();
    expect(first && second && first.x === second.x && second.y > first.y).toBe(true);
  }

  async expectNoVin(vin: string) {
    await expect(this.page.getByText(vin)).toHaveCount(0);
  }
}
