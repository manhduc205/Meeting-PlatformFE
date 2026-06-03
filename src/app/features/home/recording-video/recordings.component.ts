import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RecordingService } from '../../meeting-room/services/recording.service';
import { RecordingResponse } from '../../meeting-room/models/recording.model';

@Component({
  selector: 'app-recordings',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './recordings.component.html',
  styleUrls: ['./recordings.component.scss']
})
export class RecordingsComponent implements OnInit {
  private router = inject(Router);
  private recordingService = inject(RecordingService);

  viewMode = signal<'grid' | 'list'>('grid');
  bannerClosed = signal(false);
  activeSubNav = signal('clips');
  searchQuery = signal('');
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  recordings = signal<RecordingResponse[]>([]);

  subNavItems = [
    { icon: 'notifications', label: 'Notifications', key: 'notifications' },
    { icon: 'history', label: 'Recent', key: 'recent' },
    { icon: 'video_library', label: 'My clips', key: 'clips' },
    { icon: 'playlist_play', label: 'My playlists', key: 'playlists' },
    { icon: 'share', label: 'Shared with me', key: 'shared' },
    { icon: 'star', label: 'Starred', key: 'starred' },
    { icon: 'delete', label: 'Trash', key: 'trash' },
  ];

  ngOnInit(): void {
    this.loadRecordings();
  }

  loadRecordings(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.recordingService.getAllMyRecordings().subscribe({
      next: (data) => {
        this.recordings.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load recordings:', err);
        this.errorMessage.set('Không thể tải danh sách bản ghi. Vui lòng thử lại.');
        this.isLoading.set(false);
      }
    });
  }

  get filteredRecordings(): RecordingResponse[] {
    const q = this.searchQuery().toLowerCase();
    if (!q) return this.recordings();
    return this.recordings().filter(r =>
      r.recordingName.toLowerCase().includes(q) ||
      r.hostName.toLowerCase().includes(q) ||
      r.meetingCode.toLowerCase().includes(q)
    );
  }

  openRecording(recording: RecordingResponse) {
    this.router.navigate(['/recordings', recording.egressId], {
      queryParams: { meetingCode: recording.meetingCode }
    });
  }

  setViewMode(mode: 'grid' | 'list') {
    this.viewMode.set(mode);
  }

  setActiveSubNav(key: string) {
    this.activeSubNav.set(key);
  }

  formatDuration(seconds: number): string {
    if (!seconds || seconds === 0) return '0 sec';
    if (seconds < 60) return `${seconds} sec`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  formatRelativeTime(isoDate: string): string {
    if (!isoDate) return '';
    // Normalize: add Z if no timezone info present so Date parses as UTC
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

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      STARTING: 'Đang khởi động',
      RECORDING: 'Đang ghi',
      COMPLETED: 'Hoàn thành',
      FAILED: 'Lỗi'
    };
    return map[status] || status;
  }

  getVisibilityLabel(visibility: string): string {
    const map: Record<string, string> = {
      PRIVATE: 'Riêng tư',
      MEETING_MEMBERS: 'Thành viên cuộc họp',
      LINK_ONLY: 'Qua liên kết',
      PUBLIC: 'Công khai'
    };
    return map[visibility] || visibility;
  }

  getVisibilityIcon(visibility: string): string {
    const map: Record<string, string> = {
      PRIVATE: 'lock',
      MEETING_MEMBERS: 'group',
      LINK_ONLY: 'link',
      PUBLIC: 'public'
    };
    return map[visibility] || 'lock';
  }

  copyShareLink(recording: RecordingResponse, event: Event): void {
    event.stopPropagation();
    if (recording.shareToken) {
      const link = `${window.location.origin}/share/${recording.shareToken}`;
      navigator.clipboard.writeText(link);
    } else if (recording.fileUrl) {
      navigator.clipboard.writeText(recording.fileUrl);
    }
  }

  downloadFile(recording: RecordingResponse, event: Event): void {
    event.stopPropagation();
    if (!recording.fileUrl) return;
    const a = document.createElement('a');
    a.href = recording.fileUrl;
    a.download = recording.recordingName + '.mp4';
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
