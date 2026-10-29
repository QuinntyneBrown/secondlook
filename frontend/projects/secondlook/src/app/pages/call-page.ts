import { Dialog } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiProblem, CALLS_API, CallState } from 'api';
import { Alert, Button } from 'components';
import { AddNoteDialog } from '../dialogs/add-note-dialog';
import { EndCallDialog } from '../dialogs/end-call-dialog';
import { CallDevices, StreamVideo, openLocalMedia, stopStream } from '../util/call-devices';

interface Remote {
  userId: string;
  name: string;
  role: string;
  stream: MediaStream | null;
}

type Phase = 'connecting' | 'live' | 'reconnecting' | 'disconnected' | 'ended' | 'unavailable';

/** Waits before each reconnection attempt: about six seconds in all (ADR 0012). */
const RECONNECT_DELAYS = [1200, 1800, 2400];

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A live inspection call (L2-041 to L2-044). Media flows peer to peer over WebRTC; the API's signalling socket
 * only introduces the participants and relays offers, answers and ICE candidates (ADR 0012).
 */
@Component({
  selector: 'sl-call-page',
  imports: [Alert, Button, RouterLink, StreamVideo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (phase() === 'ended' && call(); as c) {
      <main class="summary">
        <h1>Call ended</h1>
        <p>That’s the call.</p>
        <p>Call length: {{ length(c) }}</p>
        @if (checked(c).length) {
          <p>Checked: {{ checked(c).join(', ') }}</p>
        }
        @if (unchecked(c).length) {
          <p>Not checked: {{ unchecked(c).join(', ') }}</p>
        }
        <div class="actions">
          @if (c.you.role === 'Mechanic') {
            <sl-button [routerLink]="'/inspections/' + c.inspectionId + '/estimate'"
              >Write the report</sl-button
            >
          }
          @if (c.you.role === 'BodyShop') {
            <sl-button [routerLink]="'/inspections/' + c.inspectionId + '/body-review'"
              >Write the body review</sl-button
            >
          }
          <sl-button variant="outline" [routerLink]="'/inspections/' + c.inspectionId"
            >Back to inspection</sl-button
          >
        </div>
      </main>
    } @else if (phase() === 'unavailable') {
      <main class="summary">
        <sl-alert
          [title]="
            problem()?.status === 404 ? 'We couldn’t find that call' : 'We couldn’t join this call'
          "
          [text]="
            problem()?.status === 404
              ? 'Check the link, or open the call from your inspections.'
              : 'The call may not be open yet, or the inspection was cancelled.'
          "
        >
          <a routerLink="/inspections">All inspections</a>
        </sl-alert>
      </main>
    } @else {
      <header class="bar">
        <span role="status" class="chip" [class.live]="phase() === 'live'">{{ chip() }}</span>
        <button type="button" class="ctl" (click)="leave()">Leave</button>
      </header>
      <main class="call">
        @if (call(); as c) {
          <h1 class="vh">Live inspection: {{ c.vehicleName }}</h1>
        }
        <div class="stage">
          @if (banner(); as b) {
            <sl-alert variant="success" [title]="b.title" [text]="b.text" />
          }
          @if (phase() === 'reconnecting') {
            <sl-alert
              title="Your connection dropped"
              text="We’re reconnecting you. The mechanic and the seller can still hear each other."
            />
          }
          @if (phase() === 'disconnected') {
            <sl-alert
              title="We couldn’t reconnect"
              text="Your seller and mechanic are still on the call. Rejoin to carry on; your place is saved."
            >
              <sl-button (pressed)="rejoin()">Rejoin the call</sl-button>
            </sl-alert>
          }
          <div class="tiles">
            @for (r of remotes(); track r.userId) {
              <figure class="tile" [attr.aria-label]="r.name">
                <video [slStream]="r.stream"></video>
                <figcaption>{{ r.name }} · {{ roleName(r.role) }}</figcaption>
              </figure>
            }
            <figure class="tile self" aria-label="You">
              <video [slStream]="local()" muted></video>
              <figcaption>You</figcaption>
            </figure>
          </div>
          <div class="controls">
            <button type="button" class="ctl" [attr.aria-pressed]="muted()" (click)="toggleMute()">
              Mute
            </button>
            <button
              type="button"
              class="ctl"
              [attr.aria-pressed]="cameraOff()"
              (click)="toggleCamera()"
            >
              Camera off
            </button>
            <button type="button" class="ctl danger" (click)="confirmEnd()">End call</button>
          </div>
        </div>
        @if (call(); as c) {
          <aside class="side" aria-label="Inspection details">
            <section>
              <h2>Checklist</h2>
              <ol aria-label="Inspection checklist">
                @for (item of c.checklist; track item.name) {
                  <li [attr.aria-current]="item.state === 'Now' ? 'step' : null">
                    {{ item.name }}<span class="state">{{ item.state }}</span>
                  </li>
                }
              </ol>
              @if (c.you.role === 'Mechanic') {
                <div class="actions">
                  <sl-button variant="outline" (pressed)="advance()"
                    >Mark done, next item</sl-button
                  >
                  <sl-button variant="outline" (pressed)="addNote()">Add a note</sl-button>
                </div>
              }
            </section>
            @if (mechanicFirstName(c); as first) {
              @if (c.notes.length) {
                <section [attr.aria-label]="'Notes from ' + first">
                  <h2>Notes from {{ first }}</h2>
                  @for (n of c.notes; track $index) {
                    <p>{{ n.text }}</p>
                  }
                </section>
              }
            }
          </aside>
        }
      </main>
    }
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      font-family: var(--fontFamilyBase);
      color: var(--colorNeutralForeground1);
    }
    h1,
    h2,
    p {
      margin: 0;
    }
    .vh {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
    .summary {
      display: grid;
      gap: var(--spacingVerticalM);
      width: min(560px, 100%);
      padding: var(--spacingVerticalXXL) var(--spacingHorizontalL);
    }
    .bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--spacingVerticalM) var(--spacingHorizontalL);
      border-bottom: var(--strokeWidthThin) solid var(--colorNeutralStroke2);
    }
    .chip {
      font-weight: var(--fontWeightSemibold);
      color: var(--colorNeutralForeground2);
    }
    .chip.live {
      color: var(--colorStatusDangerForeground1);
    }
    .call {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);
      gap: var(--spacingHorizontalXXL);
      padding: var(--spacingVerticalL);
    }
    @media (max-width: 800px) {
      .call {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .stage,
    .side {
      display: grid;
      align-content: start;
      gap: var(--spacingVerticalL);
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: var(--spacingHorizontalM);
    }
    .tile {
      position: relative;
      margin: 0;
      aspect-ratio: 4 / 3;
      border-radius: var(--borderRadiusMedium);
      background: var(--colorNeutralBackground3);
      overflow: hidden;
    }
    .tile video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    figcaption {
      position: absolute;
      left: var(--spacingHorizontalM);
      bottom: var(--spacingVerticalS);
      padding: 2px var(--spacingHorizontalS);
      border-radius: var(--borderRadiusSmall);
      background: var(--colorNeutralBackground1);
    }
    .controls,
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacingHorizontalM);
    }
    .ctl {
      min-height: 40px;
      padding: 0 var(--spacingHorizontalXXL);
      border: var(--strokeWidthThin) solid var(--colorNeutralStroke1);
      border-radius: var(--borderRadiusMedium);
      background: var(--colorNeutralBackground1);
      color: var(--colorNeutralForeground1);
      font: var(--fontWeightSemibold) var(--fontSizeBase300) / var(--lineHeightBase300)
        var(--fontFamilyBase);
      cursor: pointer;
    }
    .ctl:focus-visible {
      outline: 2px solid var(--colorBrandStroke1);
      outline-offset: 2px;
    }
    .ctl[aria-pressed='true'] {
      background: var(--colorNeutralForeground1);
      color: var(--colorNeutralBackground1);
    }
    .ctl.danger {
      border-color: var(--colorStatusDangerForeground1);
      background: var(--colorStatusDangerBackground1);
      color: var(--colorStatusDangerForeground1);
    }
    ol {
      display: grid;
      gap: var(--spacingVerticalS);
      margin: var(--spacingVerticalS) 0 var(--spacingVerticalM);
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      justify-content: space-between;
      color: var(--colorNeutralForeground3);
    }
    li[aria-current='step'] {
      color: var(--colorNeutralForeground1);
      font-weight: var(--fontWeightSemibold);
    }
    .state {
      color: var(--colorNeutralForeground2);
    }
  `,
})
export class CallPage implements OnInit {
  private readonly api = inject(CALLS_API);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  private readonly devices = inject(CallDevices);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly call = signal<CallState | null>(null);
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly phase = signal<Phase>('connecting');
  protected readonly local = signal<MediaStream | null>(null);
  protected readonly remotes = signal<Remote[]>([]);
  protected readonly banner = signal<{ title: string; text: string } | null>(null);
  protected readonly muted = signal(false);
  protected readonly cameraOff = signal(false);
  private readonly now = signal(Date.now());

  protected readonly chip = computed(() => {
    switch (this.phase()) {
      case 'live': {
        const started = Date.parse(this.call()?.startedAt ?? '') || this.now();
        const s = Math.max(0, Math.floor((this.now() - started) / 1000));
        return `Live ${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
      }
      case 'reconnecting':
        return 'Reconnecting';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Connecting';
    }
  });

  private socket: WebSocket | null = null;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private bannerTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly pcs = new Map<string, RTCPeerConnection>();
  private readonly queuedIce = new Map<string, RTCIceCandidateInit[]>();
  /** Signalling messages are handled one at a time, in the order they arrived. */
  private inbox: Promise<void> = Promise.resolve();

  constructor() {
    const tick = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(tick);
      this.teardown();
      stopStream(this.local());
    });
  }

  ngOnInit() {
    this.api.get(this.id).subscribe({
      next: (c) => (c.status === 'Ended' ? this.finish(c) : this.start()),
      error: (p: ApiProblem) => this.unavailable(p),
    });
  }

  private start() {
    this.api.join(this.id).subscribe({
      next: async (c) => {
        this.call.set(c);
        if (!this.local()) {
          const media = await openLocalMedia(this.devices);
          this.local.set(media.stream);
        }
        this.connect();
      },
      error: (p: ApiProblem) => this.unavailable(p),
    });
  }

  private unavailable(p: ApiProblem) {
    this.problem.set(p);
    this.phase.set('unavailable');
  }

  private finish(c: CallState) {
    this.teardown();
    stopStream(this.local());
    this.local.set(null);
    this.call.set(c);
    this.phase.set('ended');
  }

  // --- signalling -------------------------------------------------------------------------------

  private connect() {
    const ws = new WebSocket(this.api.socketUrl(this.id));
    this.socket = ws;
    ws.onmessage = (e) => {
      if (ws === this.socket) this.handle(JSON.parse(e.data as string));
    };
    ws.onclose = () => {
      if (ws !== this.socket) return;
      this.socket = null;
      this.lost();
    };
  }

  private handle(m: {
    type: string;
    peers?: { userId: string; name: string; role: string }[];
    peer?: { userId: string; name: string; role: string };
    userId?: string;
    from?: string;
    data?: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
  }) {
    switch (m.type) {
      case 'welcome':
        this.attempt = 0;
        this.closePeers();
        this.phase.set('live');
        this.remotes.set((m.peers ?? []).map((p) => ({ ...p, stream: null })));
        for (const p of m.peers ?? []) void this.offerTo(p.userId);
        break;
      case 'peer-joined':
        if (m.peer) this.peerJoined(m.peer);
        break;
      case 'peer-left':
        if (m.userId) this.peerLeft(m.userId);
        break;
      case 'signal':
        if (m.from && m.data) {
          const { from, data } = m;
          this.inbox = this.inbox.then(() => this.onSignal(from, data)).catch(() => undefined);
        }
        break;
      case 'changed':
        this.api.get(this.id).subscribe({ next: (c) => this.call.set(c) });
        break;
      case 'ended':
        this.api.get(this.id).subscribe({ next: (c) => this.finish(c) });
        break;
    }
  }

  private send(to: string, data: object) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'signal', to, data }));
    }
  }

  /** The socket closed without us asking: say so, and try to get back in a few times before giving up. */
  private lost() {
    if (this.phase() === 'ended' || this.phase() === 'unavailable') return;
    this.closePeers();
    this.remotes.set([]);
    if (this.attempt >= RECONNECT_DELAYS.length) {
      this.phase.set('disconnected');
      return;
    }
    this.phase.set('reconnecting');
    this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAYS[this.attempt++]);
  }

  protected rejoin() {
    this.attempt = 0;
    this.phase.set('connecting');
    this.start();
  }

  // --- peer connections -------------------------------------------------------------------------

  private peerJoined(peer: { userId: string; name: string; role: string }) {
    this.closePeer(peer.userId);
    this.remotes.update((all) => [
      ...all.filter((r) => r.userId !== peer.userId),
      { ...peer, stream: null },
    ]);
    const first = this.mechanicOrName(peer);
    this.banner.set({ title: `${peer.name} joined`, text: `${first} is on the call.` });
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.banner.set(null), 20000);
  }

  private mechanicOrName(peer: { name: string; role: string }) {
    if (peer.role === 'Mechanic') return 'The mechanic';
    if (peer.role === 'BodyShop') return 'The body shop reviewer';
    return peer.name;
  }

  private peerLeft(userId: string) {
    this.closePeer(userId);
    this.remotes.update((all) => all.filter((r) => r.userId !== userId));
  }

  private connection(userId: string) {
    const pc = new RTCPeerConnection();
    const local = this.local();
    local?.getTracks().forEach((t) => pc.addTrack(t, local));
    pc.onicecandidate = (e) => {
      if (e.candidate) this.send(userId, { candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      this.remotes.update((all) => all.map((r) => (r.userId === userId ? { ...r, stream } : r)));
    };
    this.pcs.set(userId, pc);
    return pc;
  }

  private async offerTo(userId: string) {
    const pc = this.connection(userId);
    await pc.setLocalDescription(await pc.createOffer());
    this.send(userId, { sdp: pc.localDescription });
  }

  private async onSignal(
    from: string,
    data: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit },
  ) {
    if (data.sdp?.type === 'offer') {
      this.closePeer(from);
      const pc = this.connection(from);
      await pc.setRemoteDescription(data.sdp);
      await this.flushIce(from, pc);
      await pc.setLocalDescription(await pc.createAnswer());
      this.send(from, { sdp: pc.localDescription });
    } else if (data.sdp?.type === 'answer') {
      const pc = this.pcs.get(from);
      if (!pc) return;
      await pc.setRemoteDescription(data.sdp);
      await this.flushIce(from, pc);
    } else if (data.candidate) {
      const pc = this.pcs.get(from);
      if (pc?.remoteDescription) await pc.addIceCandidate(data.candidate);
      else this.queuedIce.set(from, [...(this.queuedIce.get(from) ?? []), data.candidate]);
    }
  }

  private async flushIce(userId: string, pc: RTCPeerConnection) {
    for (const c of this.queuedIce.get(userId) ?? []) await pc.addIceCandidate(c);
    this.queuedIce.delete(userId);
  }

  private closePeer(userId: string) {
    this.pcs.get(userId)?.close();
    this.pcs.delete(userId);
    this.queuedIce.delete(userId);
  }

  private closePeers() {
    for (const id of [...this.pcs.keys()]) this.closePeer(id);
  }

  private teardown() {
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.bannerTimer);
    const ws = this.socket;
    this.socket = null;
    ws?.close();
    this.closePeers();
  }

  // --- controls ---------------------------------------------------------------------------------

  protected toggleMute() {
    this.muted.update((m) => !m);
    this.local()
      ?.getAudioTracks()
      .forEach((t) => (t.enabled = !this.muted()));
  }

  protected toggleCamera() {
    this.cameraOff.update((o) => !o);
    this.local()
      ?.getVideoTracks()
      .forEach((t) => (t.enabled = !this.cameraOff()));
  }

  protected leave() {
    this.teardown();
    stopStream(this.local());
    this.local.set(null);
    void this.router.navigate(['/inspections', this.id]);
  }

  protected confirmEnd() {
    const c = this.call();
    const ref = this.dialog.open<boolean>(EndCallDialog, {
      data: {
        others: this.remotes().map((r) => r.name),
        left: (c?.checklist ?? []).filter((i) => i.state !== 'Done').map((i) => i.name),
      },
      ariaLabelledBy: 'end-call-title',
      ariaDescribedBy: 'end-call-description',
      autoFocus: '.stay button',
      backdropClass: 'sl-dialog-backdrop',
    });
    ref.closed.subscribe((ok) => {
      if (ok) this.api.end(this.id).subscribe({ next: (ended) => this.finish(ended) });
    });
  }

  protected advance() {
    this.api.advanceChecklist(this.id).subscribe({ next: (c) => this.call.set(c) });
  }

  protected addNote() {
    const ref = this.dialog.open<CallState>(AddNoteDialog, {
      data: this.id,
      ariaLabelledBy: 'add-note-title',
      backdropClass: 'sl-dialog-backdrop',
    });
    ref.closed.subscribe((c) => {
      if (c) this.call.set(c);
    });
  }

  // --- presentation -----------------------------------------------------------------------------

  protected roleName(role: string) {
    return role === 'BodyShop' ? 'body shop reviewer' : role.toLowerCase();
  }

  protected mechanicFirstName(c: CallState) {
    return c.participants.find((p) => p.role === 'Mechanic')?.name.split(' ')[0] ?? null;
  }

  protected checked(c: CallState) {
    return c.checklist.filter((i) => i.state === 'Done').map((i) => i.name);
  }

  protected unchecked(c: CallState) {
    return c.checklist.filter((i) => i.state !== 'Done').map((i) => i.name);
  }

  protected length(c: CallState) {
    const s = c.durationSeconds ?? 0;
    return `${Math.floor(s / 60)} min ${s % 60} s`;
  }
}
