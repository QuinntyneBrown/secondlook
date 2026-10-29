import { expect, type Page } from "@playwright/test";

/** The mechanic's estimate editor (L2-050): add findings in a dialog, then submit. */
export class EstimatePage {
  constructor(private readonly page: Page) {}

  async open(inspectionId: string) {
    await this.page.goto(`/inspections/${inspectionId}/estimate`);
  }

  async expectLoaded() {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Write the estimate" }),
    ).toBeVisible();
  }

  private get dialog() {
    return this.page.getByRole("dialog", { name: "Add a finding" });
  }

  async openAddFinding() {
    await this.page.getByRole("button", { name: "Add a finding" }).click();
    await expect(this.dialog).toBeVisible();
  }

  async fillFinding(finding: {
    title?: string;
    note?: string;
    status?: "Required" | "Recommended" | "Passes";
    min?: string;
    max?: string;
  }) {
    const d = this.dialog;
    if (finding.title !== undefined)
      await d.getByLabel("Title", { exact: true }).fill(finding.title);
    if (finding.note !== undefined)
      await d.getByLabel("Note (optional)", { exact: true }).fill(finding.note);
    if (finding.status)
      await d.getByLabel("Status", { exact: true }).selectOption(finding.status);
    if (finding.min !== undefined)
      await d.getByLabel("Lowest cost ($)", { exact: true }).fill(finding.min);
    if (finding.max !== undefined)
      await d.getByLabel("Highest cost ($)", { exact: true }).fill(finding.max);
  }

  async confirmFinding() {
    await this.dialog.getByRole("button", { name: "Add finding" }).click();
  }

  async addFinding(finding: Parameters<EstimatePage["fillFinding"]>[0]) {
    await this.openAddFinding();
    await this.fillFinding(finding);
    await this.confirmFinding();
    await expect(this.dialog).toHaveCount(0);
  }

  async expectFindingProblem(text: string) {
    await expect(this.dialog.getByText(text)).toBeVisible();
  }

  async cancelFinding() {
    await this.dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(this.dialog).toHaveCount(0);
  }

  private get list() {
    return this.page.getByRole("list", { name: "Findings" });
  }

  async expectFinding(title: string, status: string, cost: string) {
    const item = this.list.getByRole("listitem").filter({ hasText: title });
    await expect(item).toContainText(status);
    await expect(item).toContainText(cost);
  }

  async removeFinding(title: string) {
    await this.list
      .getByRole("listitem")
      .filter({ hasText: title })
      .getByRole("button", { name: "Remove" })
      .click();
  }

  async expectNoFinding(title: string) {
    await expect(
      this.list.getByRole("listitem").filter({ hasText: title }),
    ).toHaveCount(0);
  }

  async submit() {
    await this.page.getByRole("button", { name: "Submit estimate" }).click();
  }

  async expectProblem(title: string) {
    await expect(
      this.page.getByRole("alert").filter({ hasText: title }),
    ).toBeVisible();
  }

  async expectSubmitted() {
    await expect(
      this.page
        .getByRole("status")
        .filter({ hasText: "Estimate sent. The buyer can read it now." }),
    ).toBeVisible();
  }
}

/** The buyer's report (L2-045, L2-046) and its share, download and issue dialogs (L2-047 to L2-049). */
export class ReportPage {
  constructor(private readonly page: Page) {}

  async open(inspectionId: string) {
    await this.page.goto(`/inspections/${inspectionId}/report`);
  }

  async openFromInspection(inspectionId: string) {
    await this.page.goto(`/inspections/${inspectionId}`);
    await this.page.getByRole("link", { name: "View report" }).click();
    await this.page.waitForURL(/\/inspections\/[^/]+\/report$/);
  }

