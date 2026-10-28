import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PLATFORM_API } from 'api';
import { Observable, of, throwError } from 'rxjs';
import { ReadinessPage } from './readiness-page';

function render(ready: Observable<void>) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: PLATFORM_API, useValue: { ready: () => ready } }],
  });
  const fixture = TestBed.createComponent(ReadinessPage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const failing = (status: number) =>
  throwError(() => new HttpErrorResponse({ status, statusText: 'x' }));

describe('ReadinessPage', () => {
  it('reports the API ready', () => {
    expect(render(of(undefined)).querySelector('[role=status]')?.textContent).toContain(
      'The API is ready',
    );
  });

  it('shows the server-error state when the API fails', () => {
    expect(render(failing(500)).querySelector('h1')?.textContent).toContain('That one’s on us');
  });

  it('shows the maintenance state when the API answers 503', () => {
    expect(render(failing(503)).querySelector('h1')?.textContent).toContain(
      'Back in about 20 minutes',
    );
  });

  it('shows the offline state when there is no connection', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(render(failing(0)).querySelector('h1')?.textContent).toContain('You’re not connected');
  });
});
