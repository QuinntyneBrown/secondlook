import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Button } from 'components';

@Component({
  selector: 'sl-perf-button',
  imports: [Button],
  template: `<sl-button>Go to inspections</sl-button>`,
})
export default class ButtonScenario {}

export const providers = [provideRouter([])];
