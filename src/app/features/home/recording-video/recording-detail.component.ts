import { Component, OnInit, signal, inject, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { RecordingService } from '../../meeting-room/services/recording.service';
import { AiContentStatus, RecordingDetailResponse, TranscriptSegment, TranscriptSegmentPageResponse } from '../../meeting-room/models/recording.model';

@Component({
  selector: 'app-recording-detail', standalone: true, imports: [CommonModule, RouterModule],
  templateUrl: './recording-detail.component.html', styleUrls: ['./recording-detail.component.scss']
})
export class RecordingDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private recordingService = inject(RecordingService);
  constructor(public router: Router) {}

  @ViewChild('videoEl') videoElRef?: ElementRef<HTMLVideoElement>;
  readonly detail = signal<RecordingDetailResponse | null>(null);
  readonly transcriptSegments = signal<TranscriptSegment[]>([]);
  readonly isLoading = signal(false);
  readonly isTranscriptLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly transcriptError = signal<string | null>(null);
  readonly hasNextTranscript = signal(false);
  readonly nextTranscriptCursor = signal<string | null>(null);
  readonly activeTab = signal<'summary' | 'aichat'>('summary');
  readonly sidebarOpen = signal(true);
  readonly isStarred = signal(false);
  readonly isPlaying = signal(false);
  readonly currentTimeSeconds = signal(0);
  readonly videoDurationSeconds = signal(0);
  readonly toastMessage = signal<string | null>(null);
  readonly playbackSpeed = signal(1);
  readonly isTheaterMode = signal(false);
  readonly isControlsVisible = signal(true);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private hideControlsTimer: ReturnType<typeof setTimeout> | null = null;
  readonly speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  readonly transcriptLanguage = computed(() => this.detail()?.transcript.language || this.detail()?.ai.sourceLanguage || 'vi');
  readonly progressPct = computed(() => {
    const duration = this.videoDurationSeconds() || this.detail()?.metadata.durationSeconds || 0;
    return duration > 0 ? Math.min(100, (this.currentTimeSeconds() / duration) * 100) : 0;
  });

  ngOnInit(): void {
    const recordingId = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(recordingId) || recordingId <= 0) {
      this.errorMessage.set('Đường dẫn bản ghi không hợp lệ.');
      return;
    }
    this.loadDetail(recordingId);
  }

  private loadDetail(recordingId: number): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.recordingService.getRecordingDetail(recordingId).subscribe({
      next: (detail: RecordingDetailResponse) => {
        this.detail.set(detail);
        this.isLoading.set(false);
        if (detail.transcript.status === 'READY') this.loadTranscriptPage();
      },
      error: (error: unknown) => {
        console.error('Failed to load recording detail:', error);
        this.errorMessage.set('Không thể tải bản ghi. Vui lòng thử lại.');
        this.isLoading.set(false);
      }
    });
  }

  loadTranscriptPage(): void {
    const detail = this.detail();
    if (!detail || this.isTranscriptLoading() || !detail.transcript.language) return;
    this.isTranscriptLoading.set(true);
    this.transcriptError.set(null);
    this.recordingService.getTranscriptSegments(detail.id, detail.transcript.language, this.nextTranscriptCursor()).subscribe({
      next: (page: TranscriptSegmentPageResponse) => {
        this.transcriptSegments.update(items => [...items, ...page.items]);
        this.nextTranscriptCursor.set(page.nextCursor);
        this.hasNextTranscript.set(page.hasNext);
        this.isTranscriptLoading.set(false);
      },
      error: (error: unknown) => {
        console.error('Failed to load transcript:', error);
        this.transcriptError.set('Không thể tải transcript. Vui lòng thử lại.');
        this.isTranscriptLoading.set(false);
      }
    });
  }

  togglePlay(): void {
    const video = this.videoElRef?.nativeElement;
    if (!video) return;
    if (video.paused) video.play().catch(() => this.showToast('Không thể phát video này.'));
    else video.pause();
  }

  seekRelative(seconds: number): void {
    const video = this.videoElRef?.nativeElement;
    if (video) video.currentTime = Math.max(0, Math.min(video.currentTime + seconds, video.duration || 0));
  }

  seekToProgress(event: MouseEvent): void {
    const video = this.videoElRef?.nativeElement;
    if (!video || !video.duration) return;
    const bar = event.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const fraction = Math.max(0, Math.min((event.clientX - rect.left) / rect.width, 1));
    video.currentTime = fraction * video.duration;
  }

  seekToMs(milliseconds: number): void {
    const video = this.videoElRef?.nativeElement;
    if (!video) return;
    video.currentTime = Math.max(0, milliseconds / 1000);
    video.play().catch(() => {});
  }

  onVideoLoaded(): void {
    const duration = this.videoElRef?.nativeElement.duration;
    if (duration && Number.isFinite(duration)) this.videoDurationSeconds.set(duration);
  }

  onVideoTimeUpdate(): void {
    const currentTime = this.videoElRef?.nativeElement.currentTime;
    if (currentTime != null) this.currentTimeSeconds.set(currentTime);
  }

  setSpeed(speed: number): void {
    const video = this.videoElRef?.nativeElement;
    if (video) video.playbackRate = speed;
    this.playbackSpeed.set(speed);
  }

  toggleFullscreen(): void {
    const el = this.videoElRef?.nativeElement?.closest('.rd-player') as HTMLElement | null;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  toggleTheater(): void { this.isTheaterMode.update(v => !v); }

  onPlayerMouseMove(): void {
    this.isControlsVisible.set(true);
    if (this.hideControlsTimer) clearTimeout(this.hideControlsTimer);
    if (this.isPlaying()) {
      this.hideControlsTimer = setTimeout(() => this.isControlsVisible.set(false), 3000);
    }
  }

  onPlayerMouseLeave(): void {
    if (this.isPlaying()) this.isControlsVisible.set(false);
  }

  setTab(tab: 'summary' | 'aichat'): void { this.activeTab.set(tab); }
  toggleSidebar(): void { this.sidebarOpen.update(value => !value); }
  toggleStar(): void { this.isStarred.update(value => !value); }
  goBack(): void { this.router.navigate(['/recordings']); }

  copyShareLink(): void {
    navigator.clipboard.writeText(window.location.href)
      .then(() => this.showToast('Đã sao chép link chia sẻ.'));
  }

  copyTranscript(): void {
    const text = this.transcriptSegments().map(s => `[${this.formatTimestamp(s.startMs)}] ${s.text}`).join('\n');
    if (text) navigator.clipboard.writeText(text).then(() => this.showToast('Đã sao chép transcript.'));
  }

  copyLine(text: string, event: Event): void {
    event.stopPropagation();
    navigator.clipboard.writeText(text).then(() => this.showToast('Đã sao chép.'));
  }

  showTranscriptUnavailable(): void {
    this.showToast('Nút dịch transcript sẽ được kết nối với dịch vụ AI ở giai đoạn tiếp theo.');
  }

  formatTimestamp(milliseconds: number): string {
    const total = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  formatDuration(seconds: number | null): string { return this.formatTimestamp((seconds || 0) * 1000); }

  formatRelativeTime(date: string): string {
    const normalized = date.endsWith('Z') || date.includes('+') ? date : `${date}Z`;
    const minutes = Math.floor((Date.now() - new Date(normalized).getTime()) / 60000);
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} giờ trước`;
    return `${Math.floor(minutes / 1440)} ngày trước`;
  }

  formatFullDate(date: string): string {
    const normalized = date.endsWith('Z') || date.includes('+') ? date : `${date}Z`;
    return new Date(normalized).toLocaleString('vi-VN');
  }

  statusLabel(status: AiContentStatus): string {
    return { NOT_REQUESTED: 'Chưa tạo', REQUESTED: 'Đang chờ', PROCESSING: 'Đang xử lý', READY: 'Sẵn sàng', FAILED: 'Không thể tạo' }[status];
  }

  visibilityLabel(visibility: RecordingDetailResponse['visibility']): string {
    return {
      PRIVATE: 'Riêng tư',
      MEETING_MEMBERS: 'Thành viên cuộc họp',
      LINK_ONLY: 'Ai có liên kết',
      SELECTED_USERS: 'Chia sẻ chọn lọc'
    }[visibility];
  }

  visibilityIcon(visibility: RecordingDetailResponse['visibility']): string {
    return visibility === 'PRIVATE' ? 'lock' : visibility === 'LINK_ONLY' ? 'link' : visibility === 'SELECTED_USERS' ? 'person' : 'groups';
  }

  private showToast(message: string): void {
    this.toastMessage.set(message);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage.set(null), 2800);
  }
}
