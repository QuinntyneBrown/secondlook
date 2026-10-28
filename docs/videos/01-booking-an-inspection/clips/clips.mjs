// Screen recordings for video 01 (tools/video-record/record-clips.mjs), played from the static
// mocks through the throwaway demo server: `node tools/video-record/mock-demo-server.mjs`.
export const config = {
  baseURL: 'http://localhost:4310',
  viewport: { width: 1408, height: 792 },
};

const slot = (t, text) => t.page.locator('label.slot', { hasText: text });
const review = (t, value) => t.page.locator(`label:has(input[name="review"][value="${value}"])`);

export const clips = {
  vehicle: async (t) => {
    await t.go('/pages/book-vehicle/default.html');
    await t.wait(1200);
    const vin = t.page.locator('#vin');
    await vin.fill('');
    await t.type(vin, '2HGFC2F59GH512345', 45);
    await t.wait(1400);
    await t.hover(t.page.locator('#asking'), 900);
    await t.hover(t.page.locator('#seller-phone'), 1400);
    await t.click(t.page.getByRole('button', { name: /Continue to review type/ }));
    await t.wait(1200);
  },

  review: async (t) => {
    await t.go('/pages/book-review-type/default.html');
    await t.wait(1200);
    await t.click(review(t, 'mechanic'));
    await t.wait(1600);
    await t.click(review(t, 'bodyshop'));
    await t.wait(1600);
    await t.click(review(t, 'both'));
    await t.wait(1800);
    await t.click(t.page.getByRole('button', { name: /Continue to scheduling/ }));
    await t.wait(1200);
  },

  schedule: async (t) => {
    await t.go('/pages/book-schedule/default.html');
    await t.wait(1200);
    await t.click(t.page.getByRole('button', { name: /Fri 30 Oct/ }));
    await t.wait(1200);
    await t.click(t.page.getByRole('button', { name: /Thu 29 Oct/ }));
    await t.wait(900);
    await t.click(slot(t, '12:30 PM'));
    await t.wait(900);
    await t.click(slot(t, '6:30 PM'));
    await t.hover(t.page.getByRole('link', { name: 'View profile' }), 1600);
    await t.click(t.page.getByRole('button', { name: /Continue to payment/ }));
    await t.wait(1200);
  },

  pay: async (t) => {
    await t.go('/pages/checkout/default.html');
    await t.wait(1400);
    await t.hover(t.page.locator('aside[aria-label="Order summary"]'), 1800);
    await t.hover(t.page.getByRole('checkbox'), 1400);
    await t.click(t.page.getByRole('button', { name: 'Pay $45' }));
    await t.wait(4200);
  },

  booked: async (t) => {
    await t.go('/pages/booking-confirmed/default.html');
    await t.wait(2200);
    await t.scroll(260, 1200);
    await t.wait(1600);
    await t.hover(t.page.getByRole('link', { name: 'Add another car' }), 1800);
  },
};
