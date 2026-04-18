import { Component, inject, signal, ViewChild, ElementRef, AfterViewChecked, OnDestroy, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MeetingStateService } from '../../services/meeting-state.service';
import { SidebarTab, Participant } from '../../models/meeting.model';
import { MeetingService, ParticipantDto, WaitingParticipantDto } from '../../../../core/services/meeting.service';
import { HostControlService } from '../../services/host-control.service';
import { AuthService } from '../../../auth/auth.service';
import { PollPanelComponent } from '../poll-panel/poll-panel.component';
import { Subscription } from 'rxjs';

interface TabDef { id: SidebarTab; icon: string; label: string; hostOnly?: boolean; badgeFn?: () => number }

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, PollPanelComponent],
  template: `
    <div class="sidebar-panel">
      <!-- Tab bar -->
      <div class="sidebar-tabs">
        <div class="tabs-scroll">
          <button
            *ngFor="let tab of visibleTabs()"
            class="sidebar-tab"
            [class.active]="ms.sidebarTab() === tab.id"
            (click)="ms.toggleSidebar(tab.id)"
          >
            <span class="material-symbols-outlined">{{ tab.icon }}</span>
            <span>{{ tab.label }}</span>
            <span class="tab-badge" *ngIf="tab.badgeFn && tab.badgeFn() > 0">{{ tab.badgeFn() }}</span>
            <div class="tab-indicator" *ngIf="ms.sidebarTab() === tab.id"></div>
          </button>
        </div>
        <button class="sidebar-close-btn" (click)="ms.sidebarTab.set(null)">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <!-- Panel content -->
      <div class="sidebar-content">

        <!-- ── Participants ── -->
        <ng-container *ngIf="ms.sidebarTab() === 'participants'">
          <div class="participants-panel">
            <div class="participants-header">
              <span class="header-label">{{ (activeParticipants()?.length || 0) }} người tham gia</span>
              <button class="icon-btn" (click)="loadActiveParticipants()" title="Làm mới">
                <span class="material-symbols-outlined" [class.spin]="isLoadingParticipants()">refresh</span>
              </button>
            </div>

            <div class="participants-list" *ngIf="activeParticipants()">

              <!-- Host row -->
              <p class="section-label" *ngIf="host">👑 HOST</p>
              <div class="participant-row host-row" *ngIf="host">
                <div class="p-avatar"
                     [style.background-image]="host.avatarUrl ? 'url(' + host.avatarUrl + ')' : ''"
                     [style.background-color]="getAvatarColor(host.id)">
                  {{ !host.avatarUrl ? getInitials(host) : '' }}
                </div>
                <div class="p-info">
                  <span class="p-name">{{ host.firstName }} {{ host.lastName }}</span>
                  <span class="host-badge">Host</span>
                </div>
                <div class="p-status-icons">
                  <span class="status-icon" *ngIf="isHandRaised(host.id)" title="Đang giơ tay">✋</span>
                </div>
              </div>

              <!-- Participants -->
              <p class="section-label mt-2" *ngIf="others.length > 0">PARTICIPANTS</p>
              <div class="participant-row" *ngFor="let p of others; trackBy: trackById">
                <div class="p-avatar"
                     [style.background-image]="p.avatarUrl ? 'url(' + p.avatarUrl + ')' : ''"
                     [style.background-color]="getAvatarColor(p.id)">
                  {{ !p.avatarUrl ? getInitials(p) : '' }}
                </div>
                <div class="p-info">
                  <div class="p-name-row">
                    <span class="p-name">{{ p.firstName }} {{ p.lastName }}</span>
                    <span class="p-you-tag" *ngIf="p.id === _localId">(Bạn)</span>
                  </div>
                  <div class="p-hand-state" *ngIf="isHandRaised(p.id)">
                    <span>✋</span> Đang giơ tay
                  </div>
                </div>
                <div class="p-status-icons">
                  <span class="status-icon hand" *ngIf="isHandRaised(p.id)" [title]="p.firstName + ' đang giơ tay'">✋</span>
                </div>
                <div class="p-actions" *ngIf="ms.isHost() && p.id !== _localId">
                  <button class="action-btn" title="Tắt mic" (click)="muteParticipant(p)">
                    <span class="material-symbols-outlined">mic_off</span>
                  </button>
                  <button class="action-btn danger" title="Kick" (click)="kickParticipant(p)">
                    <span class="material-symbols-outlined">person_remove</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="participants-footer">
              <button class="footer-btn secondary" *ngIf="ms.isHost()" (click)="muteAll()">Mute All</button>
              <button class="footer-btn primary">Mời tham gia</button>
            </div>
          </div>
        </ng-container>

        <!-- ── Waiting Room (Host only) ── -->
        <ng-container *ngIf="ms.sidebarTab() === 'waiting'">
          <div class="waiting-panel">
            <div class="waiting-header">
              <span>Phòng chờ · {{ ms.waitingParticipants().length }}</span>
              <button class="admit-all-btn"
                      *ngIf="ms.waitingParticipants().length > 0"
                      (click)="ms.admitAllWaiting()">
                ✓ Duyệt tất cả
              </button>
            </div>

            <div class="waiting-list">
              <div class="waiting-empty" *ngIf="ms.waitingParticipants().length === 0">
                <span class="material-symbols-outlined">hourglass_empty</span>
                <p>Không có ai trong phòng chờ</p>
              </div>

              <div class="waiting-row" *ngFor="let p of ms.waitingParticipants(); trackBy: trackWaitingById">
                <div class="p-avatar"
                     [style.background-image]="p.avatarUrl ? 'url(' + p.avatarUrl + ')' : ''"
                     [style.background-color]="getAvatarColor(p.id)">
                  {{ !p.avatarUrl ? getWaitingInitials(p) : '' }}
                </div>
                <div class="p-info">
                  <span class="p-name">{{ p.firstName }} {{ p.lastName }}</span>
                  <span class="waiting-status-tag">Đang chờ...</span>
                </div>
                <div class="waiting-actions">
                  <button class="w-action-btn approve" (click)="ms.approveWaitingUser(p.id)" title="Duyệt">
                    <span class="material-symbols-outlined">check</span>
                  </button>
                  <button class="w-action-btn reject" (click)="ms.rejectWaitingUser(p.id)" title="Từ chối">
                    <span class="material-symbols-outlined">close</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- ── Chat ── -->
        <ng-container *ngIf="ms.sidebarTab() === 'chat'">
          <div class="chat-panel">
            <div class="chat-messages" #chatMessages>
              <div *ngFor="let msg of ms.messages()"
                   class="chat-msg"
                   [class.chat-msg-me]="msg.senderId === 'local'"
                   [class.chat-msg-other]="msg.senderId !== 'local'">
                <div *ngIf="msg.senderId !== 'local'" class="chat-avatar"
                     [style.background]="getParticipantColor(msg.senderId)">
                  {{ getParticipantInitials(msg.senderId) }}
                </div>
                <div class="chat-bubble-wrap">
                  <p class="chat-sender" *ngIf="msg.senderId !== 'local'">{{ msg.senderName }}</p>
                  <div class="chat-bubble" [class.mine]="msg.senderId === 'local'">{{ msg.text }}</div>
                  <p class="chat-time">{{ msg.timestamp | date:'HH:mm' }}</p>
                </div>
              </div>
              <div #chatBottom></div>
            </div>
            <div class="chat-input-area">
              <button class="chat-icon-btn">
                <span class="material-symbols-outlined">sentiment_satisfied</span>
              </button>
              <input class="chat-input"
                     [(ngModel)]="chatInput"
                     placeholder="Nhắn tin cho mọi người..."
                     (keydown.enter)="sendMsg()" />
              <button class="chat-send-btn" [disabled]="!chatInput.trim()" (click)="sendMsg()">
                <span class="material-symbols-outlined">send</span>
              </button>
            </div>
          </div>
        </ng-container>

        <!-- ── Polls ── -->
        <ng-container *ngIf="ms.sidebarTab() === 'polls'">
          <app-poll-panel></app-poll-panel>
        </ng-container>

      </div>
    </div>
  `,
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements AfterViewChecked, OnDestroy {
  ms = inject(MeetingStateService);
  meetingService = inject(MeetingService);
  hostControlService = inject(HostControlService);
  authService = inject(AuthService);

  chatInput = '';

  activeParticipants = signal<ParticipantDto[] | null>(null);
  isLoadingParticipants = signal(false);

  @ViewChild('chatBottom') private chatBottom!: ElementRef;

  private _refreshInterval: ReturnType<typeof setInterval> | null = null;
  private _subs = new Subscription();

  private readonly ALL_TABS: TabDef[] = [
    { id: 'participants', icon: 'group', label: 'People' },
    {
      id: 'waiting',
      icon: 'hourglass_bottom',
      label: 'Phòng chờ',
      hostOnly: true,
      badgeFn: () => this.ms.waitingParticipants().length
    },
    {
      id: 'chat',
      icon: 'chat',
      label: 'Chat',
      badgeFn: () => this.ms.unreadMessages()
    },
    { id: 'polls', icon: 'bar_chart', label: 'Polls' }
  ];

  visibleTabs = computed(() => {
    const isHost = this.ms.isHost();
    return this.ALL_TABS.filter(t => !t.hostOnly || isHost);
  });

  constructor() {
    // Reload participants each time the People tab becomes active
    effect(() => {
      const tab = this.ms.sidebarTab();
      if (tab === 'participants' && this.ms.meetingCode()) {
        this.loadActiveParticipants();
        // Auto-refresh every 30s while tab is open
        this._clearRefreshInterval();
        this._refreshInterval = setInterval(() => {
          if (this.ms.sidebarTab() === 'participants') {
            this.loadActiveParticipants();
          }
        }, 30_000);
      } else {
        this._clearRefreshInterval();
      }

      // Refresh waiting room list each time the Waiting tab becomes active
      if (tab === 'waiting' && this.ms.isHost()) {
        this.ms.loadWaitingRoom();
      }
    });
  }

  ngOnDestroy(): void {
    this._clearRefreshInterval();
    this._subs.unsubscribe();
  }

  private _clearRefreshInterval(): void {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }
  }

  get _localId(): string {
    return this.authService.getCurrentUser()?.id || '';
  }

  loadActiveParticipants() {
    if (this.isLoadingParticipants()) return; // Prevent double call
    this.isLoadingParticipants.set(true);
    // Use /participants/sidebar which returns only active (non-waiting) participants
    this.meetingService.getSidebarParticipants(this.ms.meetingCode()).subscribe({
      next: (res) => {
        this.activeParticipants.set(res);
        this.isLoadingParticipants.set(false);
      },
      error: (err) => {
        console.error('Failed to load sidebar participants', err);
        // Fallback: try the general endpoint
        this.meetingService.getAllParticipants(this.ms.meetingCode()).subscribe({
          next: (res) => this.activeParticipants.set(res),
          error: () => {}
        });
        this.isLoadingParticipants.set(false);
      }
    });
  }

  muteParticipant(p: ParticipantDto) {
    if (!this.ms.isHost()) return;
    this.hostControlService.sendCommand(this.ms.meetingCode(), 'MUTE_ALL' as any, p.id).subscribe({
      next: () => this.ms.showToast(`Đã tắt mic ${p.firstName}`, 'success'),
      error: () => this.ms.showToast('Không thể tắt mic', 'error')
    });
  }

  muteAll() {
    if (!this.ms.isHost()) return;
    this.hostControlService.sendCommand(this.ms.meetingCode(), 'MUTE_ALL').subscribe({
      next: () => this.ms.showToast('🔇 Đã tắt mic tất cả', 'success'),
      error: () => this.ms.showToast('Lỗi khi mute all', 'error')
    });
  }

  kickParticipant(p: ParticipantDto) {
    if (!this.ms.isHost()) return;
    this.hostControlService.sendCommand(this.ms.meetingCode(), 'KICK_PARTICIPANT', p.id).subscribe({
      next: () => {
        this.ms.showToast(`${p.firstName} đã bị xoá khỏi phòng`, 'success');
        this.loadActiveParticipants();
      },
      error: () => this.ms.showToast('Không thể kick participant', 'error')
    });
  }

  /** Check if a participant (by backend ID) has their hand raised */
  isHandRaised(userId: string): boolean {
    return this.ms.raisedHandList().some(p => p.id === userId);
  }

  getInitials(p: ParticipantDto): string {
    return ((p.firstName?.[0] || '') + (p.lastName?.[0] || '')).toUpperCase() || '?';
  }

  getWaitingInitials(p: WaitingParticipantDto): string {
    return ((p.firstName?.[0] || '') + (p.lastName?.[0] || '')).toUpperCase() || '?';
  }

  getAvatarColor(id: string): string {
    const colors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399', '#2dd4bf', '#38bdf8', '#818cf8', '#a78bfa', '#e879f9', '#f43f5e'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  get host(): ParticipantDto | undefined {
    return this.activeParticipants()?.find(p => p.status === 'HOST');
  }

  get others(): ParticipantDto[] {
    return this.activeParticipants()?.filter(p => p.status !== 'HOST') || [];
  }

  trackById(_: number, p: ParticipantDto) { return p.id; }
  trackWaitingById(_: number, p: WaitingParticipantDto) { return p.id; }

  ngAfterViewChecked() {
    this.chatBottom?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
  }

  sendMsg() {
    if (!this.chatInput.trim()) return;
    this.ms.sendMessage(this.chatInput.trim());
    this.chatInput = '';
  }

  getParticipantColor(senderId: string): string {
    return this.ms.participants().find(p => p.id === senderId)?.avatarColor ?? '#666';
  }

  getParticipantInitials(senderId: string): string {
    return this.ms.participants().find(p => p.id === senderId)?.initials ?? '?';
  }
}
