import { expect, test, type APIRequestContext } from "@playwright/test";
import { InspectionsPage, SignInPage } from "../../pages/AccountPages";
import { VehiclesPage, type VehicleValues } from "../../pages/VehiclePages";

const API = "http://localhost:5100";
const PASSWORD = "a-long-password";

/** A verified buyer with no vehicles, created through the API so each run starts clean. */
async function newBuyer(request: APIRequestContext) {
  const email = `vehicles.${Date.now()}${Math.floor(Math.random() * 1000)}@example.test`;
  await request.post(`${API}/api/auth/register`, {
    data: {
      fullName: "Vera Vehicle",
      email,
      password: PASSWORD,
      acceptedTerms: true,
    },
  });
  const mail = await request.get(
    `${API}/api/platform/diagnostics/mailbox?email=${encodeURIComponent(email)}&purpose=verify-email`,
  );
  await request.post(`${API}/api/auth/verify-email`, {
    data: { token: (await mail.json()).token },
  });
  return email;
}

const uniqueVin = () =>
  `2HGFC2F59GH${String(Date.now() % 1_000_000).padStart(6, "0")}`;

const civic = (vin: string): VehicleValues => ({
  vin,
  km: "142300",
  price: "8900",
  url: "https://example.test/civic",
  name: "Sam Whitaker",
  phone: "905-555-0142",
});

test.describe("Manage vehicles (J04)", () => {
  // L2-063 AC1 to AC5, L2-065: empty list, invalid add, add, duplicate, edit, cancel and confirm remove.
  test("a buyer adds, edits and removes a vehicle", async ({
    page,
    request,
  }) => {
    const email = await newBuyer(request);
    const signIn = new SignInPage(page);
    await signIn.open();
    await signIn.signIn(email, PASSWORD);
    await new InspectionsPage(page).expectSignedIn("Vera Vehicle");
    const vehicles = new VehiclesPage(page);
    await vehicles.openFromInspections();
    await vehicles.expectEmpty();

    const vin = uniqueVin();
    await vehicles.openAdd();
    await vehicles.fill("Add a vehicle", {
      ...civic(vin),
      vin: vin.slice(0, 16),
      phone: "905-555-01",
    });
    await vehicles.save("Add a vehicle", "Save vehicle");
    await vehicles.expectSummary("Add a vehicle", "Fix 2 things to continue", [
      "Enter the full 17-character VIN.",
      "Enter the seller’s 10-digit phone number.",
    ]);
    await vehicles.expectFieldError(
      "Add a vehicle",
      "VIN",
      "A VIN has 17 characters. This one has 16.",
    );
    await vehicles.expectFieldError(
      "Add a vehicle",
      "Seller’s phone",
      "Enter a 10-digit phone number.",
    );

    await vehicles.fill("Add a vehicle", civic(vin));
    await vehicles.save("Add a vehicle", "Save vehicle");
    await vehicles.expectDialogClosed();
    await vehicles.expectVehicle(
      vin,
      "142,300 km",
      "$8,900",
      "Sam Whitaker · 9055550142",
    );

    // The same VIN cannot be saved twice.
    await vehicles.openAdd();
    await vehicles.fill("Add a vehicle", civic(vin));
    await vehicles.save("Add a vehicle", "Save vehicle");
    await vehicles.expectDialogAlert(
      "Add a vehicle",
      "You already saved that vehicle",
    );
    await vehicles.cancelDialog("Add a vehicle");

    // Edit.
    await vehicles.startEdit(vin);
    await vehicles.fill("Edit vehicle", {
      ...civic(vin),
      km: "150000",
      price: "8400",
    });
    await vehicles.save("Edit vehicle", "Save changes");
    await vehicles.expectDialogClosed();
    await vehicles.expectVehicle(
      vin,
      "150,000 km",
      "$8,400",
      "Sam Whitaker · 9055550142",
    );

    // Remove: Cancel is focused and keeps it; confirming removes it.
    await vehicles.cancelRemove(vin);
    await vehicles.expectVehicle(
      vin,
      "150,000 km",
      "$8,400",
      "Sam Whitaker · 9055550142",
    );
    await vehicles.confirmRemove(vin);
    await vehicles.expectNoVehicle(vin);
    await vehicles.expectEmpty();
  });

  // L2-057 / L2-063 AC8: another buyer's vehicles are not visible.
  test("a buyer does not see another buyer's vehicles", async ({
    page,
    request,
  }) => {
    const owner = await newBuyer(request);
    const login = await request.post(`${API}/api/auth/login`, {
      data: { email: owner, password: PASSWORD },
    });
    const token = (await login.json()).token as string;
    const vin = uniqueVin().replace(/.$/, "7");
    const created = await request.post(`${API}/api/vehicles`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        vin,
        odometerKm: 90000,
        askingPrice: 5000,
        sellerName: "Owner Seller",
        sellerPhone: "9055550100",
      },
    });
    expect(created.status()).toBe(201);

    const signIn = new SignInPage(page);
    await signIn.open();
    await signIn.signIn("buyer@example.test", "Password-123!");
    await new InspectionsPage(page).expectSignedIn("Sam Buyer");
    const vehicles = new VehiclesPage(page);
    await vehicles.openFromInspections();
    await vehicles.expectNoVehicle(vin);

    await request.delete(`${API}/api/vehicles/${(await created.json()).id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  // L2-063 AC4: a failed load can be retried.
  test("a failed vehicle load can be retried", async ({ page }) => {
    const signIn = new SignInPage(page);
    await signIn.open();
    await signIn.signIn("buyer@example.test", "Password-123!");
    await new InspectionsPage(page).expectSignedIn("Sam Buyer");
    const vehicles = new VehiclesPage(page);
    await vehicles.openFromInspections();
    await vehicles.breakList();
    await page.reload();
    await vehicles.expectLoadFailed();
    await vehicles.restoreList();
    await vehicles.tryAgain();
    await vehicles.expectLoaded();
  });
});
