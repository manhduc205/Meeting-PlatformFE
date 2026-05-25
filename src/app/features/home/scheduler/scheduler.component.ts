import { Component, inject, signal, OnInit, OnDestroy, HostListener, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { ScheduleModalComponent } from '../schedule-modal/schedule-modal.component';

export interface ScheduledMeeting {
  id: string;
  title: string;
  startTime: string;
  endTime?: string;
  hostId: string;
  hostName?: string;
  hostAvatar?: string;
  meetingCode: string;
  meetingUrl?: string;
  description?: string;
  participants?: { name: string; avatar?: string; isHost?: boolean }[];
  isMyMeeting: boolean;
}

@Component({
  selector: 'app-scheduler',
  standalone: true,
  imports: [CommonModule, ScheduleModalComponent],
  templateUrl: './scheduler.component.html',
  styleUrls: ['./scheduler.component.scss']
})
export class SchedulerComponent implements OnInit, AfterViewInit, OnDestroy {
  private authService = inject(AuthService);
  private el = inject(ElementRef);
  router = inject(Router);

  /** Pixels per hour — must match $hour-h in SCSS */
  readonly HOUR_PX = 44;

  user = this.authService.getUserSignal();

  // ── View state ──────────────────────────────────────────────
  currentView = signal<'day' | 'week' | 'month'>('week');
  currentDate = signal(new Date());
  isScheduleModalOpen = signal(false);

  // ── Time tracking ───────────────────────────────────────────
  currentTime = signal(new Date());
  private timeInterval: any;

  // ── Calendar picker ─────────────────────────────────────────
  showCalendarPicker = signal(false);
  pickerDate = signal(new Date()); // month being shown in picker

  // ── Meeting detail panel ────────────────────────────────────
  selectedMeeting = signal<ScheduledMeeting | null>(null);

  // ── Meetings data ───────────────────────────────────────────
  scheduledMeetings = signal<ScheduledMeeting[]>([]);

  // ── Days of week labels for picker ─────────────────────────
  readonly pickerDayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  ngOnInit() {
    this.loadMockMeetings();
    this.timeInterval = setInterval(() => this.currentTime.set(new Date()), 60000);
  }

  ngAfterViewInit() {
    // Auto-scroll to current time (7 AM if before 7 AM)
    setTimeout(() => {
      const body = this.el.nativeElement.querySelector('.calendar-body');
      if (body) {
        const now = new Date();
        const scrollHour = Math.max(now.getHours() - 1, 7);
        body.scrollTop = scrollHour * this.HOUR_PX;
      }
    }, 100);
  }

  ngOnDestroy() {
    if (this.timeInterval) clearInterval(this.timeInterval);
  }

  // ── Close picker/detail on outside click ───────────────────
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.calendar-picker-anchor') && !target.closest('.mini-calendar-popup')) {
      this.showCalendarPicker.set(false);
    }
    if (!target.closest('.meeting-block') && !target.closest('.meeting-detail-panel')) {
      this.selectedMeeting.set(null);
    }
  }

  loadMockMeetings() {
    const now = new Date();
    const userId = this.user()?.id || 'current-user';
    const userName = this.user()?.name || 'Me';
    const userAvatar = this.user()?.picture;

    // All meetings are 2h+ so the block is tall enough to show avatar row
    const meetings: ScheduledMeeting[] = [
      // Today: MY meeting 9:00–11:30 (2h30)
      {
        id: '1',
        title: 'Product Strategy Sync',
        startTime: this.dt(now, 0, 9, 0),
        endTime:   this.dt(now, 0, 11, 30),
        hostId: userId,
        hostName: userName,
        hostAvatar: userAvatar,
        meetingCode: 'abc123',
        meetingUrl: 'https://videoconnect.io/j/abc123',
        description: `${userName} is inviting you to a scheduled VideoConnect meeting.\nJoin Meeting: https://videoconnect.io/j/abc123`,
        participants: [
          { name: userName, avatar: userAvatar, isHost: true },
          { name: 'Alex Rivers' },
          { name: 'Jordan Smith' },
          { name: 'Sam Lee' },
        ],
        isMyMeeting: true
      },
      // Today: INVITED meeting 14:00–16:00 (2h)
      {
        id: '2',
        title: 'Online Yoga DIY',
        startTime: this.dt(now, 0, 14, 0),
        endTime:   this.dt(now, 0, 16, 30),
        hostId: 'other-1',
        hostName: 'Dana Jackson',
        meetingCode: 'def456',
        meetingUrl: 'https://videoconnect.io/j/def456',
        description: 'Dana Jackson is inviting you to the Weekly Design Review.\nJoin Meeting: https://videoconnect.io/j/def456',
        participants: [
          { name: 'Dana Jackson', isHost: true },
          { name: userName, avatar: userAvatar },
        ],
        isMyMeeting: false
      },
      // Yesterday: MY meeting 10:00–12:30 (2h30)
      {
        id: '3',
        title: 'Frontend Tech Review',
        startTime: this.dt(now, -1, 10, 0),
        endTime:   this.dt(now, -1, 12, 30),
        hostId: userId,
        hostName: userName,
        hostAvatar: userAvatar,
        meetingCode: 'mno345',
        meetingUrl: 'https://videoconnect.io/j/mno345',
        description: 'Monthly frontend architecture review.',
        participants: [
          { name: userName, avatar: userAvatar, isHost: true },
          { name: 'Alex Rivers' },
        ],
        isMyMeeting: true
      },
      // Tomorrow: INVITED meeting 11:00–13:30 (2h30)
      {
        id: '4',
        title: 'Q3 Marketing Workshop',
        startTime: this.dt(now, 1, 11, 0),
        endTime:   this.dt(now, 1, 13, 30),
        hostId: 'other-2',
        hostName: 'Billy Piper',
        meetingCode: 'ghi789',
        meetingUrl: 'https://videoconnect.io/j/ghi789',
        description: 'Quarterly marketing planning session.',
        participants: [
          { name: 'Billy Piper', isHost: true },
          { name: 'Casey Morgan' },
          { name: userName, avatar: userAvatar },
        ],
        isMyMeeting: false
      },
      // Day +2: MY meeting 9:30–12:00 (2h30)
      {
        id: '5',
        title: `${userName.split(' ')[0]}'s Team Standup`,
        startTime: this.dt(now, 2, 9, 30),
        endTime:   this.dt(now, 2, 12, 0),
        hostId: userId,
        hostName: userName,
        hostAvatar: userAvatar,
        meetingCode: 'jkl012',
        meetingUrl: 'https://videoconnect.io/j/jkl012',
        description: `Team standup hosted by ${userName}.`,
        participants: [
          { name: userName, avatar: userAvatar, isHost: true },
          { name: 'Alex Rivers' },
          { name: 'Dana Jackson' },
        ],
        isMyMeeting: true
      },
      // Day +3: INVITED meeting 14:00–16:30 (2h30)
      {
        id: '6',
        title: 'Design System Review',
        startTime: this.dt(now, 3, 14, 0),
        endTime:   this.dt(now, 3, 16, 30),
        hostId: 'other-3',
        hostName: 'Kelsey Rake',
        meetingCode: 'pqr678',
        meetingUrl: 'https://videoconnect.io/j/pqr678',
        description: 'Kelsey Rake is inviting you to a Design System Review.',
        participants: [
          { name: 'Kelsey Rake', isHost: true },
          { name: userName, avatar: userAvatar },
          { name: 'Jordan Smith' },
        ],
        isMyMeeting: false
      },
    ];
    this.scheduledMeetings.set(meetings);
  }

  private dt(base: Date, dayOffset: number, hour: number, minute: number): string {
    const d = new Date(base);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  }

  // ── Week computation ────────────────────────────────────────

  get weekDays(): Date[] {
    const date = this.currentDate();
    const day = date.getDay();
    const startOfWeek = new Date(date);
    const diff = day === 0 ? -6 : 1 - day; // Mon = first
    startOfWeek.setDate(date.getDate() + diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d;
    });
  }

  get weekLabel(): string {
    const days = this.weekDays;
    const first = days[0];
    const last  = days[6];
    const opts: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
    if (this.currentView() === 'month') {
      return this.currentDate().toLocaleString('en-US', opts);
    }
    if (first.getMonth() === last.getMonth()) return first.toLocaleString('en-US', opts);
    return `${first.toLocaleString('en-US', { month: 'short' })} – ${last.toLocaleString('en-US', opts)}`;
  }

  // ── Month computation ───────────────────────────────────────

  get monthDays(): Date[] {
    const date = this.currentDate();
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const startDay = firstDayOfMonth.getDay();
    const diff = startDay === 0 ? -6 : 1 - startDay; // Mon = first

    const startOfCalendar = new Date(firstDayOfMonth);
    startOfCalendar.setDate(firstDayOfMonth.getDate() + diff);

    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(startOfCalendar);
      d.setDate(startOfCalendar.getDate() + i);
      return d;
    });
  }

  isCurrentMonth(date: Date): boolean {
    const current = this.currentDate();
    return date.getMonth() === current.getMonth() && date.getFullYear() === current.getFullYear();
  }

  get hours(): number[] {
    return Array.from({ length: 24 }, (_, i) => i);
  }

  formatHour(h: number): string {
    if (h === 0)  return '';
    if (h < 12)   return `${h} AM`;
    if (h === 12) return '12 PM';
    return `${h - 12} PM`;
  }

  /** Strictly today only — used for highlighting */
  isToday(date: Date): boolean {
    const t = new Date();
    return date.getDate()     === t.getDate()  &&
           date.getMonth()    === t.getMonth() &&
           date.getFullYear() === t.getFullYear();
  }

  isWeekend(date: Date): boolean {
    return date.getDay() === 0 || date.getDay() === 6;
  }

  prev() {
    const d = new Date(this.currentDate());
    if (this.currentView() === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else if (this.currentView() === 'day') {
      d.setDate(d.getDate() - 1);
    } else {
      d.setDate(d.getDate() - 7);
    }
    this.currentDate.set(d);
  }

  next() {
    const d = new Date(this.currentDate());
    if (this.currentView() === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else if (this.currentView() === 'day') {
      d.setDate(d.getDate() + 1);
    } else {
      d.setDate(d.getDate() + 7);
    }
    this.currentDate.set(d);
  }

  goToToday() { this.currentDate.set(new Date()); }

  // ── Calendar picker ─────────────────────────────────────────

  toggleCalendarPicker(event: MouseEvent) {
    event.stopPropagation();
    this.showCalendarPicker.update(v => !v);
    // Sync picker to current week's month
    this.pickerDate.set(new Date(this.currentDate()));
  }

  get pickerMonthLabel(): string {
    return this.pickerDate().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }

  prevPickerMonth() {
    const d = new Date(this.pickerDate());
    d.setMonth(d.getMonth() - 1);
    this.pickerDate.set(d);
  }

  nextPickerMonth() {
    const d = new Date(this.pickerDate());
    d.setMonth(d.getMonth() + 1);
    this.pickerDate.set(d);
  }

  prevPickerYear() {
    const d = new Date(this.pickerDate());
    d.setFullYear(d.getFullYear() - 1);
    this.pickerDate.set(d);
  }

  nextPickerYear() {
    const d = new Date(this.pickerDate());
    d.setFullYear(d.getFullYear() + 1);
    this.pickerDate.set(d);
  }

  /** Returns a 6-row × 7-col grid (42 cells) for the picker */
  get pickerCells(): (Date | null)[] {
    const d = this.pickerDate();
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
    const startDay = firstDay.getDay(); // 0=Sun
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];

    // Leading empty cells
    for (let i = 0; i < startDay; i++) cells.push(null);

    for (let day = 1; day <= daysInMonth; day++) {
      cells.push(new Date(d.getFullYear(), d.getMonth(), day));
    }

    // Trailing empties to fill 42
    while (cells.length < 42) cells.push(null);
    return cells;
  }

  isPickerToday(date: Date | null): boolean {
    if (!date) return false;
    return this.isToday(date);
  }

  isPickerSelected(date: Date | null): boolean {
    if (!date) return false;
    const c = this.currentDate();
    return date.getDate()     === c.getDate()  &&
           date.getMonth()    === c.getMonth() &&
           date.getFullYear() === c.getFullYear();
  }

  selectPickerDate(date: Date | null, event: MouseEvent) {
    event.stopPropagation();
    if (!date) return;
    this.currentDate.set(new Date(date));
    this.showCalendarPicker.set(false);
  }

  // ── Meeting positioning ─────────────────────────────────────

  getMeetingsForDay(day: Date): ScheduledMeeting[] {
    return this.scheduledMeetings().filter(m => {
      const md = new Date(m.startTime);
      return md.getDate()     === day.getDate()  &&
             md.getMonth()    === day.getMonth() &&
             md.getFullYear() === day.getFullYear();
    });
  }

  getMeetingTop(m: ScheduledMeeting): number {
    const d = new Date(m.startTime);
    return (d.getHours() + d.getMinutes() / 60) * this.HOUR_PX;
  }

  getMeetingHeight(m: ScheduledMeeting): number {
    if (!m.endTime) return this.HOUR_PX;
    const mins = (new Date(m.endTime).getTime() - new Date(m.startTime).getTime()) / 60000;
    return Math.max(24, (mins / 60) * this.HOUR_PX);
  }

  formatMeetingTime(m: ScheduledMeeting): string {
    const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const s = fmt(new Date(m.startTime));
    if (!m.endTime) return s;
    return `${s} - ${fmt(new Date(m.endTime))}`;
  }

  /** Detail panel: full date string */
  formatMeetingDetailTime(m: ScheduledMeeting): string {
    const start = new Date(m.startTime);
    const dateStr = start.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    return `${dateStr}, ${this.formatMeetingTime(m)}`;
  }

  get currentTimeTop(): number {
    const now = this.currentTime();
    return (now.getHours() + now.getMinutes() / 60) * this.HOUR_PX;
  }

  // ── Meeting detail ──────────────────────────────────────────

  openMeetingDetail(meeting: ScheduledMeeting, event: MouseEvent) {
    event.stopPropagation();
    this.selectedMeeting.set(meeting);
  }

  closeMeetingDetail() {
    this.selectedMeeting.set(null);
  }

  startMeeting(meeting: ScheduledMeeting) {
    this.closeMeetingDetail();
    this.router.navigate(['/waiting-room'], { queryParams: { title: meeting.title } });
  }

  onMeetingCreated() {
    this.isScheduleModalOpen.set(false);
  }
}
