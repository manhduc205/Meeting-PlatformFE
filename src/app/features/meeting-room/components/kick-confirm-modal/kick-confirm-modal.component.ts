import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MeetingStateService } from '../../services/meeting-state.service';

@Component({
  selector: 'app-kick-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="kcm-backdrop" (click)="cancel()"></div>
    <section class="kcm-modal" role="dialog" aria-modal="true" aria-labelledby="kick-confirm-title">
      <h2 id="kick-confirm-title">Kick {{ targetName }}?</h2>
      <p>Bạn có chắc chắn muốn loại người này ra khỏi phòng ngay lập tức không?</p>

      <div class="kcm-actions">
        <button class="kcm-btn kcm-btn--cancel" type="button" (click)="cancel()" [disabled]="ms.isKickingParticipant()">
          Hủy
        </button>
        <button class="kcm-btn kcm-btn--confirm" type="button" (click)="confirm()" [disabled]="ms.isKickingParticipant()">
          {{ ms.isKickingParticipant() ? 'Đang loại…' : 'Xác nhận' }}
        </button>
      </div>
    </section>
  `,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 1100; display: grid; place-items: center; }
    .kcm-backdrop { position: absolute; inset: 0; background: rgba(0, 0, 0, .62); backdrop-filter: blur(2px); }
    .kcm-modal {
      position: relative; width: min(360px, calc(100vw - 32px)); box-sizing: border-box;
      padding: 22px; border: 1px solid #3e4148; border-radius: 10px;
      color: #f4f4f5; background: #24262b; box-shadow: 0 16px 48px rgba(0,0,0,.5);
    }
    h2 { margin: 0 0 12px; font-size: 17px; font-weight: 700; }
    p { margin: 0; color: #d1d5db; font-size: 13px; line-height: 1.5; }
    .kcm-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
    .kcm-btn {
      min-width: 76px; border: 1px solid transparent; border-radius: 7px; padding: 8px 15px;
      color: inherit; cursor: pointer; font: inherit; font-size: 13px; font-weight: 600;
    }
    .kcm-btn:disabled { cursor: wait; opacity: .65; }
    .kcm-btn--cancel { border-color: #5a5d63; background: #2c2e33; }
    .kcm-btn--cancel:hover:not(:disabled) { background: #383b41; }
    .kcm-btn--confirm { background: #e53935; }
    .kcm-btn--confirm:hover:not(:disabled) { background: #f04440; }
  `],
})
export class KickConfirmModalComponent {
  ms = inject(MeetingStateService);

  get targetName(): string {
    return this.ms.kickTarget()?.name ?? 'người tham gia này';
  }

  cancel(): void {
    this.ms.cancelKickParticipant();
  }

  confirm(): void {
    this.ms.confirmKickParticipant();
  }
}
