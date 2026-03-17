import { Component, inject, signal, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MeetingStateService } from '../../services/meeting-state.service';

type Tool = 'pen' | 'eraser' | 'line' | 'rect' | 'circle';

const COLORS = ['#ffffff', '#60a5fa', '#34d399', '#f87171', '#fbbf24', '#a78bfa', '#fb7185', '#2dd4bf'];
const SIZES = [2, 4, 8, 14];

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

          <button class="wb-action-btn" (click)="clearCanvas()">
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
          (mousemove)="draw($event)"
          (mouseup)="stopDraw()"
          (mouseleave)="stopDraw()"
        ></canvas>
      </div>
    </div>
  `,
  styleUrls: ['./whiteboard.component.scss']
})
export class WhiteboardComponent implements AfterViewInit {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  ms = inject(MeetingStateService);

  activeTool = signal<Tool>('pen');
  activeColor = signal('#ffffff');
  activeSize = signal(3);
  colors = COLORS;
  sizes = SIZES;

  toolButtons = [
    {
      id: 'pen' as Tool, label: 'Pen',
      viewBox: '0 0 24 24',
      d: 'M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'
    },
    {
      id: 'eraser' as Tool, label: 'Eraser',
      viewBox: '0 0 24 24',
      d: 'M20 20H7L3 16l10-10 7 7-3 3.5M6.5 10.5l7 7'
    },
    {
      id: 'line' as Tool, label: 'Line',
      viewBox: '0 0 24 24',
      d: 'M5 19L19 5'
    },
    {
      id: 'rect' as Tool, label: 'Rectangle',
      viewBox: '0 0 24 24',
      d: 'M3 3h18v18H3z'
    },
    {
      id: 'circle' as Tool, label: 'Circle',
      viewBox: '0 0 24 24',
      d: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z'
    }
  ];

  private isDrawing = false;
  private lastPos: { x: number; y: number } | null = null;
  private snapshot: ImageData | null = null;

  ngAfterViewInit() {
    const canvas = this.canvasRef.nativeElement;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1a1d22';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  private getPos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  startDraw(e: MouseEvent) {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    this.isDrawing = true;
    const pos = this.getPos(e);
    this.lastPos = pos;
    this.snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  draw(e: MouseEvent) {
    if (!this.isDrawing || !this.lastPos) return;
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    const pos = this.getPos(e);

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
      // Shape tools: restore snapshot each time
      ctx.putImageData(this.snapshot!, 0, 0);
      ctx.beginPath();
      if (tool === 'line') {
        ctx.moveTo(this.lastPos.x, this.lastPos.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else if (tool === 'rect') {
        ctx.strokeRect(
          this.lastPos.x, this.lastPos.y,
          pos.x - this.lastPos.x, pos.y - this.lastPos.y
        );
      } else if (tool === 'circle') {
        const rx = Math.abs(pos.x - this.lastPos.x) / 2;
        const ry = Math.abs(pos.y - this.lastPos.y) / 2;
        ctx.ellipse(
          this.lastPos.x + (pos.x - this.lastPos.x) / 2,
          this.lastPos.y + (pos.y - this.lastPos.y) / 2,
          rx, ry, 0, 0, 2 * Math.PI
        );
        ctx.stroke();
      }
    }
  }

  stopDraw() {
    this.isDrawing = false;
    this.lastPos = null;
    this.canvasRef?.nativeElement.getContext('2d')?.beginPath();
  }

  clearCanvas() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#1a1d22';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  downloadCanvas() {
    const canvas = this.canvasRef.nativeElement;
    const link = document.createElement('a');
    link.download = 'whiteboard.png';
    link.href = canvas.toDataURL();
    link.click();
  }
}
