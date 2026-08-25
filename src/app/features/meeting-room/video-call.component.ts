import { Component, OnInit, OnDestroy, OnChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { MeetingStateService } from './services/meeting-state.service';
import { MeetingActionService } from './services/meeting-action.service';
import { TopBarComponent } from './components/top-bar/top-bar.component';
import { VideoGridComponent } from './components/video-grid/video-grid.component';
import { ControlBarComponent } from './components/control-bar/control-bar.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { AiPanelComponent } from './components/ai-panel/ai-panel.component';
import { WhiteboardComponent } from './components/whiteboard/whiteboard.component';
import { HostToolsPanelComponent } from './components/host-tools-panel/host-tools-panel.component';
import { RaisedHandsPanelComponent } from './components/raised-hands-panel/raised-hands-panel.component';
import { KnockNotificationsComponent } from './components/knock-notifications/knock-notifications.component';
import { LeaveModalComponent } from './components/leave-modal/leave-modal.component';
import { KickConfirmModalComponent } from './components/kick-confirm-modal/kick-confirm-modal.component';

@Component({
  selector: 'app-video-call',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TopBarComponent,
    VideoGridComponent,
    ControlBarComponent,
    SidebarComponent,
    AiPanelComponent,
    WhiteboardComponent,
    HostToolsPanelComponent,
    RaisedHandsPanelComponent,
    KnockNotificationsComponent,
    LeaveModalComponent,
    KickConfirmModalComponent,
  ],
  templateUrl: './video-call.component.html',
  styleUrls: ['./video-call.component.scss']
})
export class VideoCallComponent implements OnInit, OnDestroy {
  ms = inject(MeetingStateService);
  meetingAction = inject(MeetingActionService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private subs = new Subscription();

  /** Bind to the centralized flying reactions signal */
  floatingReactions = this.meetingAction.flyingReactions;

  async ngOnInit() {
    const code = this.route.snapshot.queryParamMap.get('meetingId') ?? '';
    const title = this.route.snapshot.queryParamMap.get('title') ?? 'Meeting';

    if (!code) {
      this.router.navigate(['/']);
      return;
    }

    await this.ms.joinMeeting(code, title);
  }

  async ngOnDestroy() {
    this.subs.unsubscribe();
    if (!this.ms.hasLeft()) {
      await this.ms.cleanupMedia();
    }
  }

  navigateHome() {
    this.router.navigate(['/']);
  }
}
