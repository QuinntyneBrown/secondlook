import { test } from "@playwright/test";
import { AdminSignInPage, ProvidersPage } from "../../pages/AdminPages";

const ADMIN = "admin@example.test";
const PASSWORD = "Password-123!";
const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function signInAsAdmin(page: import("@playwright/test").Page) {
  const signIn = new AdminSignInPage(page);
  await signIn.open();
  await signIn.signIn(ADMIN, PASSWORD);
  await new ProvidersPage(page).expectLoaded();
}

test.describe("Administer providers (J02)", () => {
  // L2-064 AC4: an administrator signs in and sees the seeded providers.
  test("the provider list shows seeded providers", async ({ page }) => {
    await signInAsAdmin(page);
    const providers = new ProvidersPage(page);
    await providers.expectProvider("Maya Mechanic", "Mechanic", "Approved");
    await providers.expectProvider("Bo Bodyshop", "BodyShop", "Approved");
  });

  // L2-064 AC1, AC5, AC6: onboard validates, then adds a pending provider.
  test("an administrator onboards a provider", async ({ page }) => {
    await signInAsAdmin(page);
    const providers = new ProvidersPage(page);
    const name = `Pat Wrench ${unique()}`;

    await providers.openOnboard();
    await providers.fillOnboard({
      name: "",
      email: "pat@",
      licence: "",
      location: "Hamilton, ON",
    });
    await providers.submitOnboard();
    await providers.expectOnboardSummary("Fix 3 things to continue", [
      "Enter the provider’s name.",
      "Enter a valid email address.",
      "Enter the licence number.",
    ]);

    await providers.fillOnboard({
      kind: "Mechanic",
      name,
      email: `pat.${unique()}@example.test`,
      licence: "310T-99999",
      location: "Hamilton, ON",
    });
    await providers.submitOnboard();
    await providers.expectOnboardClosed();
    await providers.expectProvider(name, "Mechanic", "Pending");

    await providers.filterByStatus("Approved");
    await providers.expectNoProvider(name);
    await providers.filterByStatus("Pending");
    await providers.expectProvider(name, "Mechanic", "Pending");
  });

  // L2-064 AC2, AC3, AC5, AC8: approve, then deactivate (cancel keeps it), then approve again.
  test("an administrator approves, deactivates and reactivates a provider", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    const providers = new ProvidersPage(page);
    const name = `Rae Gear ${unique()}`;
    await providers.openOnboard();
    await providers.fillOnboard({
      kind: "BodyShop",
      name,
      email: `rae.${unique()}@example.test`,
      licence: "BS-1",
      location: "Burlington, ON",
    });
    await providers.submitOnboard();
    await providers.expectProvider(name, "BodyShop", "Pending");

    await providers.approve(name);
    await providers.expectProvider(name, "BodyShop", "Approved");

    await providers.cancelDeactivate(name);
    await providers.expectProvider(name, "BodyShop", "Approved");

    await providers.confirmDeactivate(name);
    await providers.expectProvider(name, "BodyShop", "Deactivated");

    await providers.approve(name);
    await providers.expectProvider(name, "BodyShop", "Approved");
  });

  // L2-064 AC7: only administrators; others see the forbidden state, signed-out visitors go to sign-in.
  test("a buyer cannot use the provider list", async ({ page }) => {
    const signIn = new AdminSignInPage(page);
    await signIn.open();
    await signIn.signIn("buyer@example.test", PASSWORD);
    await new ProvidersPage(page).expectAdministratorsOnly();
  });

  test("a signed-out visitor is sent to sign in", async ({ page }) => {
    const providers = new ProvidersPage(page);
    await providers.open();
    await providers.expectRedirectedToSignIn();
  });

  test("a wrong password is rejected", async ({ page }) => {
    const signIn = new AdminSignInPage(page);
    await signIn.open();
    await signIn.signIn(ADMIN, "not-the-password");
    await signIn.expectRejected();
  });

  // L2-064 AC4: a failed load offers Try again.
  test("a failed provider load can be retried", async ({ page }) => {
    await signInAsAdmin(page);
    const providers = new ProvidersPage(page);
    await providers.breakProviderList();
    await page.reload();
    await providers.expectLoadFailed();
    await providers.restoreProviderList();
    await providers.tryAgain();
    await providers.expectLoaded();
  });
});
