import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoTileComponent } from '../video-tile/video-tile.component';
import { Participant } from '../../models/meeting.model';

const PAGE_SIZE = 9;

/**
 * For N tiles per page, compute how many columns/rows to use.
 * If some slots are left empty (e.g. 8 participants on a 9-slot page),
 * the two participants that start a new column get a bigger tile via
 * a special CSS class. We implement this by using a CSS-grid trick.
 */
function getGridConfig(count: number): { cols: number; rows: number } {
  if (count === 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  if (count <= 9) return { cols: 3, rows: 3 };
  return { cols: 3, rows: 3 };
}

@Component({
  selector: 'app-video-grid',
  standalone: true,
  imports: [CommonModule, VideoTileComponent],
  template: `
    <div class="video-grid-container">
      <!-- Grid -->
      <div class="video-grid" [style]="gridStyle()">
        <app-video-tile
          *ngFor="let p of currentPageParticipants(); trackBy: trackById; let i = index"
          [participant]="p"
          [isLocal]="p.id === localParticipantId"
          [ngClass]="{'tile-featured': isFeatured(i)}"
        ></app-video-tile>
      </div>

      <!-- Page navigation -->
      <div class="page-nav" *ngIf="totalPages() > 1">
        <button class="page-btn" (click)="prevPage()" [disabled]="currentPage() === 0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"></polyline>
          </svg>
        </button>

        <div class="page-dots">
          <button
            *ngFor="let p of pageArray(); let i = index"
            class="page-dot"
            [class.active]="i === currentPage()"
            (click)="goToPage(i)"
          ></button>
        </div>

        <button class="page-btn" (click)="nextPage()" [disabled]="currentPage() === totalPages() - 1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"></polyline>
          </svg>
        </button>

        <span class="page-label">{{ currentPage() + 1 }} / {{ totalPages() }}</span>
      </div>
    </div>
  `,
  styleUrls: ['./video-grid.component.scss']
})
export class VideoGridComponent {
  @Input() set participants(value: Participant[]) {
    // Sort: camera-on first, then speaking, then host
    const sorted = [...value].sort((a, b) => {
      if (a.isCameraOn !== b.isCameraOn) return a.isCameraOn ? -1 : 1;
      if (a.isSpeaking !== b.isSpeaking) return a.isSpeaking ? -1 : 1;
      if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
      return 0;
    });
    this._participants = sorted;
    // Reset to page 0 if current page is out of range
    const total = Math.ceil(sorted.length / PAGE_SIZE);
    if (this._currentPage() >= total) {
      this._currentPage.set(Math.max(0, total - 1));
    }
  }
  @Input() localParticipantId = 'local';

  private _participants: Participant[] = [];
  private _currentPage = signal(0);

  currentPage = this._currentPage.asReadonly();

  totalPages = computed(() => Math.max(1, Math.ceil(this._participants.length / PAGE_SIZE)));

  pageArray = computed(() => Array.from({ length: this.totalPages() }));

  currentPageParticipants = computed(() => {
    const start = this._currentPage() * PAGE_SIZE;
    return this._participants.slice(start, start + PAGE_SIZE);
  });

  gridStyle = computed(() => {
    const count = this.currentPageParticipants().length;
    const { cols, rows } = getGridConfig(count);
    return {
      'grid-template-columns': `repeat(${cols}, minmax(0, 1fr))`,
      'grid-template-rows': `repeat(${rows}, minmax(0, 1fr))`
    };
  });

  /**
   * When exactly 8 participants are on a page, the first 2 tiles get
   * a row-span-2 treatment to fill the empty 9th slot.
   */
  isFeatured(index: number): boolean {
    const count = this.currentPageParticipants().length;
    return count === 8 && index < 2;
  }

  prevPage() {
    if (this._currentPage() > 0) this._currentPage.set(this._currentPage() - 1);
  }

  nextPage() {
    if (this._currentPage() < this.totalPages() - 1) this._currentPage.set(this._currentPage() + 1);
  }

  goToPage(i: number) {
    this._currentPage.set(i);
  }

  trackById(_: number, p: Participant) { return p.id; }
}
