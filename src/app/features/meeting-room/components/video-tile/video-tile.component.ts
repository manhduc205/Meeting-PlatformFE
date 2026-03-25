import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ElementRef,
  AfterViewInit,
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
      <!-- ── Real <video> element (camera on & stream available) ── -->
      <video
        #videoEl
        *ngIf="participant.isCameraOn && participant.stream"
        class="tile-video"
        [class.mirrored]="isLocal"
        autoplay
        playsinline
        muted
      ></video>

      <!-- ── Avatar fallback (camera off or no stream yet) ── -->
      <div
        *ngIf="!participant.isCameraOn || !participant.stream"
        class="tile-avatar-bg"
        [style.background-color]="participant.avatarColor + '22'"
      >
        <div
          class="tile-avatar"
          [style.background-color]="participant.avatarColor"
        >
          {{ participant.initials }}
        </div>
        <span class="tile-avatar-name">{{ participant.name }}</span>
      </div>

      <!-- Speaking ring animation -->
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

      <!-- Top-right: camera off icon (only if hand NOT raised) -->
      <div class="cam-off-badge" *ngIf="!participant.isCameraOn && !participant.isHandRaised">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2">
          <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10M1 1l22 22"/>
        </svg>
      </div>

      <!-- Bottom bar -->
      <div class="tile-bottom">
        <div class="tile-name-row">
          <!-- Audio level bars (from LiveKit ActiveSpeakersChanged) -->
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
export class VideoTileComponent implements AfterViewInit, OnChanges {
  @Input() participant!: Participant;
  @Input() isLocal = false;

  @ViewChild('videoEl') videoEl?: ElementRef<HTMLVideoElement>;

  ngAfterViewInit(): void {
    this._attachStream();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Re-attach whenever the stream reference changes
    if (changes['participant'] && this.videoEl) {
      this._attachStream();
    }
  }

  private _attachStream(): void {
    const el = this.videoEl?.nativeElement;
    if (!el) return;
    const stream = this.participant?.stream;
    if (el.srcObject !== stream) {
      el.srcObject = stream ?? null;
      if (stream) el.play().catch(() => {/* autoplay policy: muted allows it */});
    }
  }

  /** Map audio level (0-1) to animated bar heights (px) */
  barHeight(idx: number): number {
    const level = this.participant?.audioLevel ?? 0;
    const base = 3;
    const offsets = [0, Math.PI / 3, (2 * Math.PI) / 3];
    // Clamp between 3 and 12 px
    return Math.max(base, Math.min(12, base + level * 9 * Math.abs(Math.sin(Date.now() / 150 + offsets[idx]))));
  }
}
