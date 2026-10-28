import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL, HttpPlatformApi } from './http-platform-api';

describe('HttpPlatformApi', () => {
  let http: HttpTestingController;
  let api: HttpPlatformApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
        HttpPlatformApi,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(HttpPlatformApi);
  });

  it('completes when readiness answers 200', () => {
    let completed = false;
    api.ready().subscribe({ complete: () => (completed = true) });
    http.expectOne('http://api.test/health/ready').flush({ status: 'ready' });
    expect(completed).toBe(true);
  });

  it('errors when the API reports it is not ready', () => {
    let failed = false;
    api.ready().subscribe({ error: () => (failed = true) });
    http
      .expectOne('http://api.test/health/ready')
      .flush({ title: 'Not ready' }, { status: 503, statusText: 'Service Unavailable' });
    expect(failed).toBe(true);
  });
});
