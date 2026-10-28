import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'sl-root',
  imports: [RouterOutlet],
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    <main id="main"><router-outlet /></main>
  `,
  styles: `
    .skip-link {
      position: absolute;
      left: -999px;
    }
    .skip-link:focus {
      left: var(--spacingHorizontalL);
      top: var(--spacingVerticalS);
      padding: var(--spacingVerticalS) var(--spacingHorizontalL);
      background: var(--colorNeutralBackground1);
    }
  `,
})
export class App {}
