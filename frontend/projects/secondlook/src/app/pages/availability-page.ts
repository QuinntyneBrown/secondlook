import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiProblem, AVAILABILITY_API, AvailabilityWindow } from 'api';
import { Alert, Button, EmptyState } from 'components';
import { RemoveWindowDialog } from '../dialogs/remove-window-dialog';
import { WindowDialog } from '../dialogs/window-dialog';
import { Session } from '../session';
import { dayLabel, timeLabel } from '../util/eastern-time';

type View = 'loading' | 'ready' | 'failed' | 'not-approved' | 'providers-only';

const SLOT_MS = 30 * 60 * 1000;

/** A provider's availability windows (L2-061). Add, edit and remove open dialogs. */
@Component({
  selector: 'sl-availability-page',
  imports: [Alert, Button, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view() === 'providers-only') {
      <sl-empty-state
        code="403"
        title="Providers only"
        text="Only mechanics and body shops set availability. Your inspections are one tap away."
      >
        <div slot="actions" style="display: contents">
          <sl-button routerLink="/inspections">Go to inspections</sl-button>
        </div>
      </sl-empty-state>
    } @else {
      <header class="bar">
        <span>{{ session.displayName() }}</span>
        <sl-button variant="outline" (pressed)="signOut()">Sign out</sl-button>
      </header>
      <div class="head">
        <div>
          <h1>Your availability</h1>
          <p class="sub">{{ subtitle() }}</p>
        </div>
        @if (view() !== 'not-approved') {
          <sl-button (pressed)="openWindow()">Add availability</sl-button>
        }
      </div>

      @if (view() === 'not-approved') {
        <sl-alert
          variant="info"
          title="Your account isn’t approved yet"
          text="You can set your availability once an administrator approves you. We’ll show it here as soon as you’re approved."
        />
      } @else if (view() === 'failed') {
        <sl-alert
          title="We couldn’t load your availability"
          text="The list didn’t come through. Nothing was changed. Try again in a moment."
        >
          <sl-button variant="outline" (pressed)="load()">Try again</sl-button>
        </sl-alert>
      } @else if (view() === 'ready' && windows().length === 0) {
        <div class="none">
          <h2>No availability yet</h2>
          <p>Add the times you can take inspections. Buyers can only book times you save here.</p>
        </div>
      } @else {
        <div [attr.aria-busy]="view() === 'loading' ? 'true' : null">
          <table>
            <caption class="sr-only">
              Your availability windows
            </caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Hours (Eastern Time)</th>
                <th scope="col">Slots</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (w of windows(); track w.id) {
                <tr>
                  <th scope="row">{{ day(w) }}</th>
                  <td>{{ hours(w) }}</td>
                  <td>{{ slots(w) }}</td>
                  <td class="actions">
                    <sl-button variant="outline" (pressed)="openWindow(w)">Edit</sl-button>
                    <sl-button variant="outline" (pressed)="openRemove(w)">Remove</sl-button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (view() === 'loading') {
          <p role="status" class="sr-only">Loading your availability</p>
        }
      }
    }
  `,
  styles: `
    :host {
      display: block;
      padding: var(--spacingVerticalXXL) var(--spacingHorizontalL);
      font-family: var(--fontFamilyBase);
      color: var(--colorNeutralForeground1);
    }
    .bar,
    .head {
      display: flex;
      align-items: center;
      gap: var(--spacingHorizontalM);
      margin-bottom: var(--spacingVerticalL);
    }
    .bar {
      justify-content: flex-end;
    }
    .head {
      justify-content: space-between;
    }
    h1,
    h2,
    p {
      margin: 0;
    }
    .sub {
      color: var(--colorNeutralForeground2);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      padding: var(--spacingVerticalM) var(--spacingHorizontalM);
      border-bottom: var(--strokeWidthThin) solid var(--colorNeutralStroke2);
      text-align: left;
    }
    .actions {
      display: flex;
      gap: var(--spacingHorizontalS);
    }
    .none {
      display: grid;
      gap: var(--spacingVerticalS);
      padding: var(--spacingVerticalXXL) 0;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  `,
})
export class AvailabilityPage {
  private readonly api = inject(AVAILABILITY_API);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  protected readonly session = inject(Session);

  protected readonly view = signal<View>('loading');
  protected readonly windows = signal<AvailabilityWindow[]>([]);

  constructor() {
    this.load();
  }

  protected subtitle() {
    if (this.view() === 'loading') return 'Loading your availability';
    if (this.view() === 'ready' && this.windows().length === 0) return 'Nothing saved yet';
    return 'Times buyers can book, in Eastern Time.';
  }

  protected day = (w: AvailabilityWindow) => dayLabel(w.start);
  protected hours = (w: AvailabilityWindow) => `${timeLabel(w.start)} – ${timeLabel(w.end)}`;
  protected slots(w: AvailabilityWindow) {
    const n = Math.floor((Date.parse(w.end) - Date.parse(w.start)) / SLOT_MS);
    return `${n} ${n === 1 ? 'slot' : 'slots'}`;
  }

  protected load() {
    this.view.set('loading');
    this.api.list().subscribe({
      next: (list) => {
        this.windows.set(list);
        this.view.set('ready');
      },
      error: (p: ApiProblem) =>
        this.view.set(
          p.status === 403 && p.title === 'Your account isn’t approved yet'
            ? 'not-approved'
            : p.status === 403
              ? 'providers-only'
              : 'failed',
        ),
    });
  }

  protected openWindow(window?: AvailabilityWindow) {
    const ref = this.dialog.open<AvailabilityWindow>(WindowDialog, {
      data: { window },
      ariaLabelledBy: 'window-title',
      ariaDescribedBy: 'window-description',
      backdropClass: 'sl-dialog-backdrop',
    });
    ref.closed.subscribe((saved) => {
      if (saved) this.load();
    });
  }

  protected openRemove(window: AvailabilityWindow) {
    const ref = this.dialog.open<boolean>(RemoveWindowDialog, {
      data: { window },
      ariaLabelledBy: 'remove-title',
      ariaDescribedBy: 'remove-description',
      backdropClass: 'sl-dialog-backdrop',
    });
    ref.closed.subscribe((removed) => {
      if (removed) this.load();
    });
  }

  protected signOut() {
    this.session.end();
    void this.router.navigateByUrl('/sign-in');
  }
}
