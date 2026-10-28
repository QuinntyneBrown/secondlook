import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';

@Component({ selector: 'sl-perf-root', template: '' })
class PerfRoot {}

bootstrapApplication(PerfRoot).catch((err) => console.error(err));
