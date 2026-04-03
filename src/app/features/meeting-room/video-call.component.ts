import { Component, OnInit, OnDestroy, OnChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { MeetingStateService, ReactionEvent } from './services/meeting-state.service';
import { TopBarComponent } from './components/top-bar/top-bar.component';
import { VideoGridComponent } from './components/video-grid/video-grid.component';
import { ControlBarComponent } from './components/control-bar/control-bar.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { AiPanelComponent } from './components/ai-panel/ai-panel.component';
import { WhiteboardComponent } from './components/whiteboard/whiteboard.component';
import { HostToolsPanelComponent } from './components/host-tools-panel/host-tools-panel.component';

/** A single floating reaction particle on screen */
interface FloatingReaction {
  id: number;
  emoji: string;
  senderName: string;
  /** Random horizontal offset so multiple reactions don't stack */
  xOffset: number;
}

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
  private route = inject(ActivatedRoute);
  private subs = new Subscription();

  /** Active floating reaction particles */
  floatingReactions = signal<FloatingReaction[]>([]);

  async ngOnInit() {
    const code = this.route.snapshot.queryParamMap.get('meetingId') ?? '';
    const title = this.route.snapshot.queryParamMap.get('title') ?? 'Meeting';

    if (!code) {
      this.router.navigate(['/']);
      return;
    }

    await this.ms.joinMeeting(code, title);

    // Subscribe to reaction DataChannel events → animate floating emoji
    this.subs.add(
      this.ms.reaction$.subscribe((ev: ReactionEvent) => {
        this._spawnReaction(ev);
      })
    );
  }

  private _spawnReaction(ev: ReactionEvent): void {
    const particle: FloatingReaction = {
      id: ev.id,
      emoji: ev.emoji,
      senderName: ev.senderName,
      // Random horizontal position between 10% and 85% of screen width
      xOffset: 10 + Math.random() * 75,
    };

    this.floatingReactions.update(list => [...list, particle]);

    // Remove after animation completes (2.5 s)
    setTimeout(() => {
      this.floatingReactions.update(list => list.filter(r => r.id !== particle.id));
    }, 2500);
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

