import { test } from "@playwright/test";
import { HistoryPage } from "../../pages/HistoryPages";
import { ReportPage } from "../../pages/ReportPages";
import {
  buyerWithCancelledCars,
  buyerWithCars,
  newBuyer,
  signIn,
} from "../../fixtures/bookingApi";

const WINDOW_OPEN = /^\d+ active · window open until \w{3} \d{1,2} \w{3} \d{4}$/;

test.describe("Review inspection history (J14)", () => {
  // L2-019, L2-021 AC4, L2-022: Active are not finished with; Past holds completed and cancelled inspections with their estimates.
  test("the history keeps completed and cancelled inspections under Past, with their estimates", async ({
    page,
    request,
  }) => {
    const { buyer, cars } = await buyerWithCars(request, [
      { estimate: [300, 500] },
      { estimate: "waiting", cancel: true },
      { estimate: "waiting" },
      { estimate: "pending" },
    ]);
    const [done, cancelled, upcoming, pending] = cars;
    await signIn(page, buyer.email);
    const history = new HistoryPage(page);
    await history.expectLoaded();
    await history.expectSubtitle(WINDOW_OPEN);
    await history.expectTabs(2, 2);
    await history.expectSelected("Active");
    await history.expectRow(upcoming.vin, { chip: /^\w{3} \d{1,2} \w{3}, \d{1,2}:\d{2} [AP]M$/ });
    await history.expectRow(pending.vin, { chip: "Call done · report in progress" });
    await history.expectNoRow(done.vin);
    await history.expectNoRow(cancelled.vin);

    await history.selectTab("Past");
    await history.expectSelected("Past");
    await history.expectRow(done.vin, {
      chip: "Report ready",
      estimate: "Required: $300 to $500",
      meta: "$5,000",
    });
    await history.expectRow(cancelled.vin, { chip: "Cancelled", meta: "$5,000" });
    await history.expectNoRow(upcoming.vin);

    // A completed row opens its report; a cancelled one opens what it was booked with.
    await history.openRow(done.vin);
    await history.expectOnReport();
    await new ReportPage(page).expectSummary({
      certification: "$300 to $500",
      required: "1 repair required",
      asking: "$5,000",
      allIn: "$5,300 to $5,500",
    });
    await history.goBack();
    await history.expectSelected("Past");
    await history.openRow(cancelled.vin);
    await history.expectOnDetail();
    await history.expectCancelledDetail(cancelled.vin);
  });

  // L2-021 AC4: a report with only recommended repairs, or none, says so.
  test("a row says Recommended or Passes when nothing is required", async ({ page, request }) => {
    const { buyer, cars } = await buyerWithCars(request, [
      { estimate: "recommended" },
      { estimate: "passes" },
    ]);
    await signIn(page, buyer.email);
    const history = new HistoryPage(page);
    await history.expectLoaded();
    await history.selectTab("Past");
    await history.expectRow(cars[0].vin, { chip: "Report ready", estimate: "Recommended" });
    await history.expectRow(cars[1].vin, { chip: "Report ready", estimate: "Passes" });
  });

  // L2-020 AC2: no inspections yet is a welcome, with a sample report.
  test("a buyer with no inspections sees how to start, and a sample report", async ({ page, request }) => {
    const buyer = await newBuyer(request, "Nia Newcomer");
    await signIn(page, buyer.email);
    const history = new HistoryPage(page);
    await history.expectLoaded();
    await history.expectEmpty();
    await history.viewSampleReport();
    await history.expectSampleReport();
  });

  test("an empty tab says what it holds", async ({ page, request }) => {
    const { buyer } = await buyerWithCars(request, [{ estimate: "waiting" }]);
    await signIn(page, buyer.email);
    const history = new HistoryPage(page);
    await history.expectTabs(1, 0);
    await history.selectTab("Past");
    await history.expectEmptyTab("No past inspections yet. Finished and cancelled inspections show up here.");
  });

  // L2-020 AC1: loading is busy with placeholder rows.
  test("the list is busy while it loads", async ({ page, request }) => {
    const { buyer } = await buyerWithCars(request, [{ estimate: "waiting" }]);
    await signIn(page, buyer.email);
    const history = new HistoryPage(page);
    await history.slowLoad();
    await history.open();
    await history.expectLoading();
    await history.expectTabs(1, 0);
  });

  // L2-020 AC3: a failed load says so, is safe, and can be retried.
  test("a list that fails to load can be retried", async ({ page, request }) => {
    const { buyer, cars } = await buyerWithCars(request, [{ estimate: "waiting" }]);
    await signIn(page, buyer.email);
    const history = new HistoryPage(page);
    await history.failLoadOnce();
    await history.open();
    await history.expectLoadFailed();
    await history.tryAgain();
    await history.expectRow(cars[0].vin, { chip: /\d{1,2}:\d{2} [AP]M$/ });
  });

  // L2-021 AC1, AC2: 20 to a page, with the count, and Previous disabled on the first page.
  test("a long history is paged twenty at a time", async ({ page, request }) => {
    const { buyer, vins } = await buyerWithCancelledCars(request, 21);
    await signIn(page, buyer.email);
    const history = new HistoryPage(page);
    await history.expectLoaded();
    await history.expectSelected("Active");
    await history.selectTab("Past");
    await history.expectSubtitle("21 inspections · 20 per page");
    await history.expectRowCount(20);
    await history.expectPagination("Showing 1–20 of 21", { previous: false, next: true });

    await history.next();
    await history.expectRowCount(1);
    await history.expectPagination("Showing 21–21 of 21", { previous: true, next: false });
    await history.previous();
    await history.expectPagination("Showing 1–20 of 21", { previous: false, next: true });
    void vins;
  });

  // L2-057: a buyer's history is their own.
  test("another buyer's inspections are never listed", async ({ page, request }) => {
    const mine = await buyerWithCars(request, [{ estimate: "waiting" }]);
    const theirs = await buyerWithCars(request, [{ estimate: [100, 200] }, { estimate: "waiting" }]);
    await signIn(page, mine.buyer.email);
    const history = new HistoryPage(page);
    await history.expectLoaded();
    await history.expectTabs(1, 0);
    for (const car of theirs.cars) await history.expectNoRow(car.vin);
    await history.selectTab("Past");
    for (const car of theirs.cars) await history.expectNoRow(car.vin);
  });
});
