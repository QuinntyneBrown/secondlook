import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiProblem, CALLS_API, CallParticipant, CallState } from 'api';
import { Alert, Button } from 'components';
import {
  CallDevices,
  CameraState,
  StreamVideo,
  openLocalMedia,
  stopStream,
} from '../util/call-devices';
import { callTime, timeLabel } from '../util/eastern-time';

interface Choice {
  id: string;
  label: string;
}

const ROLE_LABEL: Record<string, string> = {
  Buyer: 'Buyer',
  Mechanic: 'Mechanic',
  BodyShop: 'Body shop reviewer',
  Seller: 'Seller',
};

/** The lobby before a live call (L2-039, L2-040): check the camera and mic, see who is here, then join. */
@Component({
  selector: 'sl-call-lobby-page',
  imports: [Alert, Button, RouterLink, StreamVideo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page" [attr.aria-busy]="call() || problem() ? null : 'true'">
      @if (call(); as c) {
        <h1>Check your camera and mic</h1>
        <p class="sub">{{ when(c) }}</p>
        <div class="split">
          <div class="card">
            <figure [attr.aria-label]="camera() === 'ready' ? 'You' : 'You · camera blocked'">
              @if (camera() === 'ready' && stream()) {
                <video [slStream]="stream()" muted></video>
              } @else if (camera() !== 'ready') {
                <span class="none">No camera available</span>
              }
              <figcaption>You</figcaption>
            </figure>
            @if (camera() === 'blocked') {
              <sl-alert
                title="Your browser is blocking the camera"
                text="Click the camera icon in the address bar, choose Allow, then reload. You can still join with audio only; the mechanic talks to the seller, not you."
              >
                <sl-button variant="outline" (pressed)="check()">Check again</sl-button>
              </sl-alert>
            }
            <div class="devices">
              <div class="device">
                <label for="camera">Camera</label>
                <select id="camera" [disabled]="camera() !== 'ready'" (change)="pickCamera($event)">
                  @if (camera() !== 'ready') {
                    <option>Camera unavailable</option>
                  }
                  @for (d of cameras(); track d.id) {
                    <option [value]="d.id" [selected]="d.id === devices.cameraId">
                      {{ d.label }}
                    </option>
                  }
                </select>
              </div>
              <div class="device">
                <label for="microphone">Microphone</label>
                <select id="microphone" (change)="pickMicrophone($event)">
                  @for (d of microphones(); track d.id) {
                    <option [value]="d.id" [selected]="d.id === devices.microphoneId">
                      {{ d.label }}
                    </option>
                  }
                </select>
              </div>
            </div>
          </div>
          <aside class="card">
            <h2>Who’s here</h2>
            <ul>
              @for (p of c.participants; track $index) {
                <li>
                  <span class="who">
                    <strong>{{ p.name }}</strong>
                    <span class="role">{{ role(p) }}</span>
                  </span>
                  <span class="state" [class.here]="state(c, p) !== 'Not joined'">{{
                    state(c, p)
                  }}</span>
                </li>
              }
            </ul>
            @if (!open(c)) {
              <p>The call opens at {{ time(c.opensAt) }}</p>
            }
            @if (camera() === 'ready') {
              <sl-button [disabled]="!open(c)" (pressed)="join(false)">Join the call</sl-button>
            } @else {
              <sl-button [disabled]="!open(c)" (pressed)="join(true)"
                >Join with audio only</sl-button
              >
            }
          </aside>
        </div>
        <a [routerLink]="['/inspections', c.inspectionId]">Back to inspection</a>
      } @else if (problem(); as p) {
        <sl-alert
          title="We couldn’t find that call"
          [text]="
            p.status === 404
              ? 'Check the link, or open the call from your inspections.'
              : 'Try again in a moment.'
          "
        >
          <a routerLink="/inspections">All inspections</a>
        </sl-alert>
      } @else {
        <p role="status">Loading the call…</p>
      }
    </main>
  `,
  styles: `
    :host {
      display: block;
      padding: var(--spacingVerticalXXL) var(--spacingHorizontalL);
      font-family: var(--fontFamilyBase);
      color: var(--colorNeutralForeground1);
    }
    .page {
      display: grid;
      gap: var(--spacingVerticalL);
      width: min(960px, 100%);
    }
    h1,
    h2,
    p {
      margin: 0;
    }
    .sub {
      color: var(--colorNeutralForeground2);
    }
    .split {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: var(--spacingHorizontalXXL);
    }
    .card {
      display: grid;
      align-content: start;
      gap: var(--spacingVerticalL);
      padding: var(--spacingVerticalL);
      border: var(--strokeWidthThin) solid var(--colorNeutralStroke2);
      border-radius: var(--borderRadiusLarge);
    }
    figure {
      position: relative;
      display: grid;
      place-items: center;
      min-height: 220px;
      margin: 0;
      border-radius: var(--borderRadiusMedium);
      background: var(--colorNeutralBackground3);
      overflow: hidden;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    figcaption {
      position: absolute;
      left: var(--spacingHorizontalM);
      bottom: var(--spacingVerticalS);
      color: var(--colorNeutralForeground1);
    }
    .none {
      color: var(--colorNeutralForeground3);
    }
    .devices {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--spacingHorizontalM);
    }
    .device {
      display: grid;
      gap: var(--spacingVerticalS);
    }
    label {
      color: var(--colorNeutralForeground2);
    }
    select {
      min-height: 36px;
      font: inherit;
    }
    ul {
      display: grid;
      gap: var(--spacingVerticalM);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      justify-content: space-between;
      gap: var(--spacingHorizontalM);
    }
    .who {
      display: grid;
    }
    .role {
      color: var(--colorNeutralForeground2);
    }
    .state {
      color: var(--colorNeutralForeground3);
    }
    .state.here {
      color: var(--colorStatusSuccessForeground1);
    }
  `,
})
export class CallLobbyPage implements OnInit {
  private readonly api = inject(CALLS_API);
  private readonly router = inject(Router);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly devices = inject(CallDevices);
  protected readonly call = signal<CallState | null>(null);
  protected readonly problem = signal<ApiProblem | null>(null);
  protected readonly stream = signal<MediaStream | null>(null);
  protected readonly camera = signal<CameraState>('ready');
  protected readonly cameras = signal<Choice[]>([]);
  protected readonly microphones = signal<Choice[]>([]);
  private readonly now = signal(Date.now());

  constructor() {
    inject(DestroyRef).onDestroy(() => stopStream(this.stream()));
  }

  ngOnInit() {
    this.devices.audioOnly = false;
    this.api.get(this.id).subscribe({
      next: (c) => this.call.set(c),
      error: (p: ApiProblem) => this.problem.set(p),
    });
    void this.check();
  }

  /** Opens the devices and lists them; also what "Check again" does. */
  protected async check() {
    stopStream(this.stream());
    const media = await openLocalMedia(this.devices);
    this.stream.set(media.stream);
    this.camera.set(media.camera);
    const all = (await navigator.mediaDevices?.enumerateDevices?.()) ?? [];
    const pick = (kind: MediaDeviceKind, fallback: string) =>
      all
        .filter((d) => d.kind === kind)
        .map((d, n) => ({ id: d.deviceId, label: d.label || `${fallback} ${n + 1}` }));
    this.cameras.set(pick('videoinput', 'Camera'));
    this.microphones.set(pick('audioinput', 'Microphone'));
  }

  protected pickCamera(e: Event) {
    this.devices.cameraId = (e.target as HTMLSelectElement).value;
    void this.check();
  }

  protected pickMicrophone(e: Event) {
    this.devices.microphoneId = (e.target as HTMLSelectElement).value;
    void this.check();
  }

  protected when(c: CallState) {
    return `${callTime(c.start)}`;
  }

  protected time(iso: string) {
    return timeLabel(iso);
  }

  protected open(c: CallState) {
    return Date.parse(c.opensAt) <= this.now();
  }

  protected role(p: CallParticipant) {
    return ROLE_LABEL[p.role] ?? p.role;
  }

  protected state(c: CallState, p: CallParticipant) {
    if (p.role === c.you.role && p.userId === c.you.userId) return 'Ready';
    return p.here ? 'Here' : 'Not joined';
  }

  protected join(audioOnly: boolean) {
    this.devices.audioOnly = audioOnly;
    stopStream(this.stream());
    this.stream.set(null);
    void this.router.navigate(['/inspections', this.id, 'call']);
  }
}
