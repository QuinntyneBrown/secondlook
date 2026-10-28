import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input,
} from '@angular/core';

export interface SummaryItem {
  message: string;
  fieldId: string;
}

/** An alert or status banner. `danger` is announced as an alert, `success` as a status. */
@Component({
  selector: 'sl-alert',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="alert"
      [class.alert--danger]="variant() === 'danger'"
      [class.alert--success]="variant() === 'success'"
      [attr.role]="variant() === 'danger' ? 'alert' : 'status'"
      tabindex="-1"
    >
      <div class="alert__body">
        <div class="alert__title">{{ title() }}</div>
        @if (text()) {
          <p>{{ text() }}</p>
        }
        @if (items().length) {
          <ul>
            @for (item of items(); track item.fieldId) {
              <li>
                <a [href]="'#' + item.fieldId" (click)="focusField($event, item.fieldId)">{{
                  item.message
                }}</a>
              </li>
            }
          </ul>
        }
        <div class="alert__actions"><ng-content /></div>
      </div>
    </div>
  `,
  styles: `
    .alert {
      padding: var(--spacingVerticalM) var(--spacingHorizontalL);
      border-radius: var(--borderRadiusMedium);
      background: var(--colorNeutralBackground3);
      color: var(--colorNeutralForeground1);
    }
    .alert--danger {
      background: var(--colorStatusDangerBackground1);
      color: var(--colorStatusDangerForeground1);
    }
    .alert--success {
      background: var(--colorStatusSuccessBackground1);
      color: var(--colorStatusSuccessForeground1);
    }
    .alert:focus-visible {
      outline: 2px solid var(--colorBrandStroke1);
    }
    .alert__title {
      font-weight: var(--fontWeightSemibold);
    }
    p {
      margin: var(--spacingVerticalS) 0 0;
    }
    ul {
      margin: var(--spacingVerticalS) 0 0;
      padding-left: var(--spacingHorizontalXXL);
    }
    .alert__actions {
      margin-top: var(--spacingVerticalS);
    }
  `,
})
export class Alert {
  readonly variant = input<'danger' | 'success' | 'info'>('danger');
  readonly title = input.required<string>();
  readonly text = input<string | null>(null);
  /** Error-summary entries: each links to its field. */
  readonly items = input<SummaryItem[]>([]);
  /** Moves focus to the alert when it appears, as for an error summary. */
  readonly focusOnShow = input(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      if (this.focusOnShow()) this.host.nativeElement.querySelector<HTMLElement>('.alert')?.focus();
    });
  }

  protected focusField(event: Event, id: string) {
    event.preventDefault();
    document.getElementById(id)?.focus();
  }
}
