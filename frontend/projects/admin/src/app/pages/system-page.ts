import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SystemStateKey, SystemStateView } from './system-state-view';

/** Renders the system state named by the route's `state` data. */
@Component({
  selector: 'sl-system-page',
  imports: [SystemStateView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<sl-system-state-view [key]="key" (retry)="reload()" />`,
})
export class SystemPage {
  protected readonly key = inject(ActivatedRoute).snapshot.data['state'] as SystemStateKey;

  reload() {
    location.assign('/');
  }
}
