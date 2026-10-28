import {
  ApplicationRef,
  Component,
  EnvironmentProviders,
  Provider,
  Type,
  createComponent,
  provideZonelessChangeDetection,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import * as scenarios from './scenarios';

@Component({ selector: 'sl-perf-root', template: '' })
class PerfRoot {}

interface Scenario {
  default: Type<unknown>;
  providers?: (Provider | EnvironmentProviders)[];
}

/** Renders `?scenario=<Name>&iterations=<n>&renderType=<type>` and appends `#render-done` with the timing. */
async function run() {
  const params = new URLSearchParams(location.search);
  const name = params.get('scenario') ?? '';
  const iterations = Number(params.get('iterations') ?? 100);
  const renderType = params.get('renderType') ?? 'mount';
  const marker = document.createElement('div');
  marker.id = 'render-done';
  try {
    const scenario = (scenarios as unknown as Record<string, Scenario>)[name];
    if (!scenario) throw new Error(`Unknown scenario '${name}'.`);
    const app = await bootstrapApplication(PerfRoot, {
      providers: [provideZonelessChangeDetection(), ...(scenario.providers ?? [])],
    });
    const appRef = app.injector.get(ApplicationRef);
    const create = () => {
      const ref = createComponent(scenario.default, {
        environmentInjector: appRef.injector,
        hostElement: document.body.appendChild(document.createElement('div')),
      });
      appRef.attachView(ref.hostView);
      return ref;
    };
    performance.mark('start');
    if (renderType === 'virtual-rerender') {
      const ref = create();
      for (let i = 0; i < iterations; i++) ref.changeDetectorRef.detectChanges();
    } else if (renderType === 'virtual-rerender-with-unmount') {
      for (let i = 0; i < iterations; i++) {
        const ref = create();
        ref.changeDetectorRef.detectChanges();
        ref.destroy();
      }
    } else {
      const refs = Array.from({ length: iterations }, create);
      refs.forEach((r) => r.changeDetectorRef.detectChanges());
    }
    const measure = performance.measure('render', 'start');
    marker.dataset['duration'] = String(measure.duration);
  } catch (e) {
    marker.dataset['error'] = e instanceof Error ? e.message : String(e);
  }
  document.body.appendChild(marker);
}

run();
