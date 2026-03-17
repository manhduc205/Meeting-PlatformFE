import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MeetingStateService } from './services/meeting-state.service';
import { TopBarComponent } from './components/top-bar/top-bar.component';
import { VideoGridComponent } from './components/video-grid/video-grid.component';
import { ControlBarComponent } from './components/control-bar/control-bar.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { AiPanelComponent } from './components/ai-panel/ai-panel.component';
import { WhiteboardComponent } from './components/whiteboard/whiteboard.component';
import { HostToolsPanelComponent } from './components/host-tools-panel/host-tools-panel.component';

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
  ],
  templateUrl: './video-call.component.html',
  styleUrls: ['./video-call.component.scss']
})
export class VideoCallComponent implements OnInit, OnDestroy {
  ms = inject(MeetingStateService);
  private router = inject(Router);

  ngOnInit() {
    this.ms.startSpeakerRotation();
  }

  ngOnDestroy() {
    this.ms.stopSpeakerRotation();
  }

  navigateHome() {
    this.router.navigate(['/']);
  }
}
