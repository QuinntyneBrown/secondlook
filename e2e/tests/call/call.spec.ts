import { test, expect, type Browser, type Page } from "@playwright/test";
import { SignInPage } from "../../pages/AccountPages";
import { CallLobbyPage, CallPage } from "../../pages/CallPages";
import {
  bookedInspection,
  newBuyer,
  PASSWORD,
} from "../../fixtures/bookingApi";

async function signInAs(page: Page, email: string, password: string) {
  const sign = new SignInPage(page);
  await sign.open();
  await sign.signIn(email, password);
  // Buyers land on their inspections, providers on their availability.
  await page.waitForURL(/\/(inspections|availability)$/);
}

/** A second, separate browser session for the mechanic, with its own synthetic camera and microphone. */
async function mechanicSession(browser: Browser) {
  const context = await browser.newContext({
    permissions: ["camera", "microphone"],
  });
  const page = await context.newPage();
  await signInAs(page, "mechanic@example.test", "Password-123!");
  return { context, page };
}

async function buyerSession(
  page: Page,
  request: Parameters<typeof bookedInspection>[0],
) {
  const booked = await bookedInspection(request);
  await signInAs(page, booked.buyer.email, PASSWORD);
  return booked;
}

test.describe("Join a live video inspection (J10)", () => {
  // L2-039, L2-041, L2-044 AC1: two real sessions join the same call and see each other's synthetic video.
  test("the buyer and the mechanic join one live call", async ({
    page,
    browser,
    request,
  }) => {
    const booked = await buyerSession(page, request);
    const lobby = new CallLobbyPage(page);
    await lobby.open(booked.id);
    await lobby.expectLoaded();
    await lobby.expectPerson("Mo Mover", "Buyer", "Ready");
    await lobby.expectPerson("Maya Mechanic", "Mechanic", "Not joined");
    await lobby.expectPerson("Sam Whitaker", "Seller", "Not joined");
    await lobby.join();
    const buyerCall = new CallPage(page);
    await buyerCall.expectLive();

    const mech = await mechanicSession(browser);
    const mechLobby = new CallLobbyPage(mech.page);
    await mechLobby.open(booked.id);
    await mechLobby.expectLoaded();
    await mechLobby.expectPerson("Mo Mover", "Buyer", "Here");
    await mechLobby.join();
    const mechanicCall = new CallPage(mech.page);
    await mechanicCall.expectLive();

    await buyerCall.expectBanner(
      "Maya Mechanic joined",
      "The mechanic is on the call.",
    );
    await buyerCall.expectRemoteVideo("Maya Mechanic");
    await mechanicCall.expectRemoteVideo("Mo Mover");
    await buyerCall.expectPresent("You");
    await buyerCall.toggle("Mute");
    await buyerCall.toggle("Camera off");
    await mech.context.close();
  });

  // L2-039: the booked inspection leads into its lobby.
  test("the inspection page leads into the call lobby", async ({
    page,
    request,
  }) => {
    const booked = await buyerSession(page, request);
    const lobby = new CallLobbyPage(page);
    await lobby.openFromInspection(booked.id);
    await lobby.expectLoaded();
  });

  // L2-040: a blocked camera is explained, and the buyer can still join with audio only.
  test("a blocked camera still allows audio only", async ({
    page,
    browser,
    request,
  }) => {
    const booked = await bookedInspection(request);
    await signInAs(page, booked.buyer.email, PASSWORD);
    const lobby = new CallLobbyPage(page);
    await lobby.blockCamera();
    await lobby.open(booked.id);
    await lobby.expectCameraBlocked();
    await lobby.joinAudioOnly();
    await new CallPage(page).expectLive();

    const mech = await mechanicSession(browser);
    const mechLobby = new CallLobbyPage(mech.page);
    await mechLobby.open(booked.id);
    await mechLobby.join();
    const mechanicCall = new CallPage(mech.page);
    await mechanicCall.expectLive();
    await mechanicCall.expectPresent("Mo Mover");
    await new CallPage(page).expectRemoteVideo("Maya Mechanic");
    await mech.context.close();
  });

  // L2-039: before a call opens the buyer can check devices but not join.
  test("a call that has not opened cannot be joined yet", async ({
    page,
    request,
  }) => {
    const booked = await bookedInspection(request);
    await signInAs(page, booked.buyer.email, PASSWORD);
    const lobby = new CallLobbyPage(page);
    await lobby.pretendCallOpensLater();
    await lobby.open(booked.id);
    await lobby.expectLoaded();
    await lobby.expectNotOpenYet();
  });

  // L2-041 AC3, AC4: the mechanic runs the checklist and adds notes; the buyer watches them change.
  test("the mechanic moves the checklist and adds notes the buyer sees", async ({
    page,
    browser,
    request,
  }) => {
    const booked = await buyerSession(page, request);
    const lobby = new CallLobbyPage(page);
    await lobby.open(booked.id);
    await lobby.join();
    const buyerCall = new CallPage(page);
    await buyerCall.expectLive();
    const mech = await mechanicSession(browser);
    const mechLobby = new CallLobbyPage(mech.page);
    await mechLobby.open(booked.id);
    await mechLobby.join();
    const mechanicCall = new CallPage(mech.page);
    await mechanicCall.expectLive();

    await buyerCall.expectBuyerCannotEditChecklist();
    await buyerCall.expectChecklist({
      Brakes: "Now",
      Tires: "Next",
      "Body panels": "Next",
    });
    await mechanicCall.advanceChecklist();
    await buyerCall.expectChecklist({
      Brakes: "Done",
      Tires: "Now",
      Suspension: "Next",
    });
    await mechanicCall.addNote("Front brake pads look thin.");
    await buyerCall.expectNote("Maya", "Front brake pads look thin.");
    await mech.context.close();
  });

  // L2-042: a dropped connection is announced and recovers by itself; a failed one offers to rejoin.
  test("a dropped connection reconnects, and a failed one can be rejoined", async ({
    page,
    browser,
    request,
  }) => {
    const booked = await buyerSession(page, request);
    const buyerCall = new CallPage(page);
    await buyerCall.watchConnection();
    const lobby = new CallLobbyPage(page);
    await lobby.open(booked.id);
    await lobby.join();
    await buyerCall.expectLive();
    const mech = await mechanicSession(browser);
    const mechLobby = new CallLobbyPage(mech.page);
    await mechLobby.open(booked.id);
    await mechLobby.join();
    await new CallPage(mech.page).expectLive();
    await buyerCall.expectRemoteVideo("Maya Mechanic");

    // The first drop recovers without the buyer doing anything, and the video flows again.
    await buyerCall.dropConnection();
    await buyerCall.expectReconnecting();
    await buyerCall.expectLive();
    await buyerCall.expectRemoteVideo("Maya Mechanic");

    // A drop that cannot reconnect ends in "Disconnected"; the saved place makes rejoining one click.
    await buyerCall.dropConnection({ stayDown: true });
    await buyerCall.expectDisconnected();
    buyerCall.restoreConnection();
    await buyerCall.rejoin();
    await buyerCall.expectLive();
    await buyerCall.expectRemoteVideo("Maya Mechanic");
    await mech.context.close();
  });

  // L2-043: ending asks first, is for everyone, and leaves a summary for both sides.
  test("ending the call ends it for everyone", async ({
    page,
    browser,
    request,
  }) => {
    const booked = await buyerSession(page, request);
    const lobby = new CallLobbyPage(page);
    await lobby.open(booked.id);
    await lobby.join();
    const buyerCall = new CallPage(page);
    await buyerCall.expectLive();
    const mech = await mechanicSession(browser);
    const mechLobby = new CallLobbyPage(mech.page);
    await mechLobby.open(booked.id);
    await mechLobby.join();
    const mechanicCall = new CallPage(mech.page);
    await mechanicCall.expectLive();
    await mechanicCall.advanceChecklist();
    await buyerCall.expectChecklist({ Tires: "Now" });

    await buyerCall.startEndingCall(
      "Left on the checklist: Tires, Suspension, Steering, Lights, horn, wipers, Body panels",
    );
    await buyerCall.stayOnTheCall();
    await buyerCall.expectLive();
    await buyerCall.startEndingCall("Tires");
    await buyerCall.confirmEndCall();
    const left = [
      "Tires",
      "Suspension",
      "Steering",
      "Lights, horn, wipers",
      "Body panels",
    ];
    await buyerCall.expectEnded(["Brakes"], left);
    await mechanicCall.expectEnded(["Brakes"], left);
    await mech.context.close();
  });

  // L2-057, L2-058: a buyer who does not own the inspection finds nothing.
  test("someone else's call is not found", async ({ page, request }) => {
    const booked = await bookedInspection(request);
    const stranger = await newBuyer(request, "Ida Intruder");
    await signInAs(page, stranger.email, PASSWORD);
    const lobby = new CallLobbyPage(page);
    await lobby.open(booked.id);
    await lobby.expectNotFound();
    await expect(page.getByText("Maya Mechanic")).toHaveCount(0);
  });
});
