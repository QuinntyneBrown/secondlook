import { expect, test, type Browser, type Page } from "@playwright/test";
import { SignInPage } from "../../pages/AccountPages";
import {
  EstimatePage,
  ReportPage,
  SharedReportPage,
} from "../../pages/ReportPages";
import {
  finishedCall,
  newBuyer,
  SAMPLE_FINDINGS,
  signIn,
  submitEstimate,
} from "../../fixtures/bookingApi";

// The sample estimate: $500 to $750 to certify, on a $5,000 car.
const SUMMARY = {
  certification: "$500 to $750",
  required: "2 repairs required",
  asking: "$5,000",
  allIn: "$5,500 to $5,750",
};

async function mechanicSession(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const sign = new SignInPage(page);
  await sign.open();
  await sign.signIn("mechanic@example.test", "Password-123!");
  await page.waitForURL(/\/availability$/);
  return { context, page };
}

async function buyerOn(page: Page, email: string) {
  await signIn(page, email);
}

test.describe("Receive the safety certification estimate (J11)", () => {
  // L2-050, L2-045: the mechanic writes the estimate; the buyer reads it with totals.
  test("the mechanic submits an estimate and the buyer reads it", async ({
    page,
    browser,
    request,
  }) => {
    const call = await finishedCall(request);
    const mech = await mechanicSession(browser);
    const estimate = new EstimatePage(mech.page);
    await estimate.open(call.id);
    await estimate.expectLoaded();

    // Nothing to send yet, and bad findings are explained before they are added.
    await estimate.submit();
    await estimate.expectProblem("Add at least one finding");
    await estimate.openAddFinding();
    await estimate.confirmFinding();
    await estimate.expectFindingProblem("Give the finding a title of up to 200 characters.");
    await estimate.fillFinding({ title: "Front brake pads", min: "450", max: "300" });
    await estimate.confirmFinding();
    await estimate.expectFindingProblem(
      "Use a cost range from zero up to $100,000, lowest first.",
    );
    await estimate.cancelFinding();

    await estimate.addFinding({
      title: "Front brake pads",
      note: "Worn to 2 mm.",
      status: "Required",
      min: "300",
      max: "450",
    });
    await estimate.addFinding({
      title: "Rear tires",
      note: "Cracking on the sidewall.",
      status: "Recommended",
      min: "400",
      max: "600",
    });
    await estimate.addFinding({ title: "Steering", status: "Passes" });
    await estimate.addFinding({
      title: "Lower control arm bushing",
      status: "Required",
      min: "200",
      max: "300",
    });
    await estimate.expectFinding("Front brake pads", "Required", "$300 to $450");
    await estimate.expectFinding("Steering", "Passes", "—");
    await estimate.removeFinding("Steering");
    await estimate.expectNoFinding("Steering");
    await estimate.addFinding({ title: "Steering", status: "Passes" });
    await estimate.submit();
    await estimate.expectSubmitted();
    await mech.context.close();

    await buyerOn(page, call.buyer.email);
    const report = new ReportPage(page);
    await report.open(call.id);
    await report.expectWrittenBy("Maya Mechanic");
    await report.expectSummary(SUMMARY);
    await report.expectFinding("Front brake pads", "Required", "$300 to $450", "Worn to 2 mm.");
    await report.expectFinding("Rear tires", "Recommended", "$400 to $600");
    await report.expectFinding("Steering", "Passes", "—");
    await report.expectDisclaimer();
    await report.expectNoBodyShop();
  });

  // L2-046 AC1 and the entry point: the inspection leads to its report, which is not ready until the mechanic submits.
  test("the buyer is told the report is not ready until the mechanic submits it", async ({
    page,
    request,
  }) => {
    const call = await finishedCall(request);
    await buyerOn(page, call.buyer.email);
    const report = new ReportPage(page);
    await report.openFromInspection(call.id);
    await report.expectNotReady();
  });

  // L2-046 AC3: a report that fails to load says so and can be retried.
  test("a report that fails to load can be retried", async ({ page, request }) => {
    const call = await finishedCall(request);
    await submitEstimate(request, call.id, SAMPLE_FINDINGS);
    await buyerOn(page, call.buyer.email);
    const report = new ReportPage(page);
    await report.failLoadOnce();
    await report.open(call.id);
    await report.expectLoadFailed();
    await report.tryAgain();
    await report.expectWrittenBy("Maya Mechanic");
    await report.expectSummary(SUMMARY);
  });

  // L2-046 AC2: a body shop review that is not ready leaves the rest of the report readable.
  test("an unfinished body shop review shows as in progress", async ({
    page,
    request,
  }) => {
    const call = await finishedCall(request, { withBodyShop: true });
    await submitEstimate(request, call.id, SAMPLE_FINDINGS);
    await buyerOn(page, call.buyer.email);
    const report = new ReportPage(page);
    await report.open(call.id);
    await report.expectSummary(SUMMARY);
    await report.expectBodyShopInProgress("Bo");
  });

  // L2-047: share by email and by link; the link needs no account and can be turned off.
  test("the buyer shares the report and can turn the link off", async ({
    page,
    browser,
    request,
  }) => {
    const call = await finishedCall(request, { withBodyShop: true });
    await submitEstimate(request, call.id, SAMPLE_FINDINGS);
    await buyerOn(page, call.buyer.email);
    const report = new ReportPage(page);
    await report.open(call.id);
    await report.openShare();
    await report.expectShareDialog({ bodyShop: true });
    await report.sendTo("sam.whitaker@example");
    await report.expectEmailProblem("Enter a valid email address, like name@example.com.");
    await report.excludeBodyShop();
    const link = await report.shareLink();
    await report.sendTo("sam.whitaker@example.com");
    await report.expectSent("sam.whitaker@example.com");

    const friend = await browser.newContext();
    const shared = new SharedReportPage(await friend.newPage());
    await shared.open(link);
    await shared.expectReport();
    await shared.expectFinding("Front brake pads");
    await shared.expectNoBodyShop();

    await report.turnOffLink();
    await report.doneSharing();
    await shared.open(link);
    await shared.expectNotShared();
    await friend.close();
  });

  // L2-047 AC4: an email that does not go out says so, and the link is still there to copy.
  test("an email that fails to send offers to try again", async ({ page, request }) => {
    const call = await finishedCall(request);
    await submitEstimate(request, call.id, SAMPLE_FINDINGS);
    await buyerOn(page, call.buyer.email);
    const report = new ReportPage(page);
    await report.open(call.id);
    await report.failEmail();
    await report.openShare();
    await report.expectShareDialog({ bodyShop: false });
    await report.sendTo("sam.whitaker@example.com");
    await report.expectSendFailed();
  });

  // L2-048: a PDF copy, with a busy state and a failure that can be retried.
  test("the buyer downloads a PDF copy", async ({ page, request }) => {
    const call = await finishedCall(request);
    await submitEstimate(request, call.id, SAMPLE_FINDINGS);
    await buyerOn(page, call.buyer.email);
    const report = new ReportPage(page);
    await report.open(call.id);
    await report.openDownload();
    await report.expectDownloadDialog();
    await report.slowPdf();
    const file = report.download();
    await report.expectPreparing();
    expect(await file).toBe("secondlook-report.pdf");
  });

  test("a PDF that cannot be made says so", async ({ page, request }) => {
    const call = await finishedCall(request);
    await submitEstimate(request, call.id, SAMPLE_FINDINGS);
    await buyerOn(page, call.buyer.email);
    const report = new ReportPage(page);
    await report.open(call.id);
    await report.openDownload();
    await report.failPdf();
    await report.startDownload();
    await report.expectPdfFailed();
  });

  // L2-049: asking the mechanic to look again needs a reason.
  test("the buyer reports an issue with the estimate", async ({ page, request }) => {
    const call = await finishedCall(request);
    await submitEstimate(request, call.id, SAMPLE_FINDINGS);
    await buyerOn(page, call.buyer.email);
    const report = new ReportPage(page);
    await report.open(call.id);
    await report.openIssue();
    await report.expectIssueDialog();
    await report.sendIssue();
    await report.expectIssueProblem("Choose what’s wrong.");
    await report.failIssue();
    await report.sendIssue("The cost seems off", "The brake price looks high.");
    await report.expectIssueFailed();
  });

  test("an issue that sends is acknowledged", async ({ page, request }) => {
    const call = await finishedCall(request);
    await submitEstimate(request, call.id, SAMPLE_FINDINGS);
    await buyerOn(page, call.buyer.email);
    const report = new ReportPage(page);
    await report.open(call.id);
    await report.openIssue();
    await report.sendIssue("The cost seems off", "The brake price looks high.");
    await report.expectIssueSent("Maya");
  });

  // L2-057: another buyer finds nothing, and an unknown share link finds nothing.
  test("someone else's report is not found", async ({ page, browser, request }) => {
    const call = await finishedCall(request);
    await submitEstimate(request, call.id, SAMPLE_FINDINGS);
    const stranger = await newBuyer(request, "Ida Intruder");
    await signIn(page, stranger.email);
    const report = new ReportPage(page);
    await report.open(call.id);
    await report.expectNotFound();

    const friend = await browser.newContext();
    const shared = new SharedReportPage(await friend.newPage());
    await shared.open("/shared/not-a-real-link");
    await shared.expectNotShared();
    await friend.close();
  });
});
