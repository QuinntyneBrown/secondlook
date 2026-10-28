import { test, type APIRequestContext, type Page } from "@playwright/test";
import { InspectionsPage, SignInPage } from "../../pages/AccountPages";
import { BillingPage, CheckoutPage, VISA } from "../../pages/PaymentPages";

const API = "http://localhost:5100";
const PASSWORD = "a-long-password";

/** A verified buyer with no payments, created through the API so each test starts clean. */
async function newBuyer(request: APIRequestContext) {
  const email = `pay.${Date.now()}${Math.floor(Math.random() * 1000)}@example.test`;
  await request.post(`${API}/api/auth/register`, {
    data: {
      fullName: "Pat Payer",
      email,
      password: PASSWORD,
      acceptedTerms: true,
    },
  });
  const mail = await request.get(
    `${API}/api/platform/diagnostics/mailbox?email=${encodeURIComponent(email)}&purpose=verify-email`,
  );
  await request.post(`${API}/api/auth/verify-email`, {
    data: { token: (await mail.json()).token },
  });
  return email;
}

async function signIn(page: Page, email: string) {
  const sign = new SignInPage(page);
  await sign.open();
  await sign.signIn(email, PASSWORD);
  await new InspectionsPage(page).expectSignedIn("Pat Payer");
}

test.describe("Pay for an inspection (J05)", () => {
  // L2-027 AC1, L2-028 AC1, AC2, AC4, AC6 of L2-031: server quote, validation, decline, retry, receipt.
  test("a buyer pays $50 for the first inspection", async ({
    page,
    request,
  }) => {
    await signIn(page, await newBuyer(request));
    const checkout = new CheckoutPage(page);
    await checkout.open("Mechanic");
    await checkout.expectLoaded("Pay $50");
    await checkout.expectOrder(["Mechanic review $50.00"], "$50.00");

    // Invalid: 12 digits, bad expiry, no security code.
    await checkout.fillCard({
      ...VISA,
      number: "4000 0566 5566",
      expiry: "13 / 28",
      security: "",
    });
    await checkout.pay("Pay $50");
    await checkout.expectSummary("Fix 3 things to pay", [
      "Enter the 16 digits on the front of your card.",
      "That expiry date isn’t valid.",
      "Enter the 3-digit security code.",
    ]);

    // Declined, then another card.
    await checkout.fillCard({ ...VISA, number: "4000 0000 0000 0002" });
    await checkout.pay("Pay $50");
    await checkout.expectDeclined("$50.00");
    await checkout.addDifferentCard();
    await checkout.fillCard(VISA);
    await checkout.pay("Pay $50");
    await checkout.expectPaid("$50.00", "4242");

    await checkout.openBillingFromReceipt();
    const billing = new BillingPage(page);
    await billing.expectLoaded();
    await billing.expectReceipt("first inspection", "$50.00", "Paid");
  });

  // L2-027 AC2, AC3: after paying, the next vehicle is $25 and both reviews add $20.
  test("an additional vehicle with both reviews costs $45", async ({
    page,
    request,
  }) => {
    await signIn(page, await newBuyer(request));
    const checkout = new CheckoutPage(page);
    await checkout.open("Mechanic");
    await checkout.fillCard(VISA);
    await checkout.pay("Pay $50");
    await checkout.expectPaid("$50.00", "4242");

    await checkout.open("Both");
    await checkout.expectLoaded("Pay $45");
    await checkout.expectOrder(
      ["Additional vehicle $25.00", "Body shop review add-on $20.00"],
      "$45.00",
    );
    await checkout.fillCard(VISA);
    await checkout.pay("Pay $45");
    await checkout.expectPaid("$45.00", "4242");

    const billing = new BillingPage(page);
    await billing.open();
    await billing.expectReceipt("first inspection", "$50.00", "Paid");
    await billing.expectReceipt(
      "additional vehicle + body shop",
      "$45.00",
      "Paid",
    );
  });

  // L2-028 AC5: a bank that wants approval is told so and nothing is charged yet.
  test("a card that needs bank approval shows the approval message", async ({
    page,
    request,
  }) => {
    await signIn(page, await newBuyer(request));
    const checkout = new CheckoutPage(page);
    await checkout.open("Mechanic");
    await checkout.fillCard({ ...VISA, number: "4000 0025 0000 3155" });
    await checkout.pay("Pay $50");
    await checkout.expectBankApproval("$50.00");
  });

  // L2-031 AC3, AC4: empty billing history, and a failed load that can be retried.
  test("billing history handles empty and failed states", async ({
    page,
    request,
  }) => {
    await signIn(page, await newBuyer(request));
    const billing = new BillingPage(page);
    await billing.open();
    await billing.expectLoaded();
    await billing.expectEmpty();

    await billing.breakList();
    await page.reload();
    await billing.expectLoadFailed();
    await billing.restoreList();
    await billing.tryAgain();
    await billing.expectEmpty();
  });
});