  async expectWrittenBy(mechanic: string) {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Your report" }),
    ).toBeVisible();
    await expect(
      this.page.getByText(
        new RegExp(`^Call finished \\w{3} \\d{1,2} \\w{3} \\d{4} · written by ${mechanic}$`),
      ),
    ).toBeVisible();
  }

  async expectSummary(summary: {
    certification: string;
    required: string;
    asking: string;
    allIn: string;
  }) {
    await expect(
      this.page.getByRole("heading", {
        name: "Estimated cost to get it safety certified",
      }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("region", { name: "Estimate summary" }),
    ).toContainText(summary.certification);
    await expect(this.page.getByText(summary.required)).toBeVisible();
    const worth = this.page.getByRole("region", { name: "Is it worth it?" });
    await expect(worth).toContainText(`Asking price ${summary.asking}`);
    await expect(worth).toContainText(`All-in total ${summary.allIn}`);
  }

  async expectFinding(title: string, status: string, cost: string, note?: string) {
    const item = this.page
      .getByRole("list", { name: "Findings" })
      .getByRole("listitem")
      .filter({ hasText: title });
    await expect(item).toContainText(status);
    await expect(item).toContainText(cost);
    if (note) await expect(item).toContainText(note);
  }

  async expectDisclaimer() {
    await expect(
      this.page.getByText("It is not a safety certificate or a guarantee"),
    ).toBeVisible();
  }

  async expectNotReady() {
    await expect(
      this.page.getByRole("status").filter({ hasText: "Your report isn’t ready yet" }),
    ).toBeVisible();
    await expect(
      this.page.getByText("The mechanic is still writing it."),
    ).toBeVisible();
  }

  async expectBodyShopInProgress(reviewer: string) {
    const card = this.page.getByRole("region", { name: "Body shop review" });
    await expect(card).toContainText("In progress");
    await expect(card).toContainText(`${reviewer} is finishing the body review`);
    await expect(card).toContainText(
      "It’s usually ready 30 minutes after the mechanic’s.",
    );
  }

  async expectNoBodyShop() {
    await expect(
      this.page.getByRole("region", { name: "Body shop review" }),
    ).toHaveCount(0);
  }

  /** Makes the report request fail the way a dropped connection would, once. */
  async failLoadOnce() {
    let failed = false;
    await this.page.route(/\/api\/inspections\/[^/]+\/report$/, async (route) => {
      if (!failed && route.request().method() === "GET") {
        failed = true;
        await route.abort();
      } else await route.continue();
    });
  }

  async expectLoadFailed() {
    const alert = this.page
      .getByRole("alert")
      .filter({ hasText: "Your report didn’t load" });
    await expect(alert).toBeVisible();
    await expect(
      alert.getByText(
        "It’s safe in your account. Try again, or download a copy once it opens.",
      ),
    ).toBeVisible();
    await expect(alert.getByRole("link", { name: "Back to inspections" })).toBeVisible();
  }

  async tryAgain() {
    await this.page.getByRole("button", { name: "Try again" }).click();
  }

  async expectNotFound() {
    await expect(
      this.page.getByRole("alert").filter({ hasText: "We couldn’t find that report" }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: "Share", exact: true }),
    ).toHaveCount(0);
  }

  // Share ---------------------------------------------------------------------------------------

  private get shareDialog() {
    return this.page.getByRole("dialog", { name: "Share this report" });
  }

  async openShare() {
    await this.page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(this.shareDialog).toBeVisible();
  }

  async expectShareDialog(options: { bodyShop: boolean }) {
    const d = this.shareDialog;
    await expect(
      d.getByText("Send it to the seller or a friend who knows cars."),
    ).toBeVisible();
    await expect(d.getByLabel("Send to", { exact: true })).toBeVisible();
    const include = d.getByRole("checkbox", { name: "Include the body shop review" });
    if (options.bodyShop) await expect(include).toBeChecked();
    else await expect(include).toHaveCount(0);
    await expect(d.getByLabel("Share link", { exact: true })).toHaveValue(
      /\/shared\/[\w-]+$/,
    );
    await expect(d.getByText("Works for 14 days. Turn it off any time.")).toBeVisible();
    await expect(d.getByRole("button", { name: "Send report" })).toBeVisible();
  }

  async shareLink() {
    return this.shareDialog.getByLabel("Share link", { exact: true }).inputValue();
  }

  async excludeBodyShop() {
    await this.shareDialog
      .getByRole("checkbox", { name: "Include the body shop review" })
      .uncheck();
  }

  async sendTo(email: string) {
    await this.shareDialog.getByLabel("Send to", { exact: true }).fill(email);
    await this.shareDialog.getByRole("button", { name: "Send report" }).click();
  }

  async expectEmailProblem(text: string) {
    await expect(this.shareDialog.getByText(text)).toBeVisible();
  }

  async expectSent(email: string) {
    const d = this.shareDialog;
    await expect(d.getByText(`Report sent to ${email}`)).toBeVisible();
    await expect(
      d.getByText(
        "They can read it without an account. You can turn the link off from this dialog.",
      ),
    ).toBeVisible();
    await expect(d.getByRole("button", { name: "Turn off link" })).toBeVisible();
  }

  async turnOffLink() {
    await this.shareDialog.getByRole("button", { name: "Turn off link" }).click();
    await expect(this.shareDialog.getByText("The link is turned off.")).toBeVisible();
  }

  async doneSharing() {
    await this.shareDialog.getByRole("button", { name: "Done" }).click();
    await expect(this.shareDialog).toHaveCount(0);
  }

  async failEmail() {
    await this.page.route(/\/report\/share\/email$/, (route) => route.abort());
  }

  async expectSendFailed() {
    const d = this.shareDialog;
    await expect(d.getByText("We couldn’t send it")).toBeVisible();
    await expect(
      d.getByText("The email didn’t go out. Copy the link instead, or try again."),
    ).toBeVisible();
    await expect(d.getByRole("button", { name: "Try again" })).toBeVisible();
  }

  // Download ------------------------------------------------------------------------------------

  private get downloadDialog() {
    return this.page.getByRole("dialog", { name: "Download the report" });
  }

  async openDownload() {
    await this.page.getByRole("button", { name: "Download report" }).click();
    await expect(this.downloadDialog).toBeVisible();
  }

  async expectDownloadDialog() {
    const d = this.downloadDialog;
    await expect(d.getByText("A copy for your records, or for the seller.")).toBeVisible();
    await expect(d.getByRole("radio", { name: "PDF", exact: true })).toBeChecked();
    await expect(
      d.getByRole("radio", { name: "PDF with call screenshots" }),
    ).toBeDisabled();
    await expect(d.getByRole("button", { name: "Download PDF" })).toBeVisible();
  }

  async download() {
    const started = this.page.waitForEvent("download");
    await this.downloadDialog.getByRole("button", { name: "Download PDF" }).click();
    return (await started).suggestedFilename();
  }

  /** Slows the PDF request so the busy state can be seen. */
  async slowPdf() {
    await this.page.route(/\/report\/pdf$/, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
  }

  async expectPreparing() {
    const d = this.downloadDialog;
    await expect(d.getByText("Preparing your PDF…")).toBeVisible();
    await expect(d.getByRole("radio", { name: "PDF", exact: true })).toBeDisabled();
  }

  async failPdf() {
    await this.page.route(/\/report\/pdf$/, (route) => route.abort());
  }

  async startDownload() {
    await this.downloadDialog.getByRole("button", { name: "Download PDF" }).click();
  }

  async expectPdfFailed() {
    const d = this.downloadDialog;
    await expect(d.getByText("We couldn’t make the PDF")).toBeVisible();
    await expect(d.getByText("The report is fine. Try again in a moment.")).toBeVisible();
    await expect(d.getByRole("button", { name: "Try again" })).toBeVisible();
  }

  async closeDownload() {
    await this.downloadDialog.getByRole("button", { name: "Close" }).click();
    await expect(this.downloadDialog).toHaveCount(0);
  }

  // Report an issue -----------------------------------------------------------------------------

  private get issueDialog() {
    return this.page.getByRole("dialog", { name: "Report an issue" });
  }

  async openIssue() {
    await this.page.getByRole("button", { name: "Report an issue" }).click();
    await expect(this.issueDialog).toBeVisible();
  }

  async expectIssueDialog() {
    const d = this.issueDialog;
    await expect(
      d.getByText("Think the mechanic got something wrong? Tell us and they’ll review it."),
    ).toBeVisible();
    for (const choice of [
      "A finding looks wrong",
      "Something was missed",
      "The cost seems off",
      "Something else",
    ])
      await expect(d.getByRole("radio", { name: choice })).toBeVisible();
    await expect(d.getByLabel("Tell us more (optional)", { exact: true })).toBeVisible();
  }

  async sendIssue(choice?: string, more?: string) {
    const d = this.issueDialog;
    if (choice) await d.getByRole("radio", { name: choice }).check();
    if (more) await d.getByLabel("Tell us more (optional)", { exact: true }).fill(more);
    await d.getByRole("button", { name: "Send" }).click();
  }

  async expectIssueProblem(text: string) {
    await expect(this.issueDialog.getByText(text)).toBeVisible();
  }

  async expectIssueSent(mechanic: string) {
    const d = this.issueDialog;
    await expect(d.getByText(`Thanks. ${mechanic} will take another look.`)).toBeVisible();
    await expect(
      d.getByText("We’ve passed it on. If something changes, we’ll update the report."),
    ).toBeVisible();
    await d.getByRole("button", { name: "Done" }).click();
    await expect(this.issueDialog).toHaveCount(0);
  }

  async failIssue() {
    await this.page.route(/\/report\/issues$/, (route) => route.abort());
  }

  async expectIssueFailed() {
    const d = this.issueDialog;
    await expect(d.getByText("We couldn’t send that")).toBeVisible();
    await expect(d.getByText("Nothing was lost. Try again.")).toBeVisible();
    await expect(d.getByRole("button", { name: "Try again" })).toBeVisible();
  }
}

/** What someone with a share link sees, with no account (L2-047). */
export class SharedReportPage {
  constructor(private readonly page: Page) {}

  async open(link: string) {
    await this.page.goto(link);
  }

  async expectReport() {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Shared report" }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("heading", {
        name: "Estimated cost to get it safety certified",
      }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: "Share", exact: true }),
    ).toHaveCount(0);
  }

  async expectFinding(title: string) {
    await expect(
      this.page.getByRole("list", { name: "Findings" }).getByRole("listitem").filter({ hasText: title }),
    ).toBeVisible();
  }

  async expectNotShared() {
    await expect(
      this.page.getByRole("alert").filter({ hasText: "This report isn’t shared with you" }),
    ).toBeVisible();
    await expect(
      this.page.getByText("The owner turned off the link. Ask them for a new one."),
    ).toBeVisible();
  }

  async expectNoBodyShop() {
    await expect(
      this.page.getByRole("region", { name: "Body shop review" }),
    ).toHaveCount(0);
  }
}
