import { Component } from '@angular/core';
import { Alert } from 'components';

@Component({
  selector: 'sl-perf-alert',
  imports: [Alert],
  template: `<sl-alert
    title="Fix 2 things to sign in"
    [items]="[
      { message: 'Enter a valid email address.', fieldId: 'email' },
      { message: 'Enter your password.', fieldId: 'password' },
    ]"
  />`,
})
export default class AlertScenario {}
