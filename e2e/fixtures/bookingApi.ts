import { type APIRequestContext, type Page } from "@playwright/test";
import { SignInPage } from "../pages/AccountPages";

export const API = "http://localhost:5100";
export const PASSWORD = "a-long-password";
export const MECHANIC_ID = "00000000-0000-0000-0000-000000000c01";
export const auth = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
});

export async function login(
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

export const SHOP_ID = "00000000-0000-0000-0000-000000000d01";

/** A start time a few days ahead, on the hour, that varies between calls so tests rarely collide. */
export function randomStart() {
  const day = 3 + Math.floor(Math.random() * 9);
  const hour = 15 + Math.floor(Math.random() * 7);
  const n = new Date();
  return new Date(
    Date.UTC(
      n.getUTCFullYear(),
      n.getUTCMonth(),
      n.getUTCDate() + day,
      hour,
      0,
      0,
    ),
  );
}

/** Opens an availability window for a provider; false when it overlaps one that already exists. */
export async function openWindow(
  request: APIRequestContext,
  who: "mechanic" | "bodyshop",
  start: Date,
  minutes = 60,
) {
  const token = await login(request, `${who}@example.test`, "Password-123!");
  const r = await request.post(`${API}/api/availability`, {
    ...auth(token),
    data: {
      start: start.toISOString(),
      end: new Date(start.getTime() + minutes * 60e3).toISOString(),
    },
  });
  return r.status() === 201;
}

/** Opens one window for the mechanic and one for the body shop, offset by `shopOffsetMinutes`; retries on clashes. */
export async function openPairedWindows(
  request: APIRequestContext,
  shopOffsetMinutes = 0,
) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const start = randomStart();
    const shopStart = new Date(start.getTime() + shopOffsetMinutes * 60e3);
    if (
      (await openWindow(request, "mechanic", start)) &&
      (await openWindow(request, "bodyshop", shopStart))
    )
      return start;
  }
  throw new Error(
    "Could not open free windows for the mechanic and the body shop.",
  );
}

export async function newBuyer(request: APIRequestContext, name = "Mo Mover") {
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
export async function bookedInspection(
  request: APIRequestContext,
  options: { withBodyShop?: boolean } = {},
) {
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
    if (
      r.status() === 201 &&
      (!options.withBodyShop || (await openWindow(request, "bodyshop", s)))
    )
      start = s.toISOString();
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

export async function signIn(page: Page, email: string) {
  const sign = new SignInPage(page);
  await sign.open();
  await sign.signIn(email, PASSWORD);
  await page.waitForURL(/\/inspections$/);
}

/** A booked inspection whose call has already happened: the buyer joined and ended it, through the real API. */
export async function finishedCall(
  request: APIRequestContext,
  options: { withBodyShop?: boolean } = {},
) {
  const booked = options.withBodyShop
    ? await combinedInspection(request)
    : await bookedInspection(request);
  const headers = auth(booked.buyer.token);
  await request.post(`${API}/api/calls/${booked.id}/join`, headers);
  await request.post(`${API}/api/calls/${booked.id}/end`, headers);
  return booked;
}

/** A mechanic and body shop review (a combined call), booked through the API. */
export async function combinedInspection(request: APIRequestContext) {
  let start = "";
  for (let attempt = 0; attempt < 40 && !start; attempt++) {
    const s = randomStart();
    if (
      (await openWindow(request, "mechanic", s)) &&
      (await openWindow(request, "bodyshop", s))
    )
      start = s.toISOString();
  }
  if (!start) throw new Error("No shared free window for both providers.");
  const buyer = await newBuyer(request);
  const vin = `2HGFC2F59GH${String((Date.now() + 17) % 1_000_000).padStart(6, "0")}`;
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
      data: { providerId: MECHANIC_ID, start, bodyShopId: SHOP_ID },
    })
  ).json();
  const checkout = await (
    await request.post(`${API}/api/checkouts`, {
      ...auth(buyer.token),
      data: { review: "Both", idempotencyKey: `k-${vin}`, vehicleId: vehicle.id },
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
        bodyShopHoldId: hold.bodyShopHoldId,
        vehicleId: vehicle.id,
      },
    })
  ).json();
  return { buyer, vin, start, second: start, id: inspection.id as string };
}

