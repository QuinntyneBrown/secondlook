import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Button } from './button';

function create(inputs: Record<string, unknown> = {}) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Button);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  return fixture;
}

describe('Button', () => {
  it('renders a button that emits when pressed', () => {
    const fixture = create();
    let pressed = 0;
    fixture.componentInstance.pressed.subscribe(() => pressed++);
    fixture.nativeElement.querySelector('button').click();
    expect(pressed).toBe(1);
  });

  it('marks a busy button as aria-busy', () => {
    const fixture = create({ busy: true });
    expect(fixture.nativeElement.querySelector('button').getAttribute('aria-busy')).toBe('true');
  });

  it('renders an anchor when given an href', () => {
    const fixture = create({ href: 'mailto:help@example.test' });
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe(
      'mailto:help@example.test',
    );
  });
});
