import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A full-page system state: code, title, explanation and actions (404, 403, 500, offline, maintenance). */
@Component({
  selector: 'sl-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty empty--error">
      <p class="mono text-muted">{{ code() }}</p>
      <h1 class="empty__title">{{ title() }}</h1>
      <p class="empty__text">{{ text() }}</p>
      <div class="empty__actions"><ng-content select="[slot=actions]" /></div>
    </div>
  `,
  styles: `
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--spacingVerticalM);
      min-height: 60dvh;
      padding: var(--spacingVerticalXXL) var(--spacingHorizontalL);
      text-align: center;
      color: var(--colorNeutralForeground1);
      font-family: var(--fontFamilyBase);
    }
    .mono,
    .text-muted {
      margin: 0;
      color: var(--colorNeutralForeground3);
      font-size: var(--fontSizeBase300);
    }
    .empty__title {
      margin: 0;
      font-size: var(--fontSizeBase500);
      font-weight: var(--fontWeightSemibold);
    }
    .empty__text {
      margin: 0;
      max-width: 44ch;
      color: var(--colorNeutralForeground2);
    }
    .empty__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--spacingHorizontalM);
    }
  `,
})
export class EmptyState {
  readonly code = input.required<string>();
  readonly title = input.required<string>();
  readonly text = input.required<string>();
}
