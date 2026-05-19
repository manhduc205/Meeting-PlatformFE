import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';

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
  constructor(public router: Router) {}

  isPlaying = signal(false);
  isStarred = signal(false);
  progressPct = signal(35);
  activeTab = signal<'summary' | 'aichat'>('summary');
  chatMessages = signal<ChatMessage[]>([]);
  chatInput = '';

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

  recording = {
    id: '',
    title: "Nguyễn Đức's Clip 03/17/2026",
    creator: 'Nguyễn Đức',
    createdAt: '11 minutes ago',
    views: 0,
    duration: '0:09',
    currentTime: '0:03',
    thumbnailUrl: 'https://picsum.photos/seed/clip1/1280/720',
  };

  ngOnInit() {
    this.recording.id = this.route.snapshot.paramMap.get('id') || '1';
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

  private showToast() {
    this.copyToastVisible.set(true);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.copyToastVisible.set(false), 2000);
  }

  goBack() {
    this.router.navigate(['/recordings']);
  }
}
