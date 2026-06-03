import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { RecordingService } from '../../meeting-room/services/recording.service';
import { RecordingResponse } from '../../meeting-room/models/recording.model';

interface TranscriptLine {
  time: string;
  text: string;
}

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

@Component({
  selector: 'app-recording-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './recording-detail.component.html',
  styleUrls: ['./recording-detail.component.scss']
})
export class RecordingDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private recordingService = inject(RecordingService);
  constructor(public router: Router) {}

  isPlaying = signal(false);
  isStarred = signal(false);
  progressPct = signal(35);
  activeTab = signal<'summary' | 'aichat'>('summary');
  chatMessages = signal<ChatMessage[]>([]);
  chatInput = '';

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  recordingData = signal<RecordingResponse | null>(null);

  copyToastVisible = signal(false);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  chatSuggestions = [
    'summary.💡 List 3 core points and their supporting arguments',
    'summary.🔑 List 5 keywords and explain their meanings',
    'summary.📌 Extract 5 key points',
    'summary.📋 List 5 technical terms and explain them in simple language',
    'summary.📋 Extract the outline',
  ];

  transcriptLines: TranscriptLine[] = [
    { time: '0:01', text: 'Video of a video meeting interface being navigated...' },
    { time: '0:05', text: 'Demonstrating the clip recording features in VideoConnect Enterprise dashboard.' },
  ];

  timelineEvents = [
    { time: '0:01', event: 'Initial interface tour' },
    { time: '0:05', event: 'Recording feature demo' },
    { time: '0:08', event: 'Summary of capabilities' },
  ];

  // Derived recording display fields
  recording = computed(() => {
    const r = this.recordingData();
    if (!r) return null;
    // Normalize datetime: add Z if no timezone suffix
    const normalizeDate = (d: string) =>
      d.endsWith('Z') || d.includes('+') ? d : d + 'Z';
    return {
      egressId: r.egressId,
      meetingCode: r.meetingCode,
      title: r.recordingName,
      creator: r.hostName,
      hostAvatar: r.hostAvatar,
      createdAt: this.formatRelativeTime(r.createdAt),
      createdAtFull: new Date(normalizeDate(r.createdAt)).toLocaleString('vi-VN'),
      status: r.status,
      statusLabel: this.getStatusLabel(r.status),
      visibility: r.visibility,
      visibilityLabel: this.getVisibilityLabel(r.visibility),
      visibilityIcon: this.getVisibilityIcon(r.visibility),
      shareToken: r.shareToken ?? null,
      fileUrl: r.fileUrl,
      duration: this.formatDuration(r.duration),
      durationSeconds: r.duration,
      currentTime: '0:00',
    };
  });

  ngOnInit() {
    const egressId = this.route.snapshot.paramMap.get('id') || '';
    const meetingCode = this.route.snapshot.queryParamMap.get('meetingCode') || '';

    if (egressId && meetingCode) {
      this.loadRecording(meetingCode, egressId);
    }
  }

  private loadRecording(meetingCode: string, egressId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.recordingService.getRecordings(meetingCode).subscribe({
      next: (list) => {
        const found = list.find(r => r.egressId === egressId) || null;
        if (!found) {
          this.errorMessage.set('Không tìm thấy bản ghi này.');
        } else {
          this.recordingData.set(found);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load recording detail:', err);
        this.errorMessage.set('Không thể tải bản ghi. Vui lòng thử lại.');
        this.isLoading.set(false);
      }
    });
  }

  private formatDuration(seconds: number): string {
    if (!seconds || seconds === 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  private formatRelativeTime(isoDate: string): string {
    if (!isoDate) return '';
    // Normalize: add Z if no timezone info so Date parses as UTC
    const normalized = isoDate.endsWith('Z') || isoDate.includes('+') ? isoDate : isoDate + 'Z';
    const diff = Date.now() - new Date(normalized).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  }

  private getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      STARTING: 'Đang khởi động',
      RECORDING: 'Đang ghi',
      COMPLETED: 'Hoàn thành',
      FAILED: 'Lỗi'
    };
    return map[status] || status;
  }

  private getVisibilityLabel(visibility: string): string {
    const map: Record<string, string> = {
      PRIVATE: 'Riêng tư',
      MEETING_MEMBERS: 'Thành viên cuộc họp',
      LINK_ONLY: 'Qua liên kết',
      PUBLIC: 'Công khai'
    };
    return map[visibility] || visibility;
  }

  private getVisibilityIcon(visibility: string): string {
    const map: Record<string, string> = {
      PRIVATE: 'lock',
      MEETING_MEMBERS: 'group',
      LINK_ONLY: 'link',
      PUBLIC: 'public'
    };
    return map[visibility] || 'lock';
  }

  togglePlay() { this.isPlaying.update(v => !v); }
  toggleStar() { this.isStarred.update(v => !v); }

  setTab(tab: 'summary' | 'aichat') { this.activeTab.set(tab); }

  sendSuggestion(text: string) {
    this.chatInput = text;
    this.sendChat(null);
  }

  sendChat(event: Event | null) {
    if (event instanceof KeyboardEvent && (event as KeyboardEvent).shiftKey) return;
    event?.preventDefault?.();
    const msg = this.chatInput.trim();
    if (!msg) return;
    this.chatMessages.update(msgs => [...msgs, { role: 'user', text: msg }]);
    this.chatInput = '';
    // Simulated AI response
    setTimeout(() => {
      this.chatMessages.update(msgs => [
        ...msgs,
        { role: 'ai', text: 'I\'m analyzing the recording content. This feature will be connected to the AI backend.' }
      ]);
    }, 800);
  }

  // ── Clipboard ───────────────────────────────────────────────────────────
  copyLine(text: string) {
    navigator.clipboard.writeText(text).then(() => this.showToast());
  }

  copyAllTranscript() {
    const full = this.transcriptLines
      .map(l => `[${l.time}] ${l.text}`)
      .join('\n');
    navigator.clipboard.writeText(full).then(() => this.showToast());
  }

  copyShareLink() {
    const r = this.recordingData();
    if (!r) return;
    if (r.shareToken) {
      const link = `${window.location.origin}/share/${r.shareToken}`;
      navigator.clipboard.writeText(link).then(() => this.showToast());
    } else if (r.fileUrl) {
      navigator.clipboard.writeText(r.fileUrl).then(() => this.showToast());
    }
  }

  private showToast() {
    this.copyToastVisible.set(true);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.copyToastVisible.set(false), 2000);
  }

  goBack() {
    const r = this.recordingData();
    if (r) {
      this.router.navigate(['/recordings'], { queryParams: { meetingCode: r.meetingCode } });
    } else {
      this.router.navigate(['/recordings']);
    }
  }
}
