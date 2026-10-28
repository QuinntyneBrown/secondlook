import { test } from "@playwright/test";
import {
  BookVehiclePage,
  ConfirmedPage,
  DashboardPage,
  InspectionDetailPage,
  ReviewTypePage,
  SchedulePage,
} from "../../pages/BookingPages";
import { CheckoutPage, VISA } from "../../pages/PaymentPages";
import {
  newBuyer,
  openPairedWindows,
  openWindow,
  randomStart,
  signIn,
} from "../../fixtures/bookingApi";

const uniqueVin = () =>
  `2HGFC2F59GH${String((Date.now() + 7) % 1_000_000).padStart(6, "0")}`;
const car = (vin: string) => ({
  vin,
  km: "98000",
  price: "6400",
  url: "",
  name: "Sam Whitaker",
  phone: "905-555-0142",
});

async function startBooking(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
  review: "Mechanic" | "Body shop" | "Both",
) {
  const buyer = await newBuyer(request, "Bea Bodyshop");
  await signIn(page, buyer.email);
  await new DashboardPage(page).startBooking();
  const vehicle = new BookVehiclePage(page);
  const vin = uniqueVin();
  await vehicle.fill(car(vin));
  await vehicle.continue();
  const r = new ReviewTypePage(page);
  await r.choose(review);
  return { vin, review: r };
}

test.describe("Add a body shop review (J09)", () => {
  // ADR 0011: a combined call is offered only at times when a mechanic and a body shop are both free.
  test("a combined call is offered only when both are free", async ({
    page,
    request,
  }) => {
    // The mechanic is free from :00 for an hour, the body shop from :30: only :30 is shared.
    const start = await openPairedWindows(request, 30);
    const shared = new Date(start.getTime() + 30 * 60e3).toISOString();
    const { vin, review } = await startBooking(page, request, "Both");
    await review.expectTotal("$70.00");
    await review.continue();

    const schedule = new SchedulePage(page);
    await schedule.expectLoaded();
    await schedule.pick(shared);
    await schedule.expectSlotMissing(start.toISOString());
    await schedule.expectProviders("Maya Mechanic", "Bo Bodyshop");
    await schedule.continueToPayment();

    const checkout = new CheckoutPage(page);
    await checkout.expectLoaded("Pay $70");
    await checkout.fillCard(VISA);
    await checkout.pay("Pay $70");

    const confirmed = new ConfirmedPage(page);
    await confirmed.expectBooked(shared, "Maya Mechanic", "Bo Bodyshop");
    await confirmed.viewInspection();
    const detail = new InspectionDetailPage(page);
    await detail.expectScheduled(vin, shared, "$70.00");
    await detail.expectProvider("Maya Mechanic", "Mechanic");
    await detail.expectProvider("Bo Bodyshop", "Body shop");
  });

  // L2-024: a body shop review alone costs the base price and is with the shop only.
  test("a body shop review is booked with the shop alone", async ({
    page,
    request,
  }) => {
    let start: Date | undefined;
    for (let i = 0; i < 40 && !start; i++) {
      const s = randomStart();
      if (await openWindow(request, "bodyshop", s)) start = s;
    }
    const slot = start!.toISOString();
    const { vin, review } = await startBooking(page, request, "Body shop");
    await review.expectTotal("$50.00");
    await review.continue();

    const schedule = new SchedulePage(page);
    await schedule.pick(slot);
    await schedule.expectProviders("Bo Bodyshop");
    await schedule.continueToPayment();

    const checkout = new CheckoutPage(page);
    await checkout.expectLoaded("Pay $50");
    await checkout.fillCard(VISA);
    await checkout.pay("Pay $50");

    const confirmed = new ConfirmedPage(page);
    await confirmed.expectBooked(slot, "Bo Bodyshop");
    await confirmed.viewInspection();
    const detail = new InspectionDetailPage(page);
    await detail.expectScheduled(vin, slot, "$50.00");
    await detail.expectProvider("Bo Bodyshop", "Body shop");
  });

  // ADR 0011: when no time is shared the buyer is told, nothing has been charged, and a single review is one step back.
  test("no shared time offers a way back to a single review", async ({
    page,
    request,
  }) => {
    await page.route("**/api/slots?kind=Both*", (route) =>
      route.fulfill({ json: { timeZone: "America/Toronto", slots: [] } }),
    );
    const { review } = await startBooking(page, request, "Both");
    await review.continue();
    await new SchedulePage(page).expectNoSharedTimes();
  });
});
