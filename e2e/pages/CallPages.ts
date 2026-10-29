import { expect, type Page, type WebSocketRoute } from "@playwright/test";

/** The lobby before a live call (L2-039, L2-040): camera and mic check, who is here, and the way in. */
export class CallLobbyPage {
  constructor(private readonly page: Page) {}

  async open(inspectionId: string) {
    await this.page.goto(`/inspections/${inspectionId}/lobby`);
  }

  /** The way in from the inspection page, as a buyer would take it. */
  async openFromInspection(inspectionId: string) {
    await this.page.goto(`/inspections/${inspectionId}`);
    await this.page.getByRole("link", { name: "Join the call" }).click();
    await this.page.waitForURL(/\/inspections\/[^/]+\/lobby$/);
  }

  async expectLoaded() {
    await expect(
      this.page.getByRole("heading", {
        level: 1,
        name: "Check your camera and mic",
      }),
    ).toBeVisible();
    await expect(this.page.getByRole("figure", { name: "You" })).toBeVisible();
    await expect(this.page.getByLabel("Camera", { exact: true })).toBeVisible();
    await expect(
      this.page.getByLabel("Microphone", { exact: true }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("heading", { name: "Who’s here" }),
    ).toBeVisible();
  }

  async expectPerson(
    name: string,
    role: string,
    status: "Ready" | "Here" | "Not joined",
  ) {
    const row = this.page.getByRole("listitem").filter({ hasText: name });
    await expect(row).toContainText(role);
    await expect(row).toContainText(status);
  }

  async expectCallAt(text: string) {
    await expect(this.page.getByText(text)).toBeVisible();
  }

  async join() {
    await this.page.getByRole("button", { name: "Join the call" }).click();
    await this.page.waitForURL(/\/inspections\/[^/]+\/call$/);
  }

  async joinAudioOnly() {
    await this.page
      .getByRole("button", { name: "Join with audio only" })
      .click();
    await this.page.waitForURL(/\/inspections\/[^/]+\/call$/);
  }

  /** The browser refuses the camera but allows the microphone; call before opening the lobby. */
  async blockCamera() {
    await this.page.addInitScript(() => {
      const devices = navigator.mediaDevices;
      const original = devices.getUserMedia.bind(devices);
      devices.getUserMedia = (constraints?: MediaStreamConstraints) =>
        constraints?.video
          ? Promise.reject(new DOMException("Blocked", "NotAllowedError"))
          : original(constraints);
    });
  }

  async expectCameraBlocked() {
    const alert = this.page
      .getByRole("alert")
      .filter({ hasText: "Your browser is blocking the camera" });
    await expect(alert).toBeVisible();
    await expect(
      alert.getByText(
        "Click the camera icon in the address bar, choose Allow, then reload. You can still join with audio only; the mechanic talks to the seller, not you.",
      ),
    ).toBeVisible();
    await expect(
      alert.getByRole("button", { name: "Check again" }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("figure", { name: "You · camera blocked" }),
    ).toBeVisible();
    await expect(
      this.page.getByLabel("Camera", { exact: true }),
    ).toBeDisabled();
    await expect(this.page.getByText("No camera available")).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: "Join with audio only" }),
    ).toBeVisible();
  }

  /** Makes the lobby believe the call opens an hour from now, as it would for a booking made well ahead. */
  async pretendCallOpensLater() {
    await this.page.route(/\/api\/calls\/[^/]+$/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.opensAt = new Date(Date.now() + 3600e3).toISOString();
      await route.fulfill({ response, json: body });
    });
  }

  async expectNotOpenYet() {
    await expect(this.page.getByText(/^The call opens at /)).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: "Join the call" }),
    ).toBeDisabled();
  }

  /** Someone who is not on the inspection finds nothing: no names, no join. */
  async expectNotFound() {
    await expect(
      this.page
        .getByRole("alert")
        .filter({ hasText: "We couldn’t find that call" }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("button", { name: "Join the call" }),
    ).toHaveCount(0);
    await expect(
      this.page.getByRole("heading", { name: "Who’s here" }),
    ).toHaveCount(0);
  }
}

/** The live call (L2-041 to L2-044) from either side, including the mechanic's checklist and notes. */
export class CallPage {
  private sockets: WebSocketRoute[] = [];
  private refuse = false;

  constructor(private readonly page: Page) {}

  /** Lets the test cut and refuse the signalling connection, as a dropped network would; call before joining. */
  async watchConnection() {
    await this.page.routeWebSocket(/\/api\/calls\/[^/]+\/ws/, (ws) => {
      if (this.refuse) {
        void ws.close();
        return;
      }
      const server = ws.connectToServer();
      this.sockets.push(ws);
      ws.onClose(() => void server.close());
    });
  }

  async dropConnection(options: { stayDown?: boolean } = {}) {
    this.refuse = options.stayDown ?? false;
    await Promise.all(this.sockets.splice(0).map((ws) => ws.close()));
  }

  restoreConnection() {
    this.refuse = false;
  }

  private status(text: RegExp | string) {
    return this.page.getByRole("status").filter({ hasText: text });
  }

