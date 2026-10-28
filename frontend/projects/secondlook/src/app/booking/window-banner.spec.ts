import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PricingWindow } from 'api';
import { WindowBanner } from './window-banner';

const base: PricingWindow = {
  state: 'Open',
  endsAt: '2031-05-19T18:00:00.000Z',
  daysRemaining: 14,
  carsInWindow: 1,
  additionalVehicleCents: 2500,
  newInspectionCents: 2500,
};

function render(window: PricingWindow | null) {
  localStorage.removeItem('secondlook.windowBannerDismissed');
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(WindowBanner);
  fixture.componentRef.setInput('window', window);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('WindowBanner', () => {
  it('shows nothing when the buyer has no window', () => {
    expect(render({ ...base, state: 'None' }).el.querySelector('section')).toBeNull();
  });

  it('shows nothing while the window is unknown', () => {
    expect(render(null).el.querySelector('section')).toBeNull();
  });

  it('offers another car for $25 while the window is open', () => {
    const { el } = render(base);
    expect(el.textContent).toContain('Your window is open until Mon 19 May');
    expect(el.textContent).toContain('Add another car to compare for $25 each.');
    expect(el.textContent).toContain('Add another car · $25');
  });

  it('warns when two days remain and can be dismissed', () => {
    const { fixture, el } = render({ ...base, state: 'ClosingSoon', daysRemaining: 2 });
    expect(el.textContent).toContain('Your window closes in 2 days');
    expect(el.textContent).toContain('Add a car by Mon 19 May to keep the $25 price.');
    const dismiss = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Dismiss'),
    );
    dismiss?.click();
    fixture.detectChanges();
    expect(el.querySelector('section')).toBeNull();
  });

  it('says the window has closed and cannot be dismissed', () => {
    const { el } = render({ ...base, state: 'Closed', daysRemaining: 0 });
    expect(el.textContent).toContain('Your window has closed');
    expect(el.textContent).toContain('A new inspection is $50 and starts a new window.');
    expect(el.textContent).toContain('Book an inspection');
    expect([...el.querySelectorAll('button')].some((b) => b.textContent?.includes('Dismiss'))).toBe(
      false,
    );
  });
});
