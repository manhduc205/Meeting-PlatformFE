import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-youtube-summary',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './youtube-summary.component.html',
  styleUrls: ['./youtube-summary.component.scss']
})
export class YoutubeSummaryComponent {
  constructor(private router: Router) {}

  generateSummary() {
    // Navigate to recording detail to reuse its UI
    this.router.navigate(['/recordings', 'youtube-summary']);
  }
}
