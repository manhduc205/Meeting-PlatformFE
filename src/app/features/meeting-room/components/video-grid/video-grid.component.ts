import { Component, Input, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VideoTileComponent } from '../video-tile/video-tile.component';
import { Participant } from '../../models/meeting.model';
import { MeetingStateService } from '../../services/meeting-state.service';

const PAGE_SIZE = 9;

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
      <div class="video-grid" [class]="'layout-' + ms.layoutMode()" [style]="gridStyle()">
        <app-video-tile
          *ngFor="let p of currentPageParticipants(); trackBy: trackById; let i = index"
          [participant]="p"
          [isLocal]="p.id === localParticipantId"
          [ngClass]="{'tile-featured': isFeatured(i, p)}"
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
  ms = inject(MeetingStateService);
  /**
   * FIX: _participants is now a Signal (was plain property).
   * Angular computed() only tracks Signal dependencies.
   * With a plain property, currentPageParticipants() would cache stale data
   * and never re-run when camera state / stream changed.
   */
  private _participants = signal<Participant[]>([]);
  private _currentPage = signal(0);

  @Input() set participants(value: Participant[]) {
    // Sort: theo quyền ưu tiên ổn định: isLocal > isHost > theo Alphabet
    const sorted = [...value].sort((a, b) => {
      const aIsLocal = a.id === this.localParticipantId;
      const bIsLocal = b.id === this.localParticipantId;
      if (aIsLocal !== bIsLocal) return aIsLocal ? -1 : 1;
      
      if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
      if (a.isCameraOn !== b.isCameraOn) return a.isCameraOn ? -1 : 1;
      
      // Sắp xếp bằng name để ổn định thứ tự thẻ
      return (a.name || '').localeCompare(b.name || '');
    });
    this._participants.set(sorted);   // ← signal.set() triggers computed invalidation
    // Reset page if out of range
    const total = Math.ceil(sorted.length / PAGE_SIZE);
    if (this._currentPage() >= total) {
      this._currentPage.set(Math.max(0, total - 1));
    }
  }
  @Input() localParticipantId = 'local';

  currentPage = this._currentPage.asReadonly();

  totalPages = computed(() => Math.max(1, Math.ceil(this._participants().length / PAGE_SIZE)));

  pageArray = computed(() => Array.from({ length: this.totalPages() }));

  currentPageParticipants = computed(() => {
    const start = this._currentPage() * PAGE_SIZE;
    return this._participants().slice(start, start + PAGE_SIZE);
  });

  gridStyle = computed(() => {
    const count = this.currentPageParticipants().length;
    const mode = this.ms.layoutMode();
    
    // Nếu chạy gallery hoặc dynamic thì dùng grid layout calc code cũ
    if (mode === 'gallery' || mode === 'dynamic') {
      const { cols, rows } = getGridConfig(count);
      return {
        'grid-template-columns': `repeat(${cols}, minmax(0, 1fr))`,
        'grid-template-rows': `repeat(${rows}, minmax(0, 1fr))`
      };
    }
    
    // Speaker & Multi-speaker CSS flex/grid sẽ xử lý trong .scss thông qua class map
    return {};
  });

  isFeatured(index: number, p: Participant): boolean {
    const mode = this.ms.layoutMode();
    if (mode === 'speaker') return index === 0;
    if (mode === 'dynamic') return this.currentPageParticipants().length === 8 && index < 2;
    return false;
  }

  prevPage() { if (this._currentPage() > 0) this._currentPage.update(v => v - 1); }
  nextPage() { if (this._currentPage() < this.totalPages() - 1) this._currentPage.update(v => v + 1); }
  goToPage(i: number) { this._currentPage.set(i); }

  trackById(_: number, p: Participant) { return p.id; }
}
