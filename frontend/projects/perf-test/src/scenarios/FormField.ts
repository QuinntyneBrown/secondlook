import { Component } from '@angular/core';
import { FormField } from 'components';

@Component({
  selector: 'sl-perf-form-field',
  imports: [FormField],
  template: `<sl-form-field
    fieldId="email"
    label="Email"
    type="email"
    help="We never share it."
  />`,
})
export default class FormFieldScenario {}
