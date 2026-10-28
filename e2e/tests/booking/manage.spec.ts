import { test } from "@playwright/test";
import { DashboardPage, slotLabels } from "../../pages/BookingPages";
import { ManageInspectionPage } from "../../pages/ManageBookingPages";

import {
  API,
  MECHANIC_ID,
  auth,
  bookedInspection,
  newBuyer,
  signIn,
} from "../../fixtures/bookingApi";

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
