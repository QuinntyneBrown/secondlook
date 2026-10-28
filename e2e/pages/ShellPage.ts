import { expect, type Page } from "@playwright/test";

/** A system-state screen (404, 403, 500, offline, maintenance) of either shell. */
export class SystemStatePage {
  constructor(private readonly page: Page) {}

  async expectShown(
    code: string,
    title: string,
    text: string,
    actions: string[],
  ) {
    await expect(this.page.getByText(code, { exact: true })).toBeVisible();
    await expect(
      this.page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible();
    await expect(this.page.getByText(text)).toBeVisible();
    for (const action of actions) {
      await expect(
        this.page.getByRole(
          /^(Try again|Check status)$/.test(action) ? "button" : "link",
          { name: action },
        ),
      ).toBeVisible();
    }
  }

  async expectHeadingFocused(title: string) {
    await expect(
      this.page.getByRole("heading", { level: 1, name: title }),
    ).toBeFocused();
  }

  async tryAgain() {
    await this.page.getByRole("button", { name: "Try again" }).click();
  }
}

/** The landing screen of the buyer or admin shell, which reports API readiness. */
export class ShellPage {
  readonly systemState: SystemStatePage;
  constructor(private readonly page: Page) {
    this.systemState = new SystemStatePage(page);
  }

  async open(path = "/") {
    await this.page.goto(path);
  }

  async expectApiReady() {
    await expect(this.page.getByRole("status")).toHaveText(/The API is ready/);
  }

  /** Makes the next readiness checks fail the way a dead API would, until `restoreApi`. */
  async breakApi() {
    await this.page.route("**/health/ready", (route) =>
      route.abort("connectionrefused"),
    );
  }

  async restoreApi() {
    await this.page.unroute("**/health/ready");
  }
}
