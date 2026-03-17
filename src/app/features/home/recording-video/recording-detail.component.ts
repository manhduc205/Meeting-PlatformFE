import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';

interface TranscriptLine {
  time: string;
  text: string;
}

@Component({
  selector: 'app-recording-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './recording-detail.component.html',
  styleUrls: ['./recording-detail.component.scss']
})
export class RecordingDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  constructor(public router: Router) {}

  // Calendar data
  calendarDays = [
    { num: 15, type: 'prev' }, { num: 16, type: 'prev' },
    { num: 17, type: 'today' }, { num: 18, type: 'next' },
    { num: 19, type: 'next' }, { num: 20, type: 'next' }, { num: 21, type: 'next' }
  ];
  weekDays = ['S','M','T','W','T','F','S'];

  isPlaying = signal(false);
  isStarred = signal(false);
  progressPct = signal(35);
  showReactionBar = signal(true);

  reactions = ['❤️', '👍', '👏', '😮', '😂'];

  transcriptLines: TranscriptLine[] = [
    { time: '0:01', text: 'Video of a video meeting interface being navigated...' },
    { time: '0:05', text: 'Demonstrating the clip recording features in VideoConnect Enterprise dashboard.' },
  ];

  recording = {
    id: '',
    title: "Nguyễn Đức's Clip 03/17/2026",
    creator: 'Nguyễn Đức',
    createdAt: '11 minutes ago',
    views: 0,
    duration: '0:09',
    currentTime: '0:03',
    thumbnailUrl: 'https://picsum.photos/seed/clip1/1280/720',
    avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA1aRgCTeGrTf0M9gDA2uvR3VxB85d_SZ9HB_81FVZp6U-aoZVzmhZHEIxUpbyEZ4QvZAxekq7RrasZGgPgO2iLx9otT2eWbY55fSE8e9bBy_MA8rB37rF6xfYkZ21ssQ7gqSiYGJoY-oiRriqOS4Z7iVBeQTiqiDmsAA0RqA6Pdari5tcfgwpYUJDBtA_pDGwaqAA6IzMvEpgiKlAwxAWKBf3wHQj49lgzV_69swNT5YQK_XAGqKs6r3_PuY4ZVls8Lte2YXSIXeI'
  };

  ngOnInit() {
    this.recording.id = this.route.snapshot.paramMap.get('id') || '1';
  }

  togglePlay() { this.isPlaying.update(v => !v); }
  toggleStar() { this.isStarred.update(v => !v); }

  goBack() {
    this.router.navigate(['/recordings']);
  }
}
