import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

/** A labelled text input with help or error text, keeping the mock's field BEM classes. */
@Component({
  selector: 'sl-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <label class="field__label" [for]="fieldId()">{{ label() }}</label>
      <input
        class="input"
        [id]="fieldId()"
        [type]="type()"
        [value]="value()"
        [readOnly]="readonly()"
        [attr.autocomplete]="autocomplete()"
        [attr.aria-invalid]="error() ? 'true' : null"
        [attr.aria-describedby]="describedBy()"
        (input)="value.set($any($event.target).value)"
      />
      @if (error()) {
        <p class="field__error" [id]="fieldId() + '-desc'">{{ error() }}</p>
      } @else if (help()) {
        <p class="field__help" [id]="fieldId() + '-desc'">{{ help() }}</p>
      }
    </div>
  `,
  styles: `
    .field {
      display: grid;
      gap: var(--spacingVerticalS);
    }
    .field__label {
      font-weight: var(--fontWeightSemibold);
    }
    .input {
      min-height: 40px;
      padding: 0 var(--spacingHorizontalM);
      border: var(--strokeWidthThin) solid var(--colorNeutralStroke1);
      border-radius: var(--borderRadiusMedium);
      background: var(--colorNeutralBackground1);
      color: var(--colorNeutralForeground1);
      font: inherit;
    }
    .input:focus-visible {
      outline: 2px solid var(--colorBrandStroke1);
      outline-offset: 1px;
    }
    .input[aria-invalid='true'] {
      border-color: var(--colorStatusDangerForeground1);
    }
    .input[readonly] {
      background: var(--colorNeutralBackground3);
    }
    .field__help {
      margin: 0;
      color: var(--colorNeutralForeground3);
    }
    .field__error {
      margin: 0;
      color: var(--colorStatusDangerForeground1);
    }
  `,
})
export class FormField {
  readonly fieldId = input.required<string>();
  readonly label = input.required<string>();
  readonly type = input<'text' | 'email' | 'password'>('text');
  readonly autocomplete = input<string | null>(null);
  readonly help = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly readonly = input(false);
  readonly value = model('');

  protected readonly describedBy = computed(() =>
    this.error() || this.help() ? `${this.fieldId()}-desc` : null,
  );
}
