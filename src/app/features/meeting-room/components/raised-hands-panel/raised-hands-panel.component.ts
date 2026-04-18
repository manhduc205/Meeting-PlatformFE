import { Component, EventEmitter, Output, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MeetingStateService } from '../../services/meeting-state.service';
import { RaisedHandParticipant } from '../../models/meeting.types';

/**
 * RaisedHandsPanelComponent
 * ─────────────────────────────────────────────────────────────────────────────
 * Displays the real-time list of participants who have raised their hand.
 *
 * Performance contract:
 *   - Uses trackBy: trackById in *ngFor — Angular ONLY patches DOM nodes for
 *     newly pushed items. Existing nodes are never destroyed/re-created on
 *     delta updates from the WebSocket.
 *   - OnPush change detection: only re-renders when signal() values change,
 *     which is already handled by Angular signals infrastructure.
 */
@Component({
  selector: 'app-raised-hands-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rh-panel">
      <!-- Header -->
      <div class="rh-header">
        <div class="rh-header-left">
          <div class="rh-icon-bg">
            <!-- Hand icon -->
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" width="13" height="13"
                 class="rh-icon-amber">
              <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
              <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
              <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
            </svg>
          </div>
          <span class="rh-title">Raised Hands</span>
          <span class="rh-count-badge" *ngIf="ms.raisedHandCount() > 0">
            {{ ms.raisedHandCount() > 99 ? '99+' : ms.raisedHandCount() }}
          </span>
        </div>
        <button class="rh-close-btn" (click)="closePanel.emit()" id="raised-hands-close-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Empty state -->
      <div class="rh-empty" *ngIf="ms.raisedHandList().length === 0">
        <div class="rh-empty-icon">✋</div>
        <p class="rh-empty-text">No one has raised their hand yet</p>
      </div>

      <!-- Hand list — trackBy prevents full DOM re-render on RAISE/LOWER delta -->
      <div class="rh-list" *ngIf="ms.raisedHandList().length > 0">
        <div
          class="rh-item"
          *ngFor="let p of ms.raisedHandList(); trackBy: trackById"
          [id]="'rh-participant-' + p.id"
        >
          <!-- Avatar: image if available, else initials -->
          <div class="rh-avatar-wrap">
            <img
              *ngIf="p.avatarUrl"
              [src]="p.avatarUrl"
              [alt]="p.fullName"
              class="rh-avatar-img"
            />
            <div
              *ngIf="!p.avatarUrl"
              class="rh-avatar-initials"
              [style.background]="getAvatarColor(p.id)"
            >{{ getInitials(p.fullName) }}</div>
            <span class="rh-hand-indicator">✋</span>
          </div>

          <!-- Info -->
          <div class="rh-info">
            <p class="rh-name">{{ p.fullName }}</p>
            <p class="rh-email">{{ p.email }}</p>
          </div>

          <!-- Status chip -->
          <span class="rh-status-chip">
            <span class="rh-status-dot"></span>
            Raising
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .rh-panel {
      position: fixed;
      bottom: 100px;
      left: calc(50% + 130px);
      transform: translateX(-50%);
      width: 300px;
      background: rgba(30, 33, 39, 0.97);
      backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.65);
      overflow: hidden;
      z-index: 9998;
      display: flex;
      flex-direction: column;
      animation: rhFadeIn 0.18s ease-out forwards;
      max-height: 420px;
    }

    @keyframes rhFadeIn {
      from { opacity: 0; transform: translate(-50%, 14px) scale(0.96); }
      to   { opacity: 1; transform: translate(-50%, 0) scale(1); }
    }

    /* Header */
    .rh-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07);
      flex-shrink: 0;
    }

    .rh-header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .rh-icon-bg {
      width: 24px;
      height: 24px;
      border-radius: 8px;
      background: rgba(251, 191, 36, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .rh-icon-amber { color: #fbbf24; display: block; }

    .rh-title {
      color: #fff;
      font-size: 14px;
      font-weight: 500;
    }

    .rh-count-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #f59e0b;
      color: #000;
      font-size: 10px;
      font-weight: 700;
      border-radius: 10px;
      padding: 1px 6px;
      min-width: 18px;
      height: 18px;
      animation: rhBadgePulse 0.4s ease-out;
    }

    @keyframes rhBadgePulse {
      0%   { transform: scale(1.3); }
      100% { transform: scale(1); }
    }

    .rh-close-btn {
      padding: 4px;
      border-radius: 8px;
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.4);
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      &:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.1);
      }
      svg { display: block; }
    }

    /* Empty state */
    .rh-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
      gap: 8px;
    }

    .rh-empty-icon {
      font-size: 32px;
      opacity: 0.4;
    }

    .rh-empty-text {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.35);
      text-align: center;
      margin: 0;
    }

    /* List */
    .rh-list {
      overflow-y: auto;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;

      &::-webkit-scrollbar { width: 4px; }
      &::-webkit-scrollbar-track { background: transparent; }
      &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 4px;
      }
    }

    /* Item */
    .rh-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 10px;
      transition: background 0.15s;
      animation: rhItemIn 0.2s ease-out;

      &:hover { background: rgba(255, 255, 255, 0.05); }
    }

    @keyframes rhItemIn {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .rh-avatar-wrap {
      position: relative;
      flex-shrink: 0;
    }

    .rh-avatar-img,
    .rh-avatar-initials {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      object-fit: cover;
    }

    .rh-avatar-initials {
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      user-select: none;
    }

    .rh-hand-indicator {
      position: absolute;
      bottom: -3px;
      right: -5px;
      font-size: 12px;
      line-height: 1;
      animation: rhHandWave 1.2s ease-in-out infinite;
      transform-origin: bottom center;
    }

    @keyframes rhHandWave {
      0%, 100% { transform: rotate(0deg); }
      25%  { transform: rotate(15deg); }
      75%  { transform: rotate(-10deg); }
    }

    .rh-info {
      flex: 1;
      min-width: 0;
    }

    .rh-name {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.9);
      font-weight: 500;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .rh-email {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.35);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Status chip */
    .rh-status-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      background: rgba(251, 191, 36, 0.15);
      border: 1px solid rgba(251, 191, 36, 0.25);
      color: #fbbf24;
      font-size: 10px;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 20px;
      flex-shrink: 0;
    }

    .rh-status-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #fbbf24;
      animation: rhDotPulse 1.5s ease-in-out infinite;
    }

    @keyframes rhDotPulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.3; }
    }
  `]
})
export class RaisedHandsPanelComponent {
  @Output() closePanel = new EventEmitter<void>();

  ms = inject(MeetingStateService);

  private readonly AVATAR_COLORS = [
    '#4f46e5', '#0ea5e9', '#ec4899', '#10b981', '#f59e0b',
    '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4',
  ];

  /**
   * trackBy function — Angular identifies each list item by participant id.
   * When RAISE pushes a new item, only that new DOM node is created.
   * When LOWER filters an item, only that DOM node is removed.
   * No other items are touched.
   */
  trackById(_index: number, item: RaisedHandParticipant): string {
    return item.id;
  }

  getInitials(fullName: string): string {
    return fullName
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getAvatarColor(id: string): string {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return this.AVATAR_COLORS[h % this.AVATAR_COLORS.length];
  }
}
