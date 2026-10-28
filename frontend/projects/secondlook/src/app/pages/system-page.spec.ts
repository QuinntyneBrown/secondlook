import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { SystemPage } from './system-page';

function render(state: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { data: { state } } } },
    ],
  });
  const fixture = TestBed.createComponent(SystemPage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('SystemPage', () => {
  it('shows the not-found state with its actions', () => {
    const el = render('not-found');
    expect(el.querySelector('h1')?.textContent).toContain('We can’t find that page');
    expect(el.textContent).toContain('Go to inspections');
    expect(el.textContent).toContain('Home');
  });

  it('shows the maintenance state', () => {
    const el = render('maintenance');
    expect(el.querySelector('h1')?.textContent).toContain('Back in about 20 minutes');
    expect(el.textContent).toContain('Check status');
  });
});
