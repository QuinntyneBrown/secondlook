// Screen recordings for video 03 (tools/video-record/record-clips.mjs), played from the static
// mocks through the throwaway demo server: `node tools/video-record/mock-demo-server.mjs`.
export const config = {
  baseURL: 'http://localhost:4310',
  viewport: { width: 1408, height: 792 },
};

export const clips = {
  partial: async (t) => {
    await t.go('/pages/report/partial.html');
    await t.wait(2400);
    await t.scroll(200, 900);
    await t.wait(2200);
  },

  estimate: async (t) => {
    await t.go('/pages/report/default.html');
    await t.wait(2600);
    await t.hover(t.page.getByText('Asking price $8,900'), 2600);
  },

  findings: async (t) => {
    await t.go('/pages/report/default.html');
    await t.wait(1400);
    await t.scroll(260, 1000);
    await t.hover(t.page.getByText('Front brake pads'), 2200);
    await t.hover(t.page.getByText('Rear tires'), 1800);
    await t.hover(t.page.getByText('Windshield chip'), 1800);
  },

  bodyshop: async (t) => {
    await t.go('/pages/report/default.html');
    await t.wait(1000);
    await t.scroll(700, 1400);
    await t.hover(t.page.getByText('Rocker panels, both sides'), 2200);
    await t.hover(t.page.getByText('Rear bumper repaint'), 2200);
  },

  decide: async (t) => {
    await t.go('/pages/report/default.html');
    await t.wait(800);
    await t.scroll(1200, 1400);
    await t.wait(1800);
    await t.click(t.page.getByRole('link', { name: 'Compare with another car' }));
    await t.wait(3200);
  },
};
