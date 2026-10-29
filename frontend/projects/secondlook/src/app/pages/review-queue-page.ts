import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AssignedReview, REPORTS_API, ReviewType } from 'api';
import { Alert, Button } from 'components';
import { callTime } from '../util/eastern-time';

type Load = 'loading' | 'ready' | 'failed';

const REVIEW_LABEL: Record<ReviewType, string> = {
  Mechanic: 'Mechanic',
  BodyShop: 'Body shop only',
  Both: 'Mechanic and body shop',
};

/** The body shop's own reviews (L2-058, L2-062): where each call stands, and the way into the call or the findings. */
@Component({
  selector: 'sl-review-queue-page',
  imports: [Alert, Button, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page" [attr.aria-busy]="state() === 'loading' ? 'true' : null">
      <h1>Assigned reviews</h1>
      @switch (state()) {
        @case ('ready') {
          @if (reviews().length) {
            <ul aria-label="Reviews" class="reviews">
              @for (r of reviews(); track r.inspectionId) {
                <li>
                  <div class="what">
                    <strong>{{ r.vin }}</strong>
                    <span class="muted">{{ when(r) }} · {{ label(r) }}</span>
                  </div>
                  <span class="status">{{ status(r) }}</span>
                  <div class="actions">
                    @if (r.callStatus !== 'Ended') {
                      <sl-button [routerLink]="'/inspections/' + r.inspectionId + '/lobby'"
                        >Join call</sl-button
                      >
                    } @else {
                      <sl-button
                        [variant]="r.delivered ? 'outline' : 'primary'"
                        [routerLink]="'/inspections/' + r.inspectionId + '/body-review'"
                        >{{ r.delivered ? 'Change findings' : 'Write findings' }}</sl-button
                      >
                    }
                  </div>
                </li>
              }
            </ul>
          } @else {
            <p class="muted">No reviews assigned yet.</p>
          }
        }
        @case ('failed') {
          <sl-alert
            variant="danger"
            title="Your reviews didn’t load"
            text="Nothing is lost. Try again in a moment."
          >
            <sl-button variant="outline" (pressed)="load()">Try again</sl-button>
            <a routerLink="/availability">Back to availability</a>
          </sl-alert>
        }
        @default {
          <p role="status">Loading your reviews…</p>
        }
      }
      <a routerLink="/availability">Back to availability</a>
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
      width: min(720px, 100%);
    }
    h1 {
      margin: 0;
    }
    .reviews {
      display: grid;
      gap: var(--spacingVerticalM);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .reviews li {
      display: flex;
      flex-wrap: wrap;
      gap: var(--spacingHorizontalM);
      align-items: center;
      padding: var(--spacingVerticalM) var(--spacingHorizontalL);
      border: var(--strokeWidthThin) solid var(--colorNeutralStroke2);
      border-radius: var(--borderRadiusMedium);
    }
    .what {
      display: grid;
      flex: 1 1 14rem;
    }
    .muted {
      color: var(--colorNeutralForeground2);
    }
    .status {
      font-weight: var(--fontWeightSemibold);
    }
  `,
})
export class ReviewQueuePage implements OnInit {
  private readonly api = inject(REPORTS_API);

  protected readonly state = signal<Load>('loading');
  protected readonly reviews = signal<AssignedReview[]>([]);

  ngOnInit() {
    this.load();
  }

  protected load() {
    this.state.set('loading');
    this.api.assigned().subscribe({
      next: (rows) => {
        this.reviews.set(rows);
        this.state.set('ready');
      },
      error: () => this.state.set('failed'),
    });
  }

  protected when(r: AssignedReview) {
    return callTime(r.start);
  }

  protected label(r: AssignedReview) {
    return REVIEW_LABEL[r.review];
  }

  protected status(r: AssignedReview) {
    if (r.delivered) return 'Delivered';
    return r.callStatus === 'NotStarted'
      ? 'Waiting for the call'
      : r.callStatus === 'Live'
        ? 'Call in progress'
        : 'Call ended';
  }
}
