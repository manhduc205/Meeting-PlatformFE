import {
  Component, inject, signal, computed,
  ViewChild, ElementRef, AfterViewChecked, OnDestroy, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MeetingStateService } from '../../services/meeting-state.service';
import { SidebarTab } from '../../models/meeting.model';
import { MeetingService, ParticipantDto, WaitingParticipantDto } from '../../../../core/services/meeting.service';
import { HostControlService } from '../../services/host-control.service';
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

        <!-- ── Participants (Zoom-style, with inline waiting room for host) ── -->
        <ng-container *ngIf="ms.sidebarTab() === 'participants'">
          <div class="participants-panel">

            <!-- Header -->
            <div class="p-panel-header">
              <span class="p-panel-title">Participants ({{ sidebarParticipants().length }})</span>
              <div class="p-panel-actions">
                <button class="p-icon-btn" title="Làm mới" (click)="refresh()">
                  <span class="material-symbols-outlined" [class.spin]="isRefreshing()">refresh</span>
                </button>
                <button class="p-icon-btn" (click)="ms.sidebarTab.set(null)" title="Đóng">
                  <span class="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            <!-- ══ WAITING ROOM SECTION (host only, shown above active participants) ══ -->
            <div class="waiting-section" *ngIf="ms.isHost()">
              <!-- Collapsible header -->
              <div class="waiting-section-header" (click)="toggleWaitingCollapsed()">
                <div class="waiting-section-title">
                  <span class="waiting-pulse-dot" *ngIf="ms.waitingParticipants().length > 0"></span>
                  <span>Đang chờ tham gia</span>
                  <span class="waiting-count-badge" *ngIf="ms.waitingParticipants().length > 0">{{ ms.waitingParticipants().length }}</span>
                </div>
                <div class="waiting-header-right">
                  <span class="waiting-chevron" [class.collapsed]="waitingCollapsed()">
                    <span class="material-symbols-outlined">expand_less</span>
                  </span>
                </div>
              </div>

              <!-- Collapsible body -->
              <div class="waiting-body" [class.collapsed]="waitingCollapsed()">
                <!-- Bulk action bar (only when there are waiting participants) -->
                <div class="waiting-bulk-bar" *ngIf="ms.waitingParticipants().length > 0">
                  <button class="bulk-btn admit" (click)="$event.stopPropagation(); ms.admitAllWaiting()">
                    <span class="material-symbols-outlined">done_all</span>
                    Duyệt tất cả
                  </button>
                  <button class="bulk-btn reject-all" (click)="$event.stopPropagation(); rejectAllWaiting()">
                    <span class="material-symbols-outlined">remove_done</span>
                    Từ chối tất cả
                  </button>
                </div>

                <div class="waiting-list">
                  <div *ngIf="ms.waitingParticipants().length === 0" class="waiting-empty-state">
                    <span class="material-symbols-outlined">people_outline</span>
                    Không có ai đang chờ
                  </div>
                  <div
                    class="waiting-row"
                    *ngFor="let p of ms.waitingParticipants(); trackBy: trackById"
                  >
                    <!-- Avatar -->
                    <div class="p-avatar waiting-avatar"
                         [style.background-image]="p.avatarUrl ? 'url(' + p.avatarUrl + ')' : ''"
                         [style.background-color]="!p.avatarUrl ? getAvatarColor(p.id) : 'transparent'">
                      <span *ngIf="!p.avatarUrl">{{ getWaitingInitials(p) }}</span>
                    </div>

                    <!-- Name -->
                    <div class="p-info">
                      <span class="p-name">{{ p.fullName || p.firstName }}</span>
                      <span class="waiting-tag">Đang chờ...</span>
                    </div>

                    <!-- Approve / Reject icon buttons (hover reveals color) -->
                    <div class="waiting-actions">
                      <button
                        class="w-btn approve"
                        title="Cho phép vào"
                        (click)="$event.stopPropagation(); ms.approveWaitingUser(p.id)"
                      >
                        <span class="material-symbols-outlined">check</span>
                      </button>
                      <button
                        class="w-btn reject"
                        title="Từ chối"
                        (click)="$event.stopPropagation(); ms.rejectWaitingUser(p.id)"
                      >
                        <span class="material-symbols-outlined">close</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Divider between waiting and active -->
              <div class="section-divider">
                <span>Trong phòng</span>
              </div>
            </div>

            <!-- ══ ACTIVE PARTICIPANTS LIST ══ -->
            <div class="p-list">
              <div *ngIf="sidebarParticipants().length === 0" class="p-empty">
                <span class="material-symbols-outlined">group</span>
                <p>Đang tải danh sách thành viên...</p>
              </div>

              <div
                *ngFor="let p of sidebarParticipants(); trackBy: trackById"
                class="p-row"
                [class.p-row-me]="p.isMe"
              >
                <!-- Avatar -->
                <div class="p-avatar"
                     [style.background-image]="p.avatarUrl ? 'url(' + p.avatarUrl + ')' : ''"
                     [style.background-color]="!p.avatarUrl ? getAvatarColor(p.id) : 'transparent'">
                  <span *ngIf="!p.avatarUrl">{{ getInitials(p) }}</span>
                </div>

                <!-- Name + role tags -->
                <div class="p-info">
                  <span class="p-name">
                    {{ p.fullName || p.firstName }}
                    <span class="p-role-tag" *ngIf="getRoleLabel(p)"> ({{ getRoleLabel(p) }})</span>
                  </span>
                  <span class="p-hand-label" *ngIf="p.status === 'RAISING_HAND'">✋ Đang giơ tay</span>
                </div>

                <!-- Status icons + host actions -->
                <div class="p-right">
                  <!-- Mic/Cam icons: only meaningful for local user -->
                  <ng-container *ngIf="p.isMe">
                    <span class="p-media-icon" [class.muted]="ms.isMuted()" title="Microphone">
                      <span class="material-symbols-outlined">{{ ms.isMuted() ? 'mic_off' : 'mic' }}</span>
                    </span>
                    <span class="p-media-icon" [class.muted]="!ms.isCameraOn()" title="Camera">
                      <span class="material-symbols-outlined">{{ ms.isCameraOn() ? 'videocam' : 'videocam_off' }}</span>
                    </span>
                  </ng-container>

                  <!-- Host actions (show on hover, only for others) -->
                  <div class="p-host-actions" *ngIf="ms.isHost() && !p.isMe">
                    <button class="p-action-btn" title="Tắt mic" (click)="muteParticipant(p)">
                      <span class="material-symbols-outlined">mic_off</span>
                    </button>
                    <button class="p-action-btn danger" title="Xoá khỏi phòng" (click)="kickParticipant(p)">
                      <span class="material-symbols-outlined">person_remove</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Bottom action bar -->
            <div class="p-footer">
              <button class="p-footer-btn" id="invite-btn">Invite</button>
              <button class="p-footer-btn" *ngIf="ms.isHost()" (click)="muteAll()">Mute all</button>
              <div class="p-more-wrap" *ngIf="ms.isHost()">
                <button class="p-footer-btn p-more-btn" (click)="toggleMoreMenu($event)" id="more-options-btn">···</button>
                <div class="p-more-menu" *ngIf="showMoreMenu()" (click)="$event.stopPropagation()">
                  <button class="p-more-item" (click)="askAllUnmute()">Ask all to unmute</button>
                  <div class="p-more-divider"></div>
                  <div class="p-more-toggle-row">
                    <span>Mute all upon entry</span>
                    <button class="toggle-btn" [class.on]="muteOnEntry()" (click)="muteOnEntry.update(v => !v)">
                      <span class="toggle-knob"></span>
                    </button>
                  </div>
                  <div class="p-more-toggle-row">
                    <span>Play join and leave sound</span>
                    <button class="toggle-btn" [class.on]="joinSound()" (click)="joinSound.update(v => !v)">
                      <span class="toggle-knob"></span>
                    </button>
                  </div>
                  <div class="p-more-divider"></div>
                  <button class="p-more-item" (click)="showMoreMenu.set(false)">Host tools for participants</button>
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
  hostControlService = inject(HostControlService);
  meetingService = inject(MeetingService);

  chatInput = '';
  isRefreshing = signal(false);
  showMoreMenu = signal(false);
  muteOnEntry = signal(false);
  joinSound = signal(true);
  waitingCollapsed = signal(false);

  @ViewChild('chatBottom') private chatBottom!: ElementRef;
  private _subs = new Subscription();

  private readonly ALL_TABS: TabDef[] = [
    {
      id: 'participants',
      icon: 'group',
      label: 'People',
      // Badge shows total of waiting participants (for host only)
      badgeFn: () => this.ms.isHost() ? this.ms.waitingParticipants().length : 0
    },
    {
      id: 'chat',
      icon: 'chat',
      label: 'Chat',
      badgeFn: () => this.ms.unreadMessages()
    },
    { id: 'polls', icon: 'bar_chart', label: 'Polls' }
  ];

  visibleTabs = computed(() => this.ALL_TABS);

  /**
   * Participants list driven directly by ms.backendParticipants().
   * No local polling — data is refreshed by MeetingStateService via WebSocket events.
   * Backend already sorts: HOST → isMe → RAISING_HAND → ACTIVE.
   */
  sidebarParticipants = computed(() => this.ms.backendParticipants());

  constructor() {
    // Close more menu when switching tabs
    effect(() => {
      const tab = this.ms.sidebarTab();
      if (tab !== 'participants') this.showMoreMenu.set(false);
    });
  }

  ngOnDestroy(): void {
    this._subs.unsubscribe();
  }

  /** Manual refresh — calls /sidebar directly to update the list */
  refresh(): void {
    if (this.isRefreshing()) return;
    this.isRefreshing.set(true);
    this.meetingService.getSidebarParticipants(this.ms.meetingCode()).subscribe({
      next: (res) => { this.ms.backendParticipants.set(res); this.isRefreshing.set(false); },
      error: () => this.isRefreshing.set(false)
    });
    // Also refresh waiting room at the same time
    if (this.ms.isHost()) {
      this.ms.loadWaitingRoom();
    }
  }

  toggleWaitingCollapsed(): void {
    this.waitingCollapsed.update(v => !v);
  }

  rejectAllWaiting(): void {
    this.ms.rejectAllWaiting();
  }

  toggleMoreMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showMoreMenu.update(v => !v);
  }

  /** Build the role label string: "Host, me" / "me" / "Host" / "" */
  getRoleLabel(p: ParticipantDto): string {
    const parts: string[] = [];
    if (p.status === 'HOST') parts.push('Host');
    if (p.isMe) parts.push('me');
    return parts.join(', ');
  }

  muteParticipant(p: ParticipantDto): void {
    if (!this.ms.isHost()) return;
    this.hostControlService.sendCommand(this.ms.meetingCode(), 'MUTE_ALL' as any, p.id).subscribe({
      next: () => this.ms.showToast(`Đã tắt mic ${p.firstName}`, 'success'),
      error: () => this.ms.showToast('Không thể tắt mic', 'error')
    });
  }

  muteAll(): void {
    if (!this.ms.isHost()) return;
    this.hostControlService.sendCommand(this.ms.meetingCode(), 'MUTE_ALL').subscribe({
      next: () => this.ms.showToast('🔇 Đã tắt mic tất cả', 'success'),
      error: () => this.ms.showToast('Lỗi khi mute all', 'error')
    });
  }

  askAllUnmute(): void {
    this.showMoreMenu.set(false);
    this.ms.showToast('📢 Đã yêu cầu mọi người bật mic', 'info');
  }

  kickParticipant(p: ParticipantDto): void {
    if (!this.ms.isHost()) return;
    this.hostControlService.sendCommand(this.ms.meetingCode(), 'KICK_PARTICIPANT', p.id).subscribe({
      next: () => this.ms.showToast(`${p.firstName} đã bị xoá khỏi phòng`, 'success'),
      error: () => this.ms.showToast('Không thể kick participant', 'error')
    });
  }

  getInitials(p: ParticipantDto): string {
    if (p.fullName) {
      return p.fullName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
    }
    return ((p.firstName?.[0] || '') + ((p as any).lastName?.[0] || '')).toUpperCase() || '?';
  }

  /** Separate helper for WaitingParticipantDto (uses fullName field from API) */
  getWaitingInitials(p: WaitingParticipantDto): string {
    if (p.fullName) {
      return p.fullName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
    }
    return ((p.firstName?.[0] || '') + (p.lastName?.[0] || '')).toUpperCase() || '?';
  }

  getAvatarColor(id: string): string {
    const colors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399', '#2dd4bf', '#38bdf8', '#818cf8', '#a78bfa', '#e879f9'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  trackById(_: number, p: { id: string }) { return p.id; }

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