export type FindingInput = {
  title: string;
  status: "Required" | "Recommended" | "Passes";
  minCents?: number;
  maxCents?: number;
  note?: string;
};

/** The mechanic submits an estimate through the API, as the estimate page would. */
export async function submitEstimate(
  request: APIRequestContext,
  inspectionId: string,
  findings: FindingInput[],
) {
  const token = await login(request, "mechanic@example.test", "Password-123!");
  const r = await request.put(`${API}/api/inspections/${inspectionId}/report`, {
    ...auth(token),
    data: { findings },
  });
  if (!r.ok()) throw new Error(`Estimate was refused: ${r.status()}`);
}

/** Two required repairs, one recommended and one that passes: $500 to $750 to certify. */
export const SAMPLE_FINDINGS: FindingInput[] = [
  { title: "Front brake pads", status: "Required", minCents: 30000, maxCents: 45000, note: "Worn to 2 mm." },
  { title: "Rear tires", status: "Recommended", minCents: 40000, maxCents: 60000, note: "Cracking on the sidewall." },
  { title: "Steering", status: "Passes" },
  { title: "Lower control arm bushing", status: "Required", minCents: 20000, maxCents: 30000 },
];

/** A body shop review booked with the shop alone (no mechanic), whose call has been held and ended, through the API. */
export async function finishedBodyShopOnlyCall(request: APIRequestContext) {
  let start = "";
  for (let attempt = 0; attempt < 40 && !start; attempt++) {
    const s = randomStart();
    if (await openWindow(request, "bodyshop", s)) start = s.toISOString();
  }
  if (!start) throw new Error("No free window for the body shop.");
  const buyer = await newBuyer(request);
  const vin = `2HGFC2F59GH${String((Date.now() + 31) % 1_000_000).padStart(6, "0")}`;
  const vehicle = await (
    await request.post(`${API}/api/vehicles`, {
      ...auth(buyer.token),
      data: { vin, odometerKm: 90000, askingPrice: 5000, sellerName: "Sam Whitaker", sellerPhone: "9055550142" },
    })
  ).json();
  const hold = await (
    await request.post(`${API}/api/bookings/holds`, {
      ...auth(buyer.token),
      data: { providerId: SHOP_ID, start },
    })
  ).json();
  const checkout = await (
    await request.post(`${API}/api/checkouts`, {
      ...auth(buyer.token),
      data: { review: "BodyShop", idempotencyKey: `k-${vin}`, vehicleId: vehicle.id },
    })
  ).json();
  const card = await (
    await request.post(`${API}/api/payments/tokens`, {
      ...auth(buyer.token),
      data: { cardNumber: "4242 4242 4242 4242", expiry: "12 / 34", securityCode: "123", nameOnCard: "Mo", postalCode: "L8P 1A1" },
    })
  ).json();
  await request.post(`${API}/api/checkouts/${checkout.id}/pay`, { ...auth(buyer.token), data: { paymentToken: card.token } });
  const inspection = await (
    await request.post(`${API}/api/bookings`, {
      ...auth(buyer.token),
      data: { checkoutId: checkout.id, holdId: hold.holdId, vehicleId: vehicle.id },
    })
  ).json();
  const id = inspection.id as string;
  await request.post(`${API}/api/calls/${id}/join`, auth(buyer.token));
  await request.post(`${API}/api/calls/${id}/end`, auth(buyer.token));
  return { buyer, vin, start, second: start, id };
}

/** The body shop submits its findings through the API, as the body review page would. */
export async function submitBodyReview(
  request: APIRequestContext,
  inspectionId: string,
  findings: FindingInput[],
) {
  const token = await login(request, "bodyshop@example.test", "Password-123!");
  const r = await request.put(`${API}/api/inspections/${inspectionId}/report/body-shop`, {
    ...auth(token),
    data: { findings },
  });
  if (!r.ok()) throw new Error(`Body review was refused: ${r.status()}`);
}

/** A dent to repair, paint to freshen and a hood that passes: separate from the mechanic's findings. */
export const BODY_FINDINGS: FindingInput[] = [
  { title: "Rear quarter panel dent", status: "Required", minCents: 80000, maxCents: 120000, note: "Needs filler and paint." },
  { title: "Front bumper paint", status: "Recommended", minCents: 30000, maxCents: 50000 },
  { title: "Hood", status: "Passes" },
];
