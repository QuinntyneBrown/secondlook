import { expect, type Page } from "@playwright/test";

const ZONE = "America/Toronto";

/** A slot start formatted the way the booking screens show it, in Eastern Time. */
export function slotLabels(startIso: string) {
  const d = new Date(startIso);
  const part = (o: Intl.DateTimeFormatOptions, type: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, ...o })
      .formatToParts(d)
      .find((p) => p.type === type)!.value;
  const weekday = part({ weekday: "short" }, "weekday");
  const dayNum = part({ day: "numeric" }, "day");
  const month = part({ month: "short" }, "month");
  const longWeekday = part({ weekday: "long" }, "weekday");
  const time = `${part({ hour: "numeric", minute: "2-digit", hour12: true }, "hour")}:${part({ hour: "numeric", minute: "2-digit", hour12: true }, "minute")} ${part({ hour: "numeric", minute: "2-digit", hour12: true }, "dayPeriod").toUpperCase().replace(/\./g, "")}`;
  return { day: `${weekday} ${dayNum} ${month}`, longWeekday, time };
}

export class DashboardPage {
  constructor(private readonly page: Page) {}

  async open() {
    await this.page.goto("/inspections");
  }

  async expectEmpty() {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Your inspections" }),
    ).toBeVisible();
    await expect(this.page.getByText("Nothing booked yet")).toBeVisible();
    await expect(
      this.page.getByRole("heading", { name: "No inspections yet" }),
    ).toBeVisible();
    await expect(
      this.page.getByText(
        "Book a mechanic to look at a car over video. Your first inspection is $50 and you get a cost estimate within an hour.",
      ),
    ).toBeVisible();
  }

  async startBooking() {
    await this.page
      .getByRole("link", { name: "Book an inspection" })
      .first()
      .click();
  }

  async expectInspection(vin: string, chip: string) {
    await expect(this.page.getByRole("tab", { name: /^Active/ })).toBeVisible();
    const row = this.page
      .getByRole("listitem")
      .filter({ has: this.page.getByRole("link", { name: vin }) });
    await expect(row).toBeVisible();
    await expect(row.getByText(chip)).toBeVisible();
  }

  async openInspection(vin: string) {
    await this.page.getByRole("link", { name: vin }).click();
  }
}

export interface BookingVehicle {
  vin: string;
  km: string;
  price: string;
  url: string;
  name: string;
  phone: string;
}

export class BookVehiclePage {
  constructor(private readonly page: Page) {}

  async expectLoaded() {
    await expect(
      this.page.getByRole("heading", { level: 1, name: "Book an inspection" }),
    ).toBeVisible();
    await expect(
      this.page.getByText("Tell us about the car. It takes about two minutes."),
    ).toBeVisible();
    await expect(
      this.page.getByRole("list", { name: "Booking steps" }),
    ).toBeVisible();
  }

  async fill(v: BookingVehicle) {
    await this.page.getByLabel("VIN", { exact: true }).fill(v.vin);
    await this.page.getByLabel("Odometer (km)", { exact: true }).fill(v.km);
    await this.page
      .getByLabel("Asking price ($)", { exact: true })
      .fill(v.price);
    await this.page
      .getByLabel("Listing link (optional)", { exact: true })
      .fill(v.url);
    await this.page.getByLabel("Seller’s name", { exact: true }).fill(v.name);
    await this.page.getByLabel("Seller’s phone", { exact: true }).fill(v.phone);
  }

  async continue() {
    await this.page
      .getByRole("button", { name: "Continue to review type" })
      .click();
  }

  async expectSummary(title: string, items: string[]) {
    const summary = this.page.getByRole("alert").filter({ hasText: title });
    await expect(summary).toBeVisible();
    for (const item of items)
      await expect(summary.getByRole("link", { name: item })).toBeVisible();
  }

  async expectFieldError(label: string, message: string) {
    const field = this.page.getByLabel(label, { exact: true });
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAccessibleDescription(message);
  }
}

export class ReviewTypePage {
  constructor(private readonly page: Page) {}

  async expectLoaded() {
    await expect(
      this.page.getByText("Pick the review that fits the car."),
    ).toBeVisible();
  }

  async choose(label: "Mechanic" | "Body shop" | "Both") {
    await this.page
      .getByRole("radio", { name: new RegExp(`^${label}`) })
      .check();
  }

  async expectTotal(total: string) {
    await expect(
      this.page
        .getByRole("region", { name: "Your order" })
        .getByText(`Total ${total}`, { exact: true }),
    ).toBeVisible();
  }

  async continue() {
    await this.page
      .getByRole("button", { name: "Continue to scheduling" })
      .click();
  }
}

export class SchedulePage {
  constructor(private readonly page: Page) {}

  async expectLoaded() {
    await expect(
      this.page.getByText("Choose a time. The seller joins from a text link."),
    ).toBeVisible();
  }

  async pick(startIso: string) {
    const l = slotLabels(startIso);
    await this.page.getByRole("button", { name: l.day, exact: true }).click();
    await this.page.getByRole("button", { name: l.time, exact: true }).click();
  }

  async expectMechanic(name: string) {
    await expect(this.page.getByText(name, { exact: true })).toBeVisible();
  }

  async continueToPayment() {
    await this.page
      .getByRole("button", { name: "Continue to payment" })
      .click();
  }

  async expectSlotTaken() {
    const status = this.page
      .getByRole("alert")
      .filter({ hasText: "We couldn’t hold that slot" });
    await expect(status).toBeVisible();
    await expect(
      status.getByText(
        "Someone just took it. Pick another time and you won’t lose your answers.",
      ),
    ).toBeVisible();
    await expect(
      status.getByRole("button", { name: "Choose another time" }),
    ).toBeVisible();
  }

  async chooseAnotherTime() {
    await this.page
      .getByRole("button", { name: "Choose another time" })
      .click();
  }

  async expectSlotMissing(startIso: string) {
    await expect(
      this.page.getByRole("button", {
        name: slotLabels(startIso).time,
        exact: true,
      }),
    ).toHaveCount(0);
  }
}

export class ConfirmedPage {
  constructor(private readonly page: Page) {}

  async expectBooked(startIso: string, mechanic: string) {
    const l = slotLabels(startIso);
    await expect(
      this.page.getByRole("heading", {
        level: 1,
        name: `You’re booked for ${l.longWeekday} at ${l.time}`,
      }),
    ).toBeVisible();
    await expect(
      this.page.getByText(`${mechanic} will inspect the car over video.`),
    ).toBeVisible();
  }

  async viewInspection() {
    await this.page.getByRole("link", { name: "View inspection" }).click();
  }
}

export class InspectionDetailPage {
  constructor(private readonly page: Page) {}

  async expectScheduled(vin: string, startIso: string, paid: string) {
    const l = slotLabels(startIso);
    await expect(
      this.page.getByRole("heading", { level: 1, name: vin }),
    ).toBeVisible();
    await expect(
      this.page.getByText(`Scheduled · ${l.day}, ${l.time}`),
    ).toBeVisible();
    await expect(this.page.getByText(`Paid ${paid}`)).toBeVisible();
  }
}
