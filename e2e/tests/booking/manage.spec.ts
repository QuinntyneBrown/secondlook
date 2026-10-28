import { test, type APIRequestContext, type Page } from "@playwright/test";
import { SignInPage } from "../../pages/AccountPages";
import { DashboardPage, slotLabels } from "../../pages/BookingPages";
import { ManageInspectionPage } from "../../pages/ManageBookingPages";

const API = "http://localhost:5100";
const PASSWORD = "a-long-password";
const MECHANIC_ID = "00000000-0000-0000-0000-000000000c01";
const auth = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
});

async function login(
  request: APIRequestContext,
  email: string,
  password: string,
) {
  return (
    await (
      await request.post(`${API}/api/auth/login`, { data: { email, password } })
    ).json()
  ).token as string;
}

async function newBuyer(request: APIRequestContext, name = "Mo Mover") {
  const email = `move.${Date.now()}${Math.floor(Math.random() * 10000)}@example.test`;
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

/** Opens a one-hour window a few days ahead and books its first slot for a new buyer, through the API. */
async function bookedInspection(request: APIRequestContext) {
  const mechanic = await login(
    request,
    "mechanic@example.test",
    "Password-123!",
  );
  let start = "";
  for (let attempt = 0; attempt < 30 && !start; attempt++) {
    const day = 3 + Math.floor(Math.random() * 9);
    const hour = 15 + Math.floor(Math.random() * 7);
    const s = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate() + day,
        hour,
        0,
        0,
      ),
    );
    const r = await request.post(`${API}/api/availability`, {
      ...auth(mechanic),
      data: {
        start: s.toISOString(),
        end: new Date(s.getTime() + 3600e3).toISOString(),
      },
    });
    if (r.status() === 201) start = s.toISOString();
  }
  const buyer = await newBuyer(request);
  const vin = `2HGFC2F59GH${String(Date.now() % 1_000_000).padStart(6, "0")}`;
  const vehicle = await (
    await request.post(`${API}/api/vehicles`, {
      ...auth(buyer.token),
      data: {
        vin,
        odometerKm: 90000,
        askingPrice: 5000,
        sellerName: "Sam Whitaker",
        sellerPhone: "9055550142",
      },
    })
  ).json();
  const hold = await (
    await request.post(`${API}/api/bookings/holds`, {
      ...auth(buyer.token),
      data: { providerId: MECHANIC_ID, start },
    })
  ).json();
  const checkout = await (
    await request.post(`${API}/api/checkouts`, {
      ...auth(buyer.token),
      data: {
        review: "Mechanic",
        idempotencyKey: `k-${vin}`,
        vehicleId: vehicle.id,
      },
    })
  ).json();
  const card = await (
    await request.post(`${API}/api/payments/tokens`, {
      ...auth(buyer.token),
      data: {
        cardNumber: "4242 4242 4242 4242",
        expiry: "12 / 34",
        securityCode: "123",
        nameOnCard: "Mo",
        postalCode: "L8P 1A1",
      },
    })
  ).json();
  await request.post(`${API}/api/checkouts/${checkout.id}/pay`, {
    ...auth(buyer.token),
    data: { paymentToken: card.token },
  });
  const inspection = await (
    await request.post(`${API}/api/bookings`, {
      ...auth(buyer.token),
      data: {
        checkoutId: checkout.id,
        holdId: hold.holdId,
        vehicleId: vehicle.id,
      },
    })
  ).json();
  return {
    buyer,
    vin,
    start,
    second: new Date(new Date(start).getTime() + 30 * 60e3).toISOString(),
    id: inspection.id as string,
  };
}

async function signIn(page: Page, email: string) {
  const sign = new SignInPage(page);
  await sign.open();
  await sign.signIn(email, PASSWORD);
  await page.waitForURL(/\/inspections$/);
}

test.describe("Reschedule or cancel a booking (J07)", () => {
  // L2-036 AC1, AC2, AC3, AC5: pick a new time, choose one, see the toast, undo it.
  test("a buyer reschedules a call and can undo it", async ({
    page,
    request,
  }) => {
    const b = await bookedInspection(request);
    await signIn(page, b.buyer.email);
    const detail = new ManageInspectionPage(page);
    await detail.open(b.id);
    await detail.expectScheduled(b.start);

    await detail.openReschedule();
    await detail.expectRescheduleIntro("Maya Mechanic");
    await detail.submitReschedule();
    await detail.expectChooseTime();
    await detail.chooseNewTime(b.second);
    await detail.submitReschedule();
    await detail.expectRescheduled(b.second, "Sam Whitaker");
    await detail.expectScheduled(b.second);

    await detail.undo();
    await detail.expectScheduled(b.start);
  });

  // L2-036 AC4: a slot taken meanwhile leaves the original time booked.
  test("a slot taken meanwhile keeps the original time", async ({
    page,
    request,
  }) => {
    const b = await bookedInspection(request);
    await signIn(page, b.buyer.email);
    const detail = new ManageInspectionPage(page);
    await detail.open(b.id);
    await detail.openReschedule();
    await detail.chooseNewTime(b.second);

    const other = await newBuyer(request, "Other Buyer");
    await request.post(`${API}/api/bookings/holds`, {
      ...auth(other.token),
      data: { providerId: MECHANIC_ID, start: b.second },
    });

    await detail.submitReschedule();
    await detail.expectCouldNotMove();
  });

  // L2-037, L2-038, L2-032: cancel with a reason, full refund, cancelled view, moves to Past.
  test("a buyer cancels with a reason and is refunded in full", async ({
    page,
    request,
  }) => {
    const b = await bookedInspection(request);
    await signIn(page, b.buyer.email);
    const detail = new ManageInspectionPage(page);
    await detail.open(b.id);
    await detail.openCancel();
    const l = slotLabels(b.start);
    await detail.expectCancelDialog(
      `Maya Mechanic’s slot on ${l.day}, ${l.time} will be released and Sam Whitaker will be told.`,
      "You’ll get $50.00 back",
      "4242",
    );

    await detail.confirmCancel();
    await detail.expectReasonRequired();
    await detail.chooseReason("I bought a different car");
    await detail.confirmCancel();

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).formatToParts(new Date());
    const p = (t: string) => today.find((x) => x.type === t)!.value;
    await detail.expectCancelled(
      `${p("weekday")} ${p("day")} ${p("month")} ${p("year")}`,
      "$50.00",
      "4242",
      "Cancelled · refunded $50",
    );

    await new DashboardPage(page).open();
    await detail.openPastTab();
    await detail.expectInPast(b.vin);
  });
});
