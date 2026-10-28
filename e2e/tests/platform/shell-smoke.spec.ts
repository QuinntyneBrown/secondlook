import { expect, test } from "@playwright/test";
import { ShellPage } from "../../pages/ShellPage";

const API = "http://localhost:5100";

test.describe("Buyer shell smoke (J00)", () => {
  // L2-072 AC1: the shell starts and reports the real API as ready.
  test("the buyer shell reports the API ready", async ({ page }) => {
    const shell = new ShellPage(page);
    await shell.open("/");
    await shell.expectApiReady();
  });

  // L2-060 AC1 / L2-072 AC2: unknown routes show the 404 system state.
  test("an unknown page shows the not-found state", async ({ page }) => {
    const shell = new ShellPage(page);
    await shell.open("/no/such/page");
    await shell.systemState.expectShown(
      "404",
      "We can’t find that page",
      "The link may be old, or the inspection was removed. Head back to your inspections.",
      ["Go to inspections", "Home"],
    );
  });

  // L2-072 AC5: a system page puts keyboard focus on its heading.
  test("a system page focuses its heading", async ({ page }) => {
    const shell = new ShellPage(page);
    await shell.open("/no/such/page");
    await shell.systemState.expectHeadingFocused("We can’t find that page");
  });

  // L2-059 AC2: forbidden state copy.
  test("the forbidden state explains the inspection is not on the account", async ({
    page,
  }) => {
    const shell = new ShellPage(page);
    await shell.open("/forbidden");
    await shell.systemState.expectShown(
      "403",
      "This inspection isn’t on your account",
      "Only the buyer who booked it can see the report. If someone shared this link with you, ask them to share the report from their account.",
      ["Go to inspections", "Contact support"],
    );
  });

  // L2-060 AC3 and AC4.
  test("the offline and maintenance states are reachable", async ({ page }) => {
    const shell = new ShellPage(page);
    await shell.open("/offline");
    await shell.systemState.expectShown(
      "Offline",
      "You’re not connected",
      "You can still read reports you’ve already opened. Booking and live calls need a connection.",
      ["Try again", "View saved reports"],
    );
    await shell.open("/maintenance");
    await shell.systemState.expectShown(
      "Maintenance",
      "Back in about 20 minutes",
      "We’re updating SecondLook. Inspections booked for tonight will go ahead; we’ll email if anything changes.",
      ["Check status"],
    );
  });

  // L2-060 AC2 / L2-071: when the API fails the shell shows the 500 state and recovers on Try again.
  test("a failing API shows the server-error state and recovers", async ({
    page,
  }) => {
    const shell = new ShellPage(page);
    await shell.breakApi();
    await shell.open("/");
    await shell.systemState.expectShown(
      "500",
      "That one’s on us",
      "Something broke on our side. Your booking and payment are safe. Try again, and if it keeps happening, tell us.",
      ["Try again", "Contact support"],
    );
    await shell.restoreApi();
    await shell.systemState.tryAgain();
    await shell.expectApiReady();
  });

  // L2-069 AC1: the real API refuses anonymous callers.
  test("the API requires authentication", async ({ request }) => {
    expect((await request.get(`${API}/api/platform/me`)).status()).toBe(401);
    expect((await request.get(`${API}/health/live`)).status()).toBe(200);
  });
});