  async expectLive() {
    await expect(this.status(/^Live/)).toBeVisible();
    for (const name of ["Mute", "Camera off", "End call", "Leave"])
      await expect(
        this.page.getByRole("button", { name, exact: true }),
      ).toBeVisible();
  }

  async expectRemoteVideo(name: string) {
    const video = this.page
      .getByRole("figure", { name, exact: true })
      .locator("video");
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth), {
        message: `${name}'s video should be playing`,
      })
      .toBeGreaterThan(0);
  }

  async expectPresent(name: string) {
    await expect(
      this.page.getByRole("figure", { name, exact: true }),
    ).toBeVisible();
  }

  async expectAbsent(name: string) {
    await expect(
      this.page.getByRole("figure", { name, exact: true }),
    ).toHaveCount(0);
  }

  async expectBanner(title: string, text?: string) {
    const banner = this.status(title);
    await expect(banner).toBeVisible();
    if (text) await expect(banner).toContainText(text);
  }

  async toggle(name: "Mute" | "Camera off") {
    const button = this.page.getByRole("button", { name, exact: true });
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "false");
  }

  async expectChecklist(states: Record<string, "Done" | "Now" | "Next">) {
    const list = this.page.getByRole("list", { name: "Inspection checklist" });
    for (const [name, state] of Object.entries(states)) {
      const item = list.getByRole("listitem").filter({ hasText: name });
      await expect(item).toContainText(state);
      if (state === "Now")
        await expect(item).toHaveAttribute("aria-current", "step");
    }
  }

  async advanceChecklist() {
    await this.page
      .getByRole("button", { name: "Mark done, next item" })
      .click();
  }

  async addNote(text: string) {
    await this.page.getByRole("button", { name: "Add a note" }).click();
    const dialog = this.page.getByRole("dialog", { name: "Add a note" });
    await dialog.getByLabel("Note", { exact: true }).fill(text);
    await dialog.getByRole("button", { name: "Add note" }).click();
    await expect(dialog).toHaveCount(0);
  }

  async expectNote(from: string, text: string) {
    const notes = this.page.getByRole("region", { name: `Notes from ${from}` });
    await expect(notes.getByText(text)).toBeVisible();
  }

  async expectBuyerCannotEditChecklist() {
    await expect(
      this.page.getByRole("button", { name: "Mark done, next item" }),
    ).toHaveCount(0);
    await expect(
      this.page.getByRole("button", { name: "Add a note" }),
    ).toHaveCount(0);
  }

  async expectReconnecting() {
    await expect(this.status("Reconnecting")).toBeVisible();
    const alert = this.page
      .getByRole("alert")
      .filter({ hasText: "Your connection dropped" });
    await expect(alert).toBeVisible();
    await expect(
      alert.getByText(
        "We’re reconnecting you. The mechanic and the seller can still hear each other.",
      ),
    ).toBeVisible();
  }

  async expectDisconnected() {
    await expect(this.status("Disconnected")).toBeVisible();
    const alert = this.page
      .getByRole("alert")
      .filter({ hasText: "We couldn’t reconnect" });
    await expect(alert).toBeVisible();
    await expect(
      alert.getByText(
        "Your seller and mechanic are still on the call. Rejoin to carry on; your place is saved.",
      ),
    ).toBeVisible();
  }

  async rejoin() {
    await this.page.getByRole("button", { name: "Rejoin the call" }).click();
  }

  /** Opens the confirmation; "Stay on the call" has focus so a stray key press cannot end the call. */
  async startEndingCall(left: string) {
    await this.page
      .getByRole("button", { name: "End call", exact: true })
      .click();
    const dialog = this.page.getByRole("dialog", {
      name: "End the call for everyone?",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/will be disconnected\./)).toBeVisible();
    await expect(dialog.getByText(left)).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Stay on the call" }),
    ).toBeFocused();
  }

  async stayOnTheCall() {
    await this.page.getByRole("button", { name: "Stay on the call" }).click();
    await expect(
      this.page.getByRole("dialog", { name: "End the call for everyone?" }),
    ).toHaveCount(0);
  }

  async confirmEndCall() {
    await this.page
      .getByRole("dialog", { name: "End the call for everyone?" })
      .getByRole("button", { name: "End call", exact: true })
      .click();
  }

  async expectEnded(checked: string[], notChecked: string[]) {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Call ended" }),
    ).toBeVisible();
    await expect(this.page.getByText("That’s the call.")).toBeVisible();
    await expect(
      this.page.getByText(/^Call length: \d+ min \d+ s$/),
    ).toBeVisible();
    if (checked.length)
      await expect(
        this.page.getByText(`Checked: ${checked.join(", ")}`),
      ).toBeVisible();
    if (notChecked.length)
      await expect(
        this.page.getByText(`Not checked: ${notChecked.join(", ")}`),
      ).toBeVisible();
    await expect(
      this.page.getByRole("link", { name: "Back to inspection" }),
    ).toBeVisible();
  }

  async leave() {
    await this.page.getByRole("button", { name: "Leave", exact: true }).click();
    await this.page.waitForURL(/\/inspections\/[^/]+$/);
  }
}
