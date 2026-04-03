import {
  Component,
  inject,
  signal,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { MeetingStateService } from '../../services/meeting-state.service';
import { MediaStreamService, WhiteboardPayload } from '../../services/media-stream.service';

type Tool = 'pen' | 'eraser' | 'line' | 'rect' | 'circle';

const COLORS = ['#ffffff', '#60a5fa', '#34d399', '#f87171', '#fbbf24', '#a78bfa', '#fb7185', '#2dd4bf'];
const SIZES = [2, 4, 8, 14];

/** Minimum ms between sends while dragging (throttle) */
const SEND_INTERVAL_MS = 16; // ~60fps cap, but we batch points between sends

@Component({
  selector: 'app-whiteboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="whiteboard-overlay">
      <div class="whiteboard">

        <!-- Toolbar -->
        <div class="wb-header">
          <span class="wb-title-text">Whiteboard</span>

          <!-- Tool buttons -->
          <div class="wb-tool-group">
            <button
              *ngFor="let t of toolButtons"
              class="wb-tool-btn"
              [class.active]="activeTool() === t.id"
              (click)="activeTool.set(t.id)"
              [title]="t.label"
            >
              <svg [attr.viewBox]="t.viewBox" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15">
                <path [attr.d]="t.d"></path>
              </svg>
            </button>
          </div>

          <!-- Colors -->
          <div class="wb-colors">
            <button
              *ngFor="let c of colors"
              class="wb-color-btn"
              [class.selected]="activeColor() === c"
              [style.background-color]="c"
              (click)="activeColor.set(c)"
            ></button>
          </div>

          <!-- Sizes -->
          <div class="wb-sizes">
            <button
              *ngFor="let s of sizes"
              class="wb-size-btn"
              [class.selected]="activeSize() === s"
              [style.width.px]="s + 4"
              [style.height.px]="s + 4"
              (click)="activeSize.set(s)"
            ></button>
          </div>

          <div class="wb-spacer"></div>

          <!-- Sync indicator -->
          <div class="wb-sync-badge" *ngIf="syncStatus() !== 'idle'" [class.syncing]="syncStatus() === 'syncing'">
            <span *ngIf="syncStatus() === 'syncing'">● Syncing…</span>
            <span *ngIf="syncStatus() === 'received'">✓ Sync</span>
          </div>

          <button class="wb-action-btn" (click)="clearCanvas(true)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
            </svg>
            Clear
          </button>

          <button class="wb-action-btn wb-save-btn" (click)="downloadCanvas()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7,10 12,15 17,10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Save
          </button>

          <button class="wb-close-btn" (click)="ms.showWhiteboard.set(false)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Canvas -->
        <canvas
          #canvas
          class="wb-canvas"
          (mousedown)="startDraw($event)"
          (mousemove)="onMouseMove($event)"
          (mouseup)="stopDraw()"
          (mouseleave)="stopDraw()"
          (touchstart)="startDrawTouch($event)"
          (touchmove)="onTouchMove($event)"
          (touchend)="stopDraw()"
        ></canvas>
      </div>
    </div>
  `,
  styleUrls: ['./whiteboard.component.scss']
})
export class WhiteboardComponent implements AfterViewInit, OnInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  ms = inject(MeetingStateService);
  private media = inject(MediaStreamService);

  activeTool = signal<Tool>('pen');
  activeColor = signal('#ffffff');
  activeSize = signal(3);
  syncStatus = signal<'idle' | 'syncing' | 'received'>('idle');
  colors = COLORS;
  sizes = SIZES;

  toolButtons = [
    { id: 'pen' as Tool, label: 'Pen', viewBox: '0 0 24 24', d: 'M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' },
    { id: 'eraser' as Tool, label: 'Eraser', viewBox: '0 0 24 24', d: 'M20 20H7L3 16l10-10 7 7-3 3.5M6.5 10.5l7 7' },
    { id: 'line' as Tool, label: 'Line', viewBox: '0 0 24 24', d: 'M5 19L19 5' },
    { id: 'rect' as Tool, label: 'Rectangle', viewBox: '0 0 24 24', d: 'M3 3h18v18H3z' },
    { id: 'circle' as Tool, label: 'Circle', viewBox: '0 0 24 24', d: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z' },
  ];

  private isDrawing = false;
  private lastPos: { x: number; y: number } | null = null;
  private snapshot: ImageData | null = null;

  // DataChannel batching: collect points between throttle sends
  private pendingPoints: { x: number; y: number }[] = [];
  private lastSendTime = 0;
  private subs = new Subscription();
  private syncStatusTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    // Listen to remote whiteboard draw events
    this.subs.add(
      this.ms.whiteboardDraw$.subscribe(payload => {
        this._drawRemote(payload);
        this._flashSyncStatus('received');
      })
    );

    // Listen to remote clear events
    this.subs.add(
      this.ms.whiteboardClear$.subscribe(() => {
        this._fillBackground();
        this._flashSyncStatus('received');
      })
    );
  }

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    this._fillBackground();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.syncStatusTimer) clearTimeout(this.syncStatusTimer);
  }

  // ─── Local drawing ────────────────────────────────────────────────────────

  private getPos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private getTouchPos(touch: Touch): { x: number; y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }

  startDraw(e: MouseEvent): void {
    e.preventDefault();
    this._beginStroke(this.getPos(e));
  }

  startDrawTouch(e: TouchEvent): void {
    e.preventDefault();
    if (e.touches.length > 0) this._beginStroke(this.getTouchPos(e.touches[0]));
  }

  private _beginStroke(pos: { x: number; y: number }): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    this.isDrawing = true;
    this.lastPos = pos;
    this.pendingPoints = [pos];
    this.snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  onMouseMove(e: MouseEvent): void {
    if (!this.isDrawing) return;
    const pos = this.getPos(e);
    this._applyStroke(pos);
    this._throttledSend(pos);
  }

  onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (!this.isDrawing || e.touches.length === 0) return;
    const pos = this.getTouchPos(e.touches[0]);
    this._applyStroke(pos);
    this._throttledSend(pos);
  }

  private _applyStroke(pos: { x: number; y: number }): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const tool = this.activeTool();

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = this.activeSize() * 4;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = this.activeColor();
      ctx.lineWidth = this.activeSize();
    }

    if (tool === 'pen' || tool === 'eraser') {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      this.lastPos = pos;
    } else {
      ctx.putImageData(this.snapshot!, 0, 0);
      ctx.beginPath();
      if (tool === 'line') {
        ctx.moveTo(this.lastPos!.x, this.lastPos!.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else if (tool === 'rect') {
        ctx.strokeRect(this.lastPos!.x, this.lastPos!.y, pos.x - this.lastPos!.x, pos.y - this.lastPos!.y);
      } else if (tool === 'circle') {
        const rx = Math.abs(pos.x - this.lastPos!.x) / 2;
        const ry = Math.abs(pos.y - this.lastPos!.y) / 2;
        ctx.ellipse(
          this.lastPos!.x + (pos.x - this.lastPos!.x) / 2,
          this.lastPos!.y + (pos.y - this.lastPos!.y) / 2,
          rx, ry, 0, 0, 2 * Math.PI
        );
        ctx.stroke();
      }
    }
  }

  /**
   * Throttle: batch points and send at most every SEND_INTERVAL_MS.
   * This prevents flooding the DataChannel during fast mouse moves.
   */
  private _throttledSend(pos: { x: number; y: number }): void {
    this.pendingPoints.push(pos);
    const now = Date.now();
    if (now - this.lastSendTime < SEND_INTERVAL_MS) return;
    this.lastSendTime = now;
    this._flushPendingPoints();
  }

  private _flushPendingPoints(): void {
    if (this.pendingPoints.length === 0) return;
    const payload: WhiteboardPayload = {
      type: 'WHITEBOARD_DRAW',
      tool: this.activeTool(),
      color: this.activeColor(),
      size: this.activeSize(),
      points: [...this.pendingPoints],
    };
    this.media.sendWhiteboardDraw(payload);
    this.pendingPoints = [];
    this._flashSyncStatus('syncing');
  }

  stopDraw(): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    // Flush any remaining buffered points
    this._flushPendingPoints();
    this.lastPos = null;
    this.snapshot = null;
    this.pendingPoints = [];
    this.canvasRef?.nativeElement.getContext('2d')?.beginPath();
  }

  clearCanvas(broadcast = false): void {
    this._fillBackground();
    if (broadcast) {
      this.media.sendWhiteboardClear();
    }
  }

  downloadCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const link = document.createElement('a');
    link.download = 'whiteboard.png';
    link.href = canvas.toDataURL();
    link.click();
  }

  // ─── Remote drawing ───────────────────────────────────────────────────────

  private _drawRemote(p: WhiteboardPayload): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    if (!p.points || p.points.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (p.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = p.size * 4;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
    }

    ctx.beginPath();
    ctx.moveTo(p.points[0].x, p.points[0].y);
    for (let i = 1; i < p.points.length; i++) {
      ctx.lineTo(p.points[i].x, p.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  private _fillBackground(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#1a1d22';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  private _flashSyncStatus(status: 'syncing' | 'received'): void {
    this.syncStatus.set(status);
    if (this.syncStatusTimer) clearTimeout(this.syncStatusTimer);
    this.syncStatusTimer = setTimeout(() => this.syncStatus.set('idle'), 1500);
  }
}
