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
