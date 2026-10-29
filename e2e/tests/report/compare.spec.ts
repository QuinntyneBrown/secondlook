import { test } from "@playwright/test";
import { ComparePage } from "../../pages/ComparePages";
import { ReportPage } from "../../pages/ReportPages";
import { buyerWithCars, newBuyer, signIn } from "../../fixtures/bookingApi";

test.describe("Compare vehicle estimates (J13)", () => {
  // L2-051: the cars of one window, lowest all-in first, the lowest marked, each linked to its report.
  test("three cars are lined up lowest all-in first", async ({ page, request }) => {
    const { buyer, cars } = await buyerWithCars(request, [
      { estimate: [1000, 2000] },
      { estimate: [300, 500] },
      { estimate: [800, 900] },
    ]);
    const [a, b, c] = cars;
    await signIn(page, buyer.email);
    const compare = new ComparePage(page);
    await compare.openFromNav();
    await compare.expectLoaded(3);
    await compare.expectOrder([b.vin, c.vin, a.vin]);
    await compare.expectReady(b.vin, {
      allIn: "$5,300 to $5,500",
      asking: "$5,000",
      certify: "$300 to $500",
      lowest: true,
    });
    await compare.expectReady(c.vin, {
      allIn: "$5,800 to $5,900",
      asking: "$5,000",
      certify: "$800 to $900",
      lowest: false,
    });
    await compare.expectReady(a.vin, {
      allIn: "$6,000 to $7,000",
      asking: "$5,000",
      certify: "$1,000 to $2,000",
      lowest: false,
    });
    await compare.expectNote();

    // The total on the column is the total in the car's own report.
    await compare.viewReport(b.vin);
    await new ReportPage(page).expectSummary({
      certification: "$300 to $500",
      required: "1 repair required",
      asking: "$5,000",
      allIn: "$5,300 to $5,500",
    });
  });

  // L2-052: a car whose estimate is not in yet is shown as pending, after the cars that can be compared.
  test("a car without an estimate is shown as pending", async ({ page, request }) => {
    const { buyer, cars } = await buyerWithCars(request, [
      { estimate: "waiting" },
      { estimate: [500, 600] },
      { estimate: "pending" },
    ]);
    const [waiting, ready, pending] = cars;
    await signIn(page, buyer.email);
    const compare = new ComparePage(page);
    await compare.open();
    await compare.expectLoaded(3);
    await compare.expectOrder([ready.vin, waiting.vin, pending.vin]);
    await compare.expectReady(ready.vin, {
      allIn: "$5,500 to $5,600",
      asking: "$5,000",
      certify: "$500 to $600",
      lowest: false,
    });
    await compare.expectPending(waiting.vin);
    await compare.expectPending(pending.vin);
  });

  // L2-052 AC2: one car cannot be compared; the way forward is to add another.
  test("one car needs a second", async ({ page, request }) => {
    const { buyer } = await buyerWithCars(request, [{ estimate: [300, 500] }]);
    await signIn(page, buyer.email);
    const compare = new ComparePage(page);
    await compare.open();
    await compare.expectOneCar();
    await compare.addSecondCar();
  });

  test("a buyer with no inspections is pointed to book one", async ({ page, request }) => {
    const buyer = await newBuyer(request, "Nia Newcomer");
    await signIn(page, buyer.email);
    const compare = new ComparePage(page);
    await compare.open();
    await compare.expectNoCars();
  });

  // L2-051 AC4: adding another car is offered from the comparison.
  test("another car can be added from the comparison", async ({ page, request }) => {
    const { buyer } = await buyerWithCars(request, [
      { estimate: [300, 500] },
      { estimate: [400, 600] },
    ]);
    await signIn(page, buyer.email);
    const compare = new ComparePage(page);
    await compare.open();
    await compare.expectLoaded(2);
    await compare.addAnother();
  });

  // L2-052 AC1: the columns are busy while the comparison loads.
  test("the comparison is busy while it loads", async ({ page, request }) => {
    const { buyer } = await buyerWithCars(request, [
      { estimate: [300, 500] },
      { estimate: [400, 600] },
    ]);
    await signIn(page, buyer.email);
    const compare = new ComparePage(page);
    await compare.slowLoad();
    await compare.open();
    await compare.expectBusy();
    await compare.expectLoaded(2);
    await compare.expectNotBusy();
  });

  // L2-052 AC3: a failed load says so and can be retried.
  test("a comparison that fails to load can be retried", async ({ page, request }) => {
    const { buyer } = await buyerWithCars(request, [
      { estimate: [300, 500] },
      { estimate: [400, 600] },
    ]);
    await signIn(page, buyer.email);
    const compare = new ComparePage(page);
    await compare.failLoadOnce();
    await compare.open();
    await compare.expectLoadFailed();
    await compare.tryAgain();
    await compare.expectLoaded(2);
  });

  // L2-051: on a phone the cars stack and nothing scrolls sideways.
  test("on a narrow screen the cars stack without sideways scrolling", async ({
    page,
    request,
  }) => {
    const { buyer } = await buyerWithCars(request, [
      { estimate: [300, 500] },
      { estimate: [400, 600] },
      { estimate: [800, 900] },
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, buyer.email);
    const compare = new ComparePage(page);
    await compare.open();
    await compare.expectLoaded(3);
    await compare.expectStackedWithoutSideScroll();
  });

  // L2-057: a buyer compares their own cars only.
  test("another buyer's cars are never shown", async ({ page, request }) => {
    const mine = await buyerWithCars(request, [
      { estimate: [300, 500] },
      { estimate: [400, 600] },
    ]);
    const theirs = await buyerWithCars(request, [
      { estimate: [100, 200] },
      { estimate: [150, 250] },
    ]);
    await signIn(page, mine.buyer.email);
    const compare = new ComparePage(page);
    await compare.open();
    await compare.expectLoaded(2);
    for (const car of theirs.cars) await compare.expectNoVin(car.vin);
  });

  // The report points to the comparison (deferred from J11).
  test("the report leads to the comparison", async ({ page, request }) => {
    const { buyer, cars } = await buyerWithCars(request, [
      { estimate: [300, 500] },
      { estimate: [400, 600] },
    ]);
    await signIn(page, buyer.email);
    const report = new ReportPage(page);
    await report.open(cars[0].id);
    await report.compareWithAnotherCar();
    await new ComparePage(page).expectLoaded(2);
  });
});
