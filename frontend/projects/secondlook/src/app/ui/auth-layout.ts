import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** The centred card shared by the account pages: wordmark, heading, content and a footer slot. */
@Component({
  selector: 'sl-auth-layout',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-layout">
      <div class="auth-card">
        <a class="wordmark" routerLink="/">Second<em>Look</em></a>
        <div class="card">
          <h1>{{ title() }}</h1>
          @if (lead()) {
            <p class="lead">{{ lead() }}</p>
          }
          <ng-content />
        </div>
        <p class="foot"><ng-content select="[slot=foot]" /></p>
      </div>
    </div>
  `,
  styles: `
    .auth-layout {
      display: grid;
      place-items: start center;
      min-height: 100dvh;
      padding: var(--spacingVerticalXXL) var(--spacingHorizontalL);
      font-family: var(--fontFamilyBase);
    }
    .auth-card {
      display: grid;
      gap: var(--spacingVerticalL);
      width: min(440px, 100%);
    }
    .wordmark {
      justify-self: center;
      font-size: var(--fontSizeBase500);
      font-weight: var(--fontWeightSemibold);
      color: var(--colorNeutralForeground1);
      text-decoration: none;
    }
    .wordmark em {
      color: var(--colorBrandForeground1);
      font-style: normal;
    }
    .card {
      display: grid;
      gap: var(--spacingVerticalL);
      padding: var(--spacingVerticalXXL);
      border: var(--strokeWidthThin) solid var(--colorNeutralStroke2);
      border-radius: var(--borderRadiusLarge);
      background: var(--colorNeutralBackground1);
    }
    h1 {
      margin: 0;
      font-size: var(--fontSizeBase500);
    }
    .lead {
      margin: calc(var(--spacingVerticalS) * -1) 0 0;
      color: var(--colorNeutralForeground2);
    }
    .foot {
      margin: 0;
      text-align: center;
      color: var(--colorNeutralForeground2);
    }
  `,
})
export class AuthLayout {
  readonly title = input.required<string>();
  readonly lead = input<string | null>(null);
}
