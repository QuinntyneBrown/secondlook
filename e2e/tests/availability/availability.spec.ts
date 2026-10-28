import { test } from "@playwright/test";
import {
  InspectionsPage,
  SignInPage,
  emailedToken,
} from "../../pages/AccountPages";
import { AvailabilityPage } from "../../pages/AvailabilityPages";

const PASSWORD = "Password-123!";
const API = "http://localhost:5100";

test.describe("Manage availability (J03)", () => {
  // L2-061 AC1, AC3, AC4: a provider adds, edits and removes a window through dialogs.
  test("a mechanic adds, edits and removes availability", async ({ page }) => {
    await new SignInPage(page).open();
    await new SignInPage(page).signIn("mechanic@example.test", PASSWORD);
    const availability = new AvailabilityPage(page);
    await availability.expectOnPage();
    await availability.expectLoaded();

    // Invalid: start off the half hour and end before start.
    await availability.openAdd();
    await availability.fillWindow(
      "Add availability",
      "2031-05-05",
      "14:10",
      "13:00",
    );
    await availability.saveWindow("Add availability", "Save");
    await availability.expectDialogSummary(
      "Add availability",
      "Fix 2 things to continue",
      ["Start on the hour or half hour.", "End must be after the start."],
    );

    await availability.fillWindow(
      "Add availability",
      "2031-05-05",
      "14:00",
      "18:00",
    );
    await availability.saveWindow("Add availability", "Save");
    await availability.expectDialogClosed();
    await availability.expectWindow(
      "Mon 5 May 2031",
      "2:00 PM – 6:00 PM",
      "8 slots",
    );

    // Overlap is refused and the dialog keeps what was typed.
    await availability.addWindow("2031-05-05", "17:00", "19:00");
    await availability.expectDialogAlert(
      "Add availability",
      "That overlaps another window",
    );
    await availability.cancelDialog("Add availability");

    // Leave nothing behind so the spec can run again against the same database.
    await availability.confirmRemove("Mon 5 May 2031");
    await availability.expectNoWindow("Mon 5 May 2031");
  });

  test("edit and remove keep the list in step", async ({ page }) => {
    await new SignInPage(page).open();
    await new SignInPage(page).signIn("bodyshop@example.test", PASSWORD);
    const availability = new AvailabilityPage(page);
    await availability.expectLoaded();
    await availability.addWindow("2031-05-06", "10:00", "12:00");
    await availability.expectWindow(
      "Tue 6 May 2031",
      "10:00 AM – 12:00 PM",
      "4 slots",
    );

    await availability.startEdit("Tue 6 May 2031");
    await availability.fillWindow(
      "Edit availability",
      "2031-05-06",
      "09:00",
      "12:00",
    );
    await availability.saveWindow("Edit availability", "Save changes");
    await availability.expectDialogClosed();
    await availability.expectWindow(
      "Tue 6 May 2031",
      "9:00 AM – 12:00 PM",
      "6 slots",
    );

    await availability.cancelRemove("Tue 6 May 2031");
    await availability.expectWindow(
      "Tue 6 May 2031",
      "9:00 AM – 12:00 PM",
      "6 slots",
    );
    await availability.confirmRemove("Tue 6 May 2031");
    await availability.expectNoWindow("Tue 6 May 2031");
  });

  // L2-061 AC3: a failed load can be retried.
  test("a failed availability load can be retried", async ({ page }) => {
    await new SignInPage(page).open();
    await new SignInPage(page).signIn("mechanic@example.test", PASSWORD);
    const availability = new AvailabilityPage(page);
    await availability.expectLoaded();
    await availability.breakList();
    await page.reload();
    await availability.expectLoadFailed();
    await availability.restoreList();
    await availability.tryAgain();
    await availability.expectLoaded();
  });

  // L2-061 AC3: a pending provider cannot set availability yet.
  test("a pending provider is told to wait for approval", async ({ page }) => {
    const email = `pending.${Date.now()}@example.test`;
    await page.request.post(`${API}/api/auth/register`, {
      data: {
        fullName: "New Mechanic",
        email,
        password: "a-long-password",
        acceptedTerms: true,
        role: "Mechanic",
      },
    });
    await page.request.post(`${API}/api/auth/verify-email`, {
      data: { token: await emailedToken(page, email, "verify-email") },
    });
    const signIn = new SignInPage(page);
    await signIn.open();
    await signIn.signIn(email, "a-long-password");
    await new AvailabilityPage(page).expectNotApproved();
  });

  // Roles: a buyer has no availability page.
  test("a buyer cannot manage availability", async ({ page }) => {
    const signIn = new SignInPage(page);
    await signIn.open();
    await signIn.signIn("buyer@example.test", PASSWORD);
    await new InspectionsPage(page).expectSignedIn("Sam Buyer");
    const availability = new AvailabilityPage(page);
    await availability.open();
    await availability.expectProvidersOnly();
  });
});
