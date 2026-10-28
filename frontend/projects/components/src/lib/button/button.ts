import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Primary and outline actions. Renders an `<a>` when `href` or `routerLink` is set, else a `<button>`. */
@Component({
  selector: 'sl-button',
  imports: [NgTemplateOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #content><ng-content /></ng-template>
    @if (routerLink() !== null) {
      <a [class]="'btn btn--' + variant()" [routerLink]="routerLink()">
        <ng-container *ngTemplateOutlet="content" />
      </a>
    } @else if (href() !== null) {
      <a [class]="'btn btn--' + variant()" [href]="href()">
        <ng-container *ngTemplateOutlet="content" />
      </a>
    } @else {
      <button
        [class]="'btn btn--' + variant()"
        [type]="type()"
        [disabled]="disabled()"
        [attr.aria-busy]="busy() ? 'true' : null"
        (click)="pressed.emit()"
      >
        <ng-container *ngTemplateOutlet="content" />
      </button>
    }
  `,
  styles: `
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--spacingHorizontalS);
      min-height: 40px;
      padding: 0 var(--spacingHorizontalXXL);
      border: var(--strokeWidthThin) solid transparent;
      border-radius: var(--borderRadiusMedium);
      font: var(--fontWeightSemibold) var(--fontSizeBase300) / var(--lineHeightBase300)
        var(--fontFamilyBase);
      text-decoration: none;
      cursor: pointer;
      transition: background-color var(--durationNormal);
    }
    .btn:focus-visible {
      outline: 2px solid var(--colorBrandStroke1);
      outline-offset: 2px;
    }
    .btn--primary {
      background: var(--colorBrandBackground);
      color: var(--colorNeutralForegroundOnBrand);
    }
    .btn--primary:hover {
      background: var(--colorBrandBackgroundHover);
    }
    .btn--primary:active {
      background: var(--colorBrandBackgroundPressed);
    }
    .btn--outline {
      background: transparent;
      border-color: var(--colorNeutralStroke1);
      color: var(--colorNeutralForeground1);
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
})
export class Button {
  readonly variant = input<'primary' | 'outline'>('primary');
  readonly type = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
  readonly busy = input(false);
  /** Navigates within the app; renders an anchor. */
  readonly routerLink = input<string | readonly string[] | null>(null);
  /** External or mailto link; renders an anchor. */
  readonly href = input<string | null>(null);
  readonly pressed = output<void>();
}
