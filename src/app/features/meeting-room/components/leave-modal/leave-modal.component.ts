import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MeetingStateService } from '../../services/meeting-state.service';

@Component({
  selector: 'app-leave-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Backdrop -->
    <div class="lm-backdrop" (click)="close()"></div>

    <!-- Modal -->
    <div class="lm-modal" role="dialog" aria-modal="true" aria-labelledby="lm-title">
      <div class="lm-header">
        <div class="lm-icon">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45
                     12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2
                     19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67
                     m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3
                     a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/>
            <line x1="22" y1="2" x2="2" y2="22"/>
          </svg>
        </div>
        <h2 id="lm-title" class="lm-title">Rời cuộc họp?</h2>
      </div>

      <p class="lm-desc">
        Bạn là host của cuộc họp này. Hãy chọn hành động phù hợp:
      </p>

      <div class="lm-actions">
        <!-- Leave only -->
        <button class="lm-btn lm-btn--leave" (click)="leave()" id="btn-leave-only">
          <span class="lm-btn-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16,17 21,12 16,7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </span>
          <span class="lm-btn-text">
            <span class="lm-btn-label">Rời phòng</span>
            <span class="lm-btn-sub">Meeting vẫn tiếp tục</span>
          </span>
        </button>

        <!-- End for all -->
        <button class="lm-btn lm-btn--end" (click)="end()" id="btn-end-for-all">
          <span class="lm-btn-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
            </svg>
          </span>
          <span class="lm-btn-text">
            <span class="lm-btn-label">Kết thúc cho tất cả</span>
            <span class="lm-btn-sub">Mọi người sẽ bị ngắt kết nối</span>
          </span>
        </button>

        <!-- Cancel -->
        <button class="lm-btn lm-btn--cancel" (click)="close()" id="btn-cancel-leave">
          Huỷ
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .lm-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(4px);
      animation: fadeIn 0.18s ease;
    }

    .lm-modal {
      position: relative;
      z-index: 1;
      background: #1e1f2e;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 28px 28px 24px;
      width: 380px;
      max-width: calc(100vw - 32px);
      box-shadow: 0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
      animation: slideUp 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .lm-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .lm-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: rgba(239, 68, 68, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ef4444;
      flex-shrink: 0;
    }

    .lm-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: #f1f5f9;
      margin: 0;
    }

    .lm-desc {
      font-size: 0.875rem;
      color: #94a3b8;
      margin: 0 0 22px;
      line-height: 1.5;
    }

    .lm-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .lm-btn {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      transition: all 0.18s ease;
      width: 100%;
    }

    .lm-btn-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      flex-shrink: 0;
    }

    .lm-btn-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .lm-btn-label {
      font-size: 0.9rem;
      font-weight: 600;
      display: block;
    }

    .lm-btn-sub {
      font-size: 0.75rem;
      opacity: 0.7;
      display: block;
    }

    /* Leave button */
    .lm-btn--leave {
      background: rgba(99, 102, 241, 0.12);
      color: #a5b4fc;
      border: 1px solid rgba(99, 102, 241, 0.25);
    }
    .lm-btn--leave .lm-btn-icon {
      background: rgba(99, 102, 241, 0.2);
      color: #818cf8;
    }
    .lm-btn--leave:hover {
      background: rgba(99, 102, 241, 0.22);
      border-color: rgba(99, 102, 241, 0.5);
      transform: translateY(-1px);
    }

    /* End button */
    .lm-btn--end {
      background: rgba(239, 68, 68, 0.12);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.25);
    }
    .lm-btn--end .lm-btn-icon {
      background: rgba(239, 68, 68, 0.2);
      color: #f87171;
    }
    .lm-btn--end:hover {
      background: rgba(239, 68, 68, 0.22);
      border-color: rgba(239, 68, 68, 0.5);
      transform: translateY(-1px);
    }

    /* Cancel button */
    .lm-btn--cancel {
      background: transparent;
      color: #64748b;
      border: 1px solid rgba(255,255,255,0.06);
      justify-content: center;
      font-size: 0.875rem;
      font-weight: 500;
      padding: 10px;
    }
    .lm-btn--cancel:hover {
      background: rgba(255,255,255,0.04);
      color: #94a3b8;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(16px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `]
})
export class LeaveModalComponent {
  ms = inject(MeetingStateService);

  close(): void {
    this.ms.showLeaveModal.set(false);
  }

  leave(): void {
    this.ms.leaveMeeting();
  }

  end(): void {
    this.ms.endMeeting();
  }
}
