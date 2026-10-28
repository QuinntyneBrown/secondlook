import { test } from "@playwright/test";
import { ShellPage } from "../../pages/ShellPage";

test.describe("Admin shell smoke (J00)", () => {
  // L2-072 AC1: the admin shell starts and reports the real API as ready.
  test("the admin shell reports the API ready", async ({ page }) => {
    const shell = new ShellPage(page);
    await shell.open("/");
    await shell.expectApiReady();
  });

  // L2-060 AC1: unknown admin routes show the not-found state.
  test("an unknown page shows the not-found state", async ({ page }) => {
    const shell = new ShellPage(page);
    await shell.open("/missing");
    await shell.systemState.expectShown(
      "404",
      "We can’t find that page",
      "The link may be old, or the inspection was removed. Head back to your inspections.",
      ["Go to inspections", "Home"],
    );
  });
});
