import { test } from "@playwright/test";
import {
  BookVehiclePage,
  ConfirmedPage,
  DashboardPage,
  ReviewTypePage,
  SchedulePage,
} from "../../pages/BookingPages";
import { CheckoutPage, VISA } from "../../pages/PaymentPages";
import { WindowBanner } from "../../pages/WindowPages";
import { bookedInspection, signIn } from "../../fixtures/bookingApi";

/** "Wed 11 Nov" and "Wed 11 Nov 2026" for the day a 14-day window ends, in Eastern Time. */
function windowEnd(now = new Date()) {
  const end = new Date(now.getTime() + 14 * 24 * 3600e3);
  const part = (o: Intl.DateTimeFormatOptions, t: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", ...o })
      .formatToParts(end)
      .find((p) => p.type === t)!.value;
  const short = `${part({ weekday: "short" }, "weekday")} ${part({ day: "numeric" }, "day")} ${part({ month: "short" }, "month")}`;
  return { short, long: `${short} ${part({ year: "numeric" }, "year")}` };
}

const uniqueVin = () =>
  `2HGFC2F59GH${String((Date.now() + 91) % 1_000_000).padStart(6, "0")}`;

test.describe("Add an additional vehicle (J08)", () => {
  // L2-034 AC1, L2-033 AC1, L2-085 AC6: the banner, the dialog, and its optional VIN.
  test("an open window offers another car for $25", async ({
    page,
    request,
  }) => {
    const b = await bookedInspection(request);
    await signIn(page, b.buyer.email);
    const end = windowEnd();
    const banner = new WindowBanner(page);
    await banner.expectOpen(end.short);

    await banner.openAddAnother();
    await banner.expectDialog(
      `Your window is open until ${end.long}, so this car is $25. Choosing both adds $20.`,
    );
    await banner.continueWithVin("2HGFC2F59");
    await banner.expectVinIncomplete();

    // Without a VIN the buyer goes on to the vehicle step, where the year, make and model are asked.
    await banner.continueWithVin("");
    const vehicle = new BookVehiclePage(page);
    await vehicle.expectLoaded();
    await vehicle.expectValue("VIN (optional)", "");
  });

  // L2-033 AC4: a failed window check offers Try again and keeps the dialog.
  test("a failed check offers to try again", async ({ page, request }) => {
    const b = await bookedInspection(request);
    await signIn(page, b.buyer.email);
    const banner = new WindowBanner(page);
    await banner.openAddAnother();
    await banner.chooseReview("Mechanic");
    await banner.breakWindowCheck();
    await banner.continueWithVin(uniqueVin());
    await banner.expectCouldNotAdd();
    await banner.restoreWindowCheck();
    await banner.tryAgain();
    await new BookVehiclePage(page).expectLoaded();
  });

  // L2-027 AC2, AC3, L2-033 AC5: add a car with both reviews for $45 and see the banner update.
  test("a buyer adds a second car with both reviews for $45", async ({
    page,
    request,
  }) => {
    const b = await bookedInspection(request, { withBodyShop: true });
    await signIn(page, b.buyer.email);
    const banner = new WindowBanner(page);
    await banner.openAddAnother();
    await banner.chooseReview("Both");
    const vin = uniqueVin();
    await banner.continueWithVin(vin);

    // The details step opens with the VIN filled in; the review is already Both.
    const vehicle = new BookVehiclePage(page);
    await vehicle.expectLoaded();
    await vehicle.expectValue("VIN (optional)", vin);
    await vehicle.fillRest({
      year: "2014",
      make: "Toyota",
      model: "Corolla",
      km: "120000",
      price: "6500",
      url: "",
      name: "Lee Chen",
      phone: "289-555-0120",
    });
    await vehicle.continue();

    const review = new ReviewTypePage(page);
    await review.expectLoaded();
    await review.expectTotal("$45.00");
    await review.continue();

    const schedule = new SchedulePage(page);
    await schedule.pick(b.second);
    await schedule.continueToPayment();

    const checkout = new CheckoutPage(page);
    await checkout.expectLoaded("Pay $45");
    await checkout.fillCard(VISA);
    await checkout.pay("Pay $45");
    await new ConfirmedPage(page).expectBooked(
      b.second,
      "Maya Mechanic",
      "Bo Bodyshop",
    );

    await new DashboardPage(page).open();
    // L2-085 AC5: the car is announced by its year, make and model.
    await banner.expectAdded("2014 Toyota Corolla", "$45", "Two");
  });
});
