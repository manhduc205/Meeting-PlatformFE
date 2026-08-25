import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ScheduleModalComponent } from '../schedule-modal/schedule-modal.component';
import { JoinMeetingModalComponent } from '../join-meeting-modal/join-meeting-modal.component';
import { MeetingService } from '../../../core/services/meeting.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ScheduleModalComponent, JoinMeetingModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private meetingService = inject(MeetingService);
  constructor(public router: Router) {}

  isScheduleModalOpen = false;
  isInstantMeetingModalOpen = false;
  isJoinModalOpen = false;
  actionButtons = [
    { icon: 'video_call', label: 'New Meeting', color: 'orange', route: null },
    { icon: 'add_box', label: 'Join', color: 'primary', route: null },
    { icon: 'calendar_month', label: 'View Schedule', color: 'primary', route: null },
    { icon: 'event_available', label: 'Schedule Meeting', color: 'primary', route: null },
  ];
  handleAction(btn: any) {
    if (btn.label === 'New Meeting') {
      this.isInstantMeetingModalOpen = true;
      return;
    }
    if (btn.label === 'View Schedule') {
      this.router.navigate(['/scheduler']);
      return;
    }
    if (btn.label === 'Schedule Meeting') {
      this.isScheduleModalOpen = true;
      return;
    }
    if (btn.label === 'Join') {
      this.isJoinModalOpen = true;
      return;
    }
    if (btn.route) {
      this.router.navigate([`/${btn.route}`], {
        queryParams: { title: 'Weekly Sync: Product & Design' }
      });
    }
  }

  navigateToScheduler() {
    this.router.navigate(['/scheduler']);
  }

  quickActions = [
    { icon: 'description', label: 'Review Transcript', sub: 'Design Sync - Yesterday', bg: 'green' },
    { icon: 'group_add', label: 'Invite Team', sub: 'Invite new members to workspace', bg: 'purple' },
  ];

  meetings: any[] = [];

  ngOnInit() {
    this.meetingService.getUpcoming(3).subscribe({
      next: meetings => this.meetings = meetings.map(meeting => {
        const start = new Date(meeting.plannedStartTime);
        const end = new Date(meeting.plannedEndTime);
        const isHost = meeting.isHost === true || meeting.role === 'HOST';
        return {
          month: start.toLocaleString('en-US', { month: 'short' }),
          day: start.getDate(),
          title: meeting.title,
          time: `${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
          // A host always owns the Start action.  This includes instant meetings,
          // which are already IN_PROGRESS and therefore cannot be "started" again.
          active: isHost || meeting.canJoin,
          action: isHost ? 'Start' : meeting.canJoin ? 'Join' : null,
          meetingCode: meeting.meetingCode,
          status: meeting.status,
          isHost,
          avatars: [],
          extra: null
        };
      }),
      error: error => console.error('Unable to load upcoming meetings', error)
    });
  }

  onInstantMeetingCreated(meeting: { meetingCode: string; title: string }) {
    this.isInstantMeetingModalOpen = false;
    this.joinHostedMeeting(meeting);
  }

  openUpcoming(meeting: any) {
    if (meeting.isHost) {
      if (meeting.status === 'IN_PROGRESS') {
        this.joinHostedMeeting(meeting);
        return;
      }
      this.meetingService.startMeeting(meeting.meetingCode).subscribe({
        next: () => this.joinHostedMeeting(meeting),
        error: error => alert(error.error?.message || 'Unable to start meeting')
      });
      return;
    }
    if (meeting.status !== 'IN_PROGRESS') {
      alert('Cuộc họp chưa được Host bắt đầu. Vui lòng thử lại sau.');
      return;
    }
    this.router.navigate(['/waiting-room'], {
      queryParams: { meetingId: meeting.meetingCode, title: meeting.title, autoJoin: true }
    });
  }

  private joinHostedMeeting(meeting: { meetingCode: string; title: string }) {
    this.meetingService.joinMeeting({ meetingCode: meeting.meetingCode }).subscribe({
      next: response => {
        const destination = response.status === 'APPROVED' ? '/meeting-room' : '/waiting-room';
        this.router.navigate([destination], { queryParams: { meetingId: meeting.meetingCode, title: meeting.title } });
      },
      error: error => alert(error.error?.message || 'Unable to join meeting')
    });
  }
}
