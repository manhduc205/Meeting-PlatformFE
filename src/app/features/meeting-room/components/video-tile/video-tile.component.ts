import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ElementRef,
  AfterViewInit,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Participant } from '../../models/meeting.model';

@Component({
  selector: 'app-video-tile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="video-tile"
      [class.speaking]="participant.isSpeaking"
    >
      <!--
        FIX: <video> is ALWAYS in the DOM — no *ngIf.
        Previously *ngIf destroyed the element on camera-off.
        When camera turned back on, ngOnChanges fired BEFORE Angular
        re-created the element, so videoEl was still undefined → stream never attached.
        Solution: keep element alive, use CSS to hide/show.
      -->
      <video
        #videoEl
        class="tile-video"
        [class.mirrored]="isLocal"
        [class.tile-video--hidden]="!participant.isCameraOn || !participant.stream"
        autoplay
        playsinline
        muted
      ></video>

      <!-- Avatar fallback (camera off or no stream yet) -->
      <div
        *ngIf="!participant.isCameraOn || !participant.stream"
        class="tile-avatar-bg"
      >
        <div
          class="tile-avatar"
          [style.background-image]="participant.avatarUrl ? 'url(' + participant.avatarUrl + ')' : ''"
          [style.background-color]="participant.avatarUrl ? 'transparent' : participant.avatarColor"
        >
          <!-- Chỉ hiển thị initials nếu không có ảnh -->
          <ng-container *ngIf="!participant.avatarUrl">
            {{ participant.initials }}
          </ng-container>
        </div>
      </div>

      <!-- Speaking ring -->
      <div class="speaking-ring" *ngIf="participant.isSpeaking"></div>

      <!-- Top-left: host badge -->
      <div class="tile-top-badges">
        <div class="host-badge" *ngIf="participant.isHost">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="#fbbf24">
            <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2h14v2H5v-2z"/>
          </svg>
          <span>Host</span>
        </div>
      </div>

      <!-- Top-right: raise hand badge -->
      <div class="raise-hand-badge" *ngIf="participant.isHandRaised">✋</div>

      <!-- Top-right: camera off badge -->
      <div class="cam-off-badge" *ngIf="!participant.isCameraOn && !participant.isHandRaised">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2">
          <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10M1 1l22 22"/>
        </svg>
      </div>

      <!-- Bottom bar -->
      <div class="tile-bottom">
        <div class="tile-name-row">
          <!-- Audio level bars -->
          <div class="audio-bars" *ngIf="participant.isSpeaking && !participant.isMuted">
            <span class="bar" [style.height.px]="barHeight(0)"></span>
            <span class="bar" [style.height.px]="barHeight(1)"></span>
            <span class="bar" [style.height.px]="barHeight(2)"></span>
          </div>
          <span class="speaking-dot" *ngIf="participant.isSpeaking && !participant.audioLevel"></span>
          <span class="tile-you" *ngIf="isLocal">You · </span>
          <span class="tile-name">{{ participant.name }}</span>
        </div>
        <div class="tile-mic" [class.muted]="participant.isMuted">
          <!-- Mic on -->
          <svg *ngIf="!participant.isMuted" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
          </svg>
          <!-- Mic off -->
          <svg *ngIf="participant.isMuted" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23M12 19v4M8 23h8"/>
          </svg>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./video-tile.component.scss']
})
export class VideoTileComponent implements AfterViewInit, OnChanges, AfterViewChecked {
  @Input() participant!: Participant;
  @Input() isLocal = false;

  /**
   * FIX: @ViewChild now always resolves because <video> is always in the DOM.
   * Previously, with *ngIf, videoEl was undefined when camera was off,
   * causing _attachStream() to bail early and stream never being attached
   * when camera turned back on.
   */
  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;

  private _needsAttach = false;

  ngAfterViewInit(): void {
    this._attachStream();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['participant']) {
      // Mark that we need to attach the stream.
      // We use AfterViewChecked as a fallback in case videoEl isn't ready yet.
      this._needsAttach = true;
      this._attachStream();
    }
  }

  /**
   * AfterViewChecked fires after every view update.
   * This catches the case where ngOnChanges ran but videoEl wasn't ready yet.
   */
  ngAfterViewChecked(): void {
    if (this._needsAttach && this.videoEl) {
      this._attachStream();
      this._needsAttach = false;
    }
  }

  private _attachStream(): void {
    const el = this.videoEl?.nativeElement;
    if (!el) return;

    const stream = this.participant?.stream ?? null;

    // Only update if stream reference actually changed — avoids unnecessary restarts
    if (el.srcObject !== stream) {
      el.srcObject = stream;
      if (stream) {
        el.play().catch(() => {/* autoplay policy: allowed because video is muted */});
      }
    }

    this._needsAttach = false;
  }

  /** Map audio level (0–1) to animated bar heights (px) */
  barHeight(idx: number): number {
    const level = this.participant?.audioLevel ?? 0;
    const base = 3;
    const offsets = [0, Math.PI / 3, (2 * Math.PI) / 3];
    return Math.max(base, Math.min(12, base + level * 9 * Math.abs(Math.sin(Date.now() / 150 + offsets[idx]))));
  }
}
