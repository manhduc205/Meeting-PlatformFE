import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

export interface Recording {
  id: string;
  title: string;
  creator: string;
  createdAt: string;
  duration: string;
  thumbnailUrl: string;
  avatarUrl: string;
  views: number;
}

@Component({
  selector: 'app-recordings',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './recordings.component.html',
  styleUrls: ['./recordings.component.scss']
})
export class RecordingsComponent {
  constructor(public router: Router) {}

  viewMode = signal<'grid' | 'list'>('grid');
  bannerClosed = signal(false);
  activeSubNav = signal('clips');
  searchQuery = signal('');

  subNavItems = [
    { icon: 'notifications', label: 'Notifications', key: 'notifications' },
    { icon: 'history', label: 'Recent', key: 'recent' },
    { icon: 'video_library', label: 'My clips', key: 'clips' },
    { icon: 'playlist_play', label: 'My playlists', key: 'playlists' },
    { icon: 'share', label: 'Shared with me', key: 'shared' },
    { icon: 'star', label: 'Starred', key: 'starred' },
    { icon: 'delete', label: 'Trash', key: 'trash' },
  ];

  recordings: Recording[] = [
    {
      id: '1',
      title: "Nguyễn Đức's Clip 03/17/2026",
      creator: 'Nguyễn Đức',
      createdAt: '1 minute ago',
      duration: '9 sec',
      thumbnailUrl: 'https://picsum.photos/seed/clip1/640/360',
      avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA1aRgCTeGrTf0M9gDA2uvR3VxB85d_SZ9HB_81FVZp6U-aoZVzmhZHEIxUpbyEZ4QvZAxekq7RrasZGgPgO2iLx9otT2eWbY55fSE8e9bBy_MA8rB37rF6xfYkZ21ssQ7gqSiYGJoY-oiRriqOS4Z7iVBeQTiqiDmsAA0RqA6Pdari5tcfgwpYUJDBtA_pDGwaqAA6IzMvEpgiKlAwxAWKBf3wHQj49lgzV_69swNT5YQK_XAGqKs6r3_PuY4ZVls8Lte2YXSIXeI',
      views: 0
    }
  ];

  navigateTo(item: any) {
    if (item.route) {
      this.router.navigate([item.route]);
    }
  }

  openRecording(recording: Recording) {
    this.router.navigate(['/recordings', recording.id]);
  }

  setViewMode(mode: 'grid' | 'list') {
    this.viewMode.set(mode);
  }

  setActiveSubNav(key: string) {
    this.activeSubNav.set(key);
  }
}
