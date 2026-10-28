// Screen recordings for video 02 (tools/video-record/record-clips.mjs), played from the static
// mocks through the throwaway demo server: `node tools/video-record/mock-demo-server.mjs`.
export const config = {
  baseURL: 'http://localhost:4310',
  viewport: { width: 1408, height: 792 },
};

export const clips = {
  detail: async (t) => {
    await t.go('/pages/inspection-detail/default.html');
    await t.wait(1600);
    await t.hover(t.page.getByText('Your team'), 1600);
    await t.scroll(220, 900);
    await t.wait(900);
    await t.click(t.page.getByRole('link', { name: 'Join the call' }));
    await t.wait(1200);
  },

  lobby: async (t) => {
    await t.go('/pages/call-lobby/default.html');
    await t.wait(1400);
    await t.hover(t.page.locator('select').first(), 1400);
    await t.hover(t.page.getByText('Who’s here'), 2200);
    await t.click(t.page.getByRole('link', { name: 'Join the call' }));
    await t.wait(1400);
  },

  live: async (t) => {
    await t.go('/pages/live-inspection/default.html');
    await t.wait(2400);
    await t.hover(t.page.getByText('Notes from'), 2200);
    await t.click(t.page.getByRole('button', { name: 'Mute' }));
    await t.wait(1800);
  },

  offline: async (t) => {
    await t.go('/pages/live-inspection/offline.html');
    await t.wait(4200);
  },

  end: async (t) => {
    await t.go('/pages/live-inspection/default.html');
    await t.wait(1200);
    await t.click(t.page.locator('a[href$="dialogs/end-call/default.html"]'));
    await t.wait(1600);
    await t.click(t.page.getByRole('button', { name: 'End call' }));
    await t.wait(2400);
    await t.scroll(220, 900);
    await t.wait(2000);
  },
};
