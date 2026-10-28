import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Button } from 'components';
import { SignOutDialog } from '../dialogs/sign-out-dialog';
import { Session } from '../session';

/** The signed-in landing page. The inspection list itself arrives with the inspection journeys. */
@Component({
  selector: 'sl-inspections-page',
  imports: [Button, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header>
      <a routerLink="/vehicles">Vehicles</a>
      <a routerLink="/billing">Billing</a>
      <span>{{ session.displayName() }}</span>
      <sl-button variant="outline" (pressed)="signOut()">Sign out</sl-button>
    </header>
    <h1>Your inspections</h1>
    <p>Nothing booked yet.</p>
  `,
  styles: `
    :host {
      display: block;
      padding: var(--spacingVerticalXXL) var(--spacingHorizontalL);
      font-family: var(--fontFamilyBase);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--spacingHorizontalM);
    }
  `,
})
export class InspectionsPage {
  protected readonly session = inject(Session);
  private readonly dialog = inject(Dialog);
  private readonly router = inject(Router);

  protected signOut() {
    const ref = this.dialog.open<boolean>(SignOutDialog, {
      ariaLabelledBy: 'sign-out-title',
      ariaDescribedBy: 'sign-out-description',
      backdropClass: 'sl-dialog-backdrop',
    });
    ref.closed.subscribe((signedOut) => {
      if (signedOut) void this.router.navigateByUrl('/sign-in');
    });
  }
}
