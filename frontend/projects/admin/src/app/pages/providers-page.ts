import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ADMIN_PROVIDERS_API,
  ApiProblem,
  ApprovalStatus,
  Provider,
  ProviderFilter,
  ProviderKind,
} from 'api';
import { Alert, Button, EmptyState } from 'components';
import { ConfirmProviderDialog } from '../dialogs/confirm-provider-dialog';
import { OnboardProviderDialog } from '../dialogs/onboard-provider-dialog';
import { Session } from '../session';

type View = 'loading' | 'ready' | 'failed' | 'forbidden';

@Component({
  selector: 'sl-providers-page',
  imports: [Alert, Button, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view() === 'forbidden') {
      <sl-empty-state
        code="403"
        title="Administrators only"
        text="Your account can’t manage providers. Ask an administrator if you need access."
      >
        <div slot="actions" style="display: contents">
          <sl-button variant="outline" (pressed)="signOut()">Sign out</sl-button>
        </div>
      </sl-empty-state>
    } @else {
      <header class="bar">
        <span>{{ session.displayName() }}</span>
        <sl-button variant="outline" (pressed)="signOut()">Sign out</sl-button>
      </header>
      <div class="head">
        <div>
          <h1>Providers</h1>
          <p class="sub">{{ subtitle() }}</p>
        </div>
        <sl-button (pressed)="onboard()">Onboard provider</sl-button>
      </div>
      <form
        class="filters"
        role="search"
        aria-label="Filter providers"
        (submit)="$event.preventDefault()"
      >
        <label for="status">Status</label>
        <select id="status" (change)="setStatus($any($event.target).value)">
          <option value="">All</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Deactivated">Deactivated</option>
        </select>
        <label for="kind">Kind</label>
        <select id="kind" (change)="setKind($any($event.target).value)">
          <option value="">All</option>
          <option value="Mechanic">Mechanic</option>
          <option value="BodyShop">Body shop</option>
        </select>
      </form>

      @if (view() === 'failed') {
        <sl-alert
          title="We couldn’t load the providers"
          text="The list didn’t come through. Nothing was changed. Try again in a moment."
        >
          <sl-button variant="outline" (pressed)="load()">Try again</sl-button>
        </sl-alert>
      } @else if (view() === 'ready' && providers().length === 0) {
        <div class="none">
          <h2>No providers match</h2>
          <p>
            Onboard a mechanic or body shop, or clear the filters. Providers who register themselves
            appear here as pending.
          </p>
        </div>
      } @else {
        <div [attr.aria-busy]="view() === 'loading' ? 'true' : null">
          <table>
            <caption class="sr-only">
              Mechanics and body shops
            </caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Kind</th>
                <th scope="col">Licence</th>
                <th scope="col">Location</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              @for (p of providers(); track p.id) {
                <tr>
                  <th scope="row">{{ p.displayName }}</th>
                  <td>{{ p.kind }}</td>
                  <td>{{ p.licenceNumber }}</td>
                  <td>{{ p.location }}</td>
                  <td>{{ p.approvalStatus }}</td>
                  <td>
                    @if (p.approvalStatus === 'Approved') {
                      <sl-button variant="outline" (pressed)="confirm('deactivate', p)"
                        >Deactivate</sl-button
                      >
                    } @else {
                      <sl-button (pressed)="confirm('approve', p)">{{
                        p.approvalStatus === 'Pending' ? 'Approve' : 'Approve again'
                      }}</sl-button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (view() === 'loading') {
          <p role="status" class="sr-only">Loading providers</p>
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
    .head,
    .filters {
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
    select {
      min-height: 36px;
      font: inherit;
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
export class ProvidersPage {
  private readonly api = inject(ADMIN_PROVIDERS_API);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);
  protected readonly session = inject(Session);

  protected readonly view = signal<View>('loading');
  protected readonly providers = signal<Provider[]>([]);
  private filter: ProviderFilter = {};

  constructor() {
    this.load();
  }

  protected subtitle() {
    if (this.view() === 'loading') return 'Loading providers';
    const waiting = this.providers().filter((p) => p.approvalStatus === 'Pending').length;
    const total = this.providers().length;
    return `${total} ${total === 1 ? 'provider' : 'providers'} · ${waiting} waiting for approval`;
  }

  protected load() {
    this.view.set('loading');
    this.api.list(this.filter).subscribe({
      next: (list) => {
        this.providers.set(list);
        this.view.set('ready');
      },
      error: (p: ApiProblem) => this.view.set(p.status === 403 ? 'forbidden' : 'failed'),
    });
  }

  protected setStatus(value: string) {
    this.filter = { ...this.filter, status: (value || undefined) as ApprovalStatus | undefined };
    this.load();
  }

  protected setKind(value: string) {
    this.filter = { ...this.filter, kind: (value || undefined) as ProviderKind | undefined };
    this.load();
  }

  protected onboard() {
    const ref = this.dialog.open<Provider>(OnboardProviderDialog, {
      ariaLabelledBy: 'onboard-title',
      ariaDescribedBy: 'onboard-description',
      backdropClass: 'sl-dialog-backdrop',
    });
    ref.closed.subscribe((created) => {
      if (created) this.load();
    });
  }

  protected confirm(action: 'approve' | 'deactivate', provider: Provider) {
    const ref = this.dialog.open<boolean>(ConfirmProviderDialog, {
      data: { action, provider },
      ariaLabelledBy: 'confirm-title',
      ariaDescribedBy: 'confirm-description',
      backdropClass: 'sl-dialog-backdrop',
    });
    ref.closed.subscribe((changed) => {
      if (changed) this.load();
    });
  }

  protected signOut() {
    this.session.end();
    void this.router.navigateByUrl('/sign-in');
  }
}
