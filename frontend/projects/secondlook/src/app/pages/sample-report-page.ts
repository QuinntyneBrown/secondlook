import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Report } from 'api';
import { ReportView } from '../ui/report-view';

/** An example report with made-up details, so a buyer with no inspections can see what they get (L2-020). */
const SAMPLE: Report = {
  inspectionId: 'sample',
  review: 'Mechanic',
  submittedAt: '2026-01-01T00:00:00Z',
  callEndedAt: null,
  mechanicName: 'A SecondLook mechanic',
  mechanicReady: true,
  vin: 'SAMPLE000000000',
  odometerKm: 142300,
  askingPriceCents: 890000,
  findings: [
    {
      id: '1',
      title: 'Front brake pads',
      note: 'Worn to 2 mm.',
      status: 'Required',
      minCents: 30000,
      maxCents: 45000,
    },
    {
      id: '2',
      title: 'Rear tires',
      note: 'Cracking on the sidewall.',
      status: 'Recommended',
      minCents: 40000,
      maxCents: 60000,
    },
    { id: '3', title: 'Steering', note: '', status: 'Passes', minCents: null, maxCents: null },
  ],
  requiredCount: 1,
  costMinCents: 30000,
  costMaxCents: 45000,
  allInMinCents: 920000,
  allInMaxCents: 935000,
  bodyShop: { status: 'NotRequested', reviewerName: null, findings: [] },
  disclaimer:
    'This estimate comes from a remote video inspection. It is not a safety certificate or a guarantee of the vehicle’s condition, and a shop may find more once the car is on a lift.',
};

@Component({
  selector: 'sl-sample-report-page',
  imports: [ReportView, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <h1>Sample report</h1>
      <p class="sub">
        This is an example with made-up details. Yours lists what your mechanic finds.
      </p>
      <sl-report-view [report]="sample" />
      <a routerLink="/book/vehicle">Book an inspection</a>
      <a routerLink="/inspections">Back to your inspections</a>
    </main>
  `,
  styles: `
    :host {
      display: block;
      padding: var(--spacingVerticalXXL) var(--spacingHorizontalL);
      font-family: var(--fontFamilyBase);
      color: var(--colorNeutralForeground1);
    }
    .page {
      display: grid;
      gap: var(--spacingVerticalL);
      width: min(720px, 100%);
    }
    h1,
    p {
      margin: 0;
    }
    .sub {
      color: var(--colorNeutralForeground2);
    }
  `,
})
export class SampleReportPage {
  protected readonly sample = SAMPLE;
}
