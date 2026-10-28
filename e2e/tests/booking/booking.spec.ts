import { test, type APIRequestContext, type Page } from "@playwright/test";
import { SignInPage } from "../../pages/AccountPages";
import {
  BookVehiclePage,
  ConfirmedPage,
  DashboardPage,
  InspectionDetailPage,
  ReviewTypePage,
  SchedulePage,
  slotLabels,
} from "../../pages/BookingPages";
import { CheckoutPage, VISA } from "../../pages/PaymentPages";
import { openPairedWindows } from "../../fixtures/bookingApi";

const API = "http://localhost:5100";
const PASSWORD = "a-long-password";
const json = (data: unknown, token?: string) => ({
  data,
  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
});

async function login(
  request: APIRequestContext,
  email: string,
  password: string,
) {
  const r = await request.post(`${API}/api/auth/login`, {
    data: { email, password },
  });
  return (await r.json()).token as string;
}

async function newBuyer(request: APIRequestContext, name = "Bea Booker") {
  const email = `book.${Date.now()}${Math.floor(Math.random() * 10000)}@example.test`;
  await request.post(`${API}/api/auth/register`, {
    data: { fullName: name, email, password: PASSWORD, acceptedTerms: true },
  });
  const mail = await request.get(
    `${API}/api/platform/diagnostics/mailbox?email=${encodeURIComponent(email)}&purpose=verify-email`,
  );
  await request.post(`${API}/api/auth/verify-email`, {
    data: { token: (await mail.json()).token },
  });
  return { email, token: await login(request, email, PASSWORD) };
}

/** Opens a one-hour window for the seeded mechanic a few days ahead, retrying on another time if it clashes. */
async function openSlot(request: APIRequestContext) {
  const mechanic = await login(
    request,
    "mechanic@example.test",
    "Password-123!",
  );
  for (let attempt = 0; attempt < 30; attempt++) {
    const day = 3 + Math.floor(Math.random() * 9);
    const hour = 15 + Math.floor(Math.random() * 7); // 11:00 to 17:00 Eastern in summer or winter
    const start = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate() + day,
        hour,
        0,
        0,
      ),
    );
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const r = await request.post(
      `${API}/api/availability`,
      json({ start: start.toISOString(), end: end.toISOString() }, mechanic),
    );
    if (r.status() === 201) return start.toISOString();
  }
  throw new Error("Could not open a free slot for the mechanic.");
}

const uniqueVin = () =>
  `2HGFC2F59GH${String(Date.now() % 1_000_000).padStart(6, "0")}`;

async function signIn(page: Page, email: string) {
  const sign = new SignInPage(page);
  await sign.open();
  await sign.signIn(email, PASSWORD);
}

test.describe("Book a video inspection (J06)", () => {
  // L2-019 AC1/3/4, L2-023 to L2-025, L2-028, L2-035: the whole booking, from vehicle to confirmation and dashboard.
  test("a buyer books a video inspection", async ({ page, request }) => {
    const slot = (await openPairedWindows(request)).toISOString();
    const buyer = await newBuyer(request);
    await signIn(page, buyer.email);

    const dashboard = new DashboardPage(page);
    await dashboard.expectEmpty();
    await dashboard.startBooking();

    // Vehicle: invalid first, then valid.
    const vehicle = new BookVehiclePage(page);
    await vehicle.expectLoaded();
    const vin = uniqueVin();
    const car = {
      vin,
      km: "142300",
      price: "8900",
      url: "https://example.test/civic",
      name: "Sam Whitaker",
      phone: "905-555-0142",
    };
    await vehicle.fill({ ...car, vin: vin.slice(0, 15), phone: "905-555-01" });
    await vehicle.continue();
    await vehicle.expectSummary("Fix 2 things to continue", [
      "Enter the full 17-character VIN.",
      "Enter the seller’s 10-digit phone number.",
    ]);
    await vehicle.expectFieldError(
      "VIN",
      "A VIN has 17 characters. This one has 15.",
    );
    await vehicle.expectFieldError(
      "Seller’s phone",
      "Enter a 10-digit phone number.",
    );
    await vehicle.fill(car);
    await vehicle.continue();

    // Review type.
    const review = new ReviewTypePage(page);
    await review.expectLoaded();
    await review.choose("Both");
    await review.expectTotal("$70.00");
    await review.continue();

    // Schedule, then pay.
    const schedule = new SchedulePage(page);
    await schedule.expectLoaded();
    await schedule.pick(slot);
    await schedule.expectProviders("Maya Mechanic", "Bo Bodyshop");
    await schedule.continueToPayment();

    const checkout = new CheckoutPage(page);
    await checkout.expectLoaded("Pay $70");
    await checkout.fillCard(VISA);
    await checkout.pay("Pay $70");

    // Confirmation, detail and dashboard.
    const confirmed = new ConfirmedPage(page);
    await confirmed.expectBooked(slot, "Maya Mechanic", "Bo Bodyshop");
    await confirmed.viewInspection();
    await new InspectionDetailPage(page).expectScheduled(vin, slot, "$70.00");

    await dashboard.open();
    const labels = slotLabels(slot);
    await dashboard.expectInspection(vin, `${labels.day}, ${labels.time}`);
  });

  // L2-025 AC8: a slot taken between choosing and holding is refused without losing the buyer's answers.
  test("a slot taken by someone else is refused with a way forward", async ({
    page,
    request,
  }) => {
    const slot = await openSlot(request);
    const buyer = await newBuyer(request);
    await signIn(page, buyer.email);
    await new DashboardPage(page).startBooking();
    const vehicle = new BookVehiclePage(page);
    const vin = uniqueVin();
    await vehicle.fill({
      vin,
      km: "90000",
      price: "5000",
      url: "",
      name: "Sam Whitaker",
      phone: "905-555-0142",
    });
    await vehicle.continue();
    await new ReviewTypePage(page).choose("Mechanic");
    await new ReviewTypePage(page).continue();

    const schedule = new SchedulePage(page);
    await schedule.pick(slot);

    // Someone else holds it first.
    const other = await newBuyer(request, "Other Buyer");
    const taken = await request.post(
      `${API}/api/bookings/holds`,
      json(
        { providerId: "00000000-0000-0000-0000-000000000c01", start: slot },
        other.token,
      ),
    );
    if (taken.status() !== 201)
      throw new Error(`The competing hold failed with ${taken.status()}.`);

    await schedule.continueToPayment();
    await schedule.expectSlotTaken();
    await schedule.chooseAnotherTime();
    await schedule.expectSlotMissing(slot);
  });

  // A slow answer for an earlier choice must not overwrite the price of the review the buyer picked last.
  test("the order total follows the latest review choice even when an earlier price arrives late", async ({
    page,
    request,
  }) => {
    const buyer = await newBuyer(request);
    await signIn(page, buyer.email);
    await new DashboardPage(page).startBooking();
    const vehicle = new BookVehiclePage(page);
    await vehicle.fill({
      vin: uniqueVin(),
      km: "90000",
      price: "5000",
      url: "",
      name: "Sam Whitaker",
      phone: "905-555-0142",
    });

    // Hold back the price of the default (Mechanic) review so it arrives after the buyer has chosen Both.
    await page.route("**/api/checkouts", async (route) => {
      if (route.request().postData()?.includes('"review":"Mechanic"'))
        await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });
    await vehicle.continue();
    const review = new ReviewTypePage(page);
    await review.expectLoaded();
    await review.choose("Both");
    await review.expectTotal("$70.00");
    await page.waitForTimeout(2500);
    await review.expectTotal("$70.00");
  });
});
