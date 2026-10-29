import { test, type Browser, type Page } from "@playwright/test";
import { SignInPage } from "../../pages/AccountPages";
import { CallLobbyPage } from "../../pages/CallPages";
import {
  EstimatePage,
  ReportPage,
  ReviewQueuePage,
} from "../../pages/ReportPages";
import {
  BODY_FINDINGS,
  combinedInspection,
  finishedBodyShopOnlyCall,
  finishedCall,
  SAMPLE_FINDINGS,
  signIn,
  submitBodyReview,
  submitEstimate,
} from "../../fixtures/bookingApi";

// The mechanic's sample estimate: $500 to $750 to certify, on a $5,000 car. Body repairs never change it.
const SUMMARY = {
  certification: "$500 to $750",
  required: "2 repairs required",
  asking: "$5,000",
  allIn: "$5,500 to $5,750",
};

async function shopSession(browser: Browser) {
  const context = await browser.newContext({
    permissions: ["camera", "microphone"],
  });
  const page = await context.newPage();
  const sign = new SignInPage(page);
  await sign.open();
  await sign.signIn("bodyshop@example.test", "Password-123!");
  await page.waitForURL(/\/availability$/);
  return { context, page };
}

async function buyerOn(page: Page, email: string) {
  await signIn(page, email);
}

test.describe("Conduct a body shop review (J12)", () => {
  // L2-062 AC1, L2-058: the shop finds its own inspection in a queue and joins its call.
  test("the body shop finds its review in the queue and joins the call", async ({
    browser,
    request,
  }) => {
    const booked = await combinedInspection(request);
    const shop = await shopSession(browser);
    const queue = new ReviewQueuePage(shop.page);
    await queue.openFromHome();
    await queue.expectLoaded();
    await queue.expectRow(booked.vin, "Waiting for the call", "Mechanic and body shop");
    await queue.joinCall(booked.vin);
    const lobby = new CallLobbyPage(shop.page);
    await lobby.expectLoaded();
    await lobby.expectPerson("Bo Bodyshop", "Body shop reviewer", "Ready");
    await lobby.expectPerson("Maya Mechanic", "Mechanic", "Not joined");
    await shop.context.close();
  });

  // L2-062 AC2: the shop writes its findings; the buyer reads them beside the mechanic's, which they never change.
  test("the body shop writes its findings and the buyer reads them beside the mechanic's", async ({
    page,
    browser,
    request,
  }) => {
    const call = await finishedCall(request, { withBodyShop: true });
    await submitEstimate(request, call.id, SAMPLE_FINDINGS);
    const shop = await shopSession(browser);
    const queue = new ReviewQueuePage(shop.page);
    await queue.openFromHome();
    await queue.expectRow(call.vin, "Call ended");
    await queue.writeFindings(call.vin);

    const review = new EstimatePage(shop.page, "body");
    await review.expectLoaded();
    await review.submit();
    await review.expectProblem("Add at least one finding");
    await review.addFinding({
      title: "Rear quarter panel dent",
      note: "Needs filler and paint.",
      status: "Required",
      min: "800",
      max: "1200",
    });
    await review.addFinding({
      title: "Front bumper paint",
      status: "Recommended",
      min: "300",
      max: "500",
    });
    await review.addFinding({ title: "Hood", status: "Passes" });
    await review.expectFinding("Rear quarter panel dent", "Required", "$800 to $1,200");
    await review.submit();
    await review.expectSubmitted();
    await queue.open();
    await queue.expectRow(call.vin, "Delivered");
    await shop.context.close();

    await buyerOn(page, call.buyer.email);
    const report = new ReportPage(page);
    await report.open(call.id);
    await report.expectSummary(SUMMARY);
    await report.expectBodyShopFindings("Bo Bodyshop", [
      { title: "Rear quarter panel dent", status: "Required", cost: "$800 to $1,200" },
      { title: "Front bumper paint", status: "Recommended", cost: "$300 to $500" },
      { title: "Hood", status: "Passes", cost: "—" },
    ]);
  });

  // L2-062: a review with the body shop alone has no mechanic estimate, only the shop's findings.
  test("a body shop only review shows just the body shop's findings", async ({
    page,
    request,
  }) => {
    const call = await finishedBodyShopOnlyCall(request);
    await submitBodyReview(request, call.id, BODY_FINDINGS);
    await buyerOn(page, call.buyer.email);
    const report = new ReportPage(page);
    await report.open(call.id);
    await report.expectBodyShopOnly("Bo Bodyshop");
    await report.expectBodyShopFindings("Bo Bodyshop", [
      { title: "Rear quarter panel dent", status: "Required", cost: "$800 to $1,200" },
    ]);
  });

  // L2-062: each part stands on its own; the shop's findings do not wait for the mechanic's.
  test("the body shop's findings show while the mechanic's estimate is still being written", async ({
    page,
    request,
  }) => {
    const call = await finishedCall(request, { withBodyShop: true });
    await submitBodyReview(request, call.id, BODY_FINDINGS);
    await buyerOn(page, call.buyer.email);
    const report = new ReportPage(page);
    await report.open(call.id);
    await report.expectEstimatePending();
    await report.expectBodyShopFindings("Bo Bodyshop", [
      { title: "Front bumper paint", status: "Recommended", cost: "$300 to $500" },
    ]);
  });

  // L2-058: a shop sees only what is assigned to it.
  test("a body shop does not see an inspection that is not assigned to it", async ({
    browser,
    request,
  }) => {
    const mechanicOnly = await finishedCall(request);
    const shop = await shopSession(browser);
    const queue = new ReviewQueuePage(shop.page);
    await queue.openFromHome();
    await queue.expectLoaded();
    await queue.expectNoRow(mechanicOnly.vin);
    const review = new EstimatePage(shop.page, "body");
    await review.open(mechanicOnly.id);
    await review.expectNotFound();
    await shop.context.close();
  });

  // L2-046 AC3 in the queue: a failed load says so and can be retried.
  test("a queue that fails to load can be retried", async ({ browser }) => {
    const shop = await shopSession(browser);
    const queue = new ReviewQueuePage(shop.page);
    await queue.failLoadOnce();
    await queue.open();
    await queue.expectLoadFailed();
    await queue.tryAgain();
    await queue.expectLoaded();
    await shop.context.close();
  });
});
