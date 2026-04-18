import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MeetingStateService } from '../../services/meeting-state.service';

@Component({
  selector: 'app-knock-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="knock-container" *ngIf="notifications().length > 0">
      <div
        class="knock-toast"
        *ngFor="let n of notifications(); trackBy: trackById"
        [@.disabled]="false"
      >
        <div class="knock-avatar" [style.background]="getAvatarColor(n.userId)">
          {{ getInitials(n.firstName, n.lastName) }}
        </div>
        <div class="knock-info">
          <span class="knock-name">{{ n.firstName }} {{ n.lastName }}</span>
          <span class="knock-msg">đang xin vào phòng</span>
        </div>
        <div class="knock-actions">
          <button class="k-btn approve" (click)="approve(n.userId)" title="Duyệt">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
            Duyệt
          </button>
          <button class="k-btn reject" (click)="reject(n.userId)" title="Từ chối">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .knock-container {
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: all;
    }

    .knock-toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      background: #1e2235;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 14px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
      min-width: 300px;
      max-width: 360px;
      animation: slideIn 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      backdrop-filter: blur(20px);
    }

    @keyframes slideIn {
      from { transform: translateX(120%); opacity: 0; }
      to   { transform: translateX(0);   opacity: 1; }
    }

    .knock-avatar {
      width: 36px; height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
    }

    .knock-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;

      .knock-name {
        font-size: 13px;
        font-weight: 700;
        color: #f1f5f9;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .knock-msg {
        font-size: 11px;
        color: rgba(255,255,255,0.45);
      }
    }

    .knock-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    .k-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-family: inherit;
      font-size: 12px;
      font-weight: 700;
      transition: all 0.15s;

      &.approve {
        background: linear-gradient(135deg, #10b981, #059669);
        color: #fff;
        box-shadow: 0 4px 12px rgba(16,185,129,0.35);
        &:hover { filter: brightness(0.92); }
      }

      &.reject {
        width: 32px;
        height: 32px;
        padding: 0;
        justify-content: center;
        background: rgba(239, 68, 68, 0.12);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.25);
        &:hover { background: rgba(239, 68, 68, 0.25); }
      }
    }

    @media (max-width: 480px) {
      .knock-container { right: 10px; left: 10px; }
      .knock-toast { min-width: unset; width: 100%; }
    }
  `]
})
export class KnockNotificationsComponent {
  ms = inject(MeetingStateService);

  notifications = this.ms.hostKnockNotifications;

  approve(userId: string) { this.ms.approveWaitingUser(userId); }
  reject(userId: string)  { this.ms.rejectWaitingUser(userId); }

  trackById(_: number, n: { id: string }) { return n.id; }

  getInitials(firstName: string, lastName: string): string {
    return ((firstName?.[0] || '') + (lastName?.[0] || '')).toUpperCase() || '?';
  }

  getAvatarColor(id: string): string {
    const colors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399', '#2dd4bf', '#38bdf8', '#818cf8', '#a78bfa', '#e879f9'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }
}
