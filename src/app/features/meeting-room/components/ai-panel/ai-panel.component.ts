import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiProcessorService } from '../../services/ai-processor.service';
import { MeetingStateService } from '../../services/meeting-state.service';
import { AITab } from '../../models/meeting.model';

const AI_TABS: { id: AITab; icon: string; label: string }[] = [
  { id: 'summary', icon: 'description', label: 'Summary' },
  { id: 'actions', icon: 'checklist', label: 'Actions' },
  { id: 'transcript', icon: 'mic', label: 'Transcript' },
  { id: 'ask', icon: 'smart_toy', label: 'Ask AI' },
];

const SUGGESTIONS = ['Summarize discussion', 'List action items', "What's the sprint plan?"];

@Component({
  selector: 'app-ai-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="aip-panel">
      <!-- Header -->
      <div class="aip-header">
        <div class="aip-header-left">
          <div class="aip-icon-bg">
            <div class="aip-icon-grad">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" class="text-white" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
              </svg>
            </div>
            <span class="aip-live-dot-top"></span>
          </div>
          <div>
            <p class="aip-title">AI Companion</p>
            <p class="aip-sub">Powered by Zoom AI · Live</p>
          </div>
        </div>
        <button class="aip-close-btn" (click)="ms.showAIPanel.set(false)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Tabs -->
      <div class="aip-tabs">
        <button class="aip-tab" [class.active]="activeTab() === 'summary'" (click)="activeTab.set('summary')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
          Summary
        </button>
        <button class="aip-tab" [class.active]="activeTab() === 'actions'" (click)="activeTab.set('actions')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 6h9"/><path d="M11 12h9"/><path d="M11 18h9"/><path d="m3 6 2 2 4-4"/><path d="m3 12 2 2 4-4"/><path d="m3 18 2 2 4-4"/></svg>
          Actions
        </button>
        <button class="aip-tab" [class.active]="activeTab() === 'transcript'" (click)="activeTab.set('transcript')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
          Transcript
        </button>
        <button class="aip-tab" [class.active]="activeTab() === 'ask'" (click)="activeTab.set('ask')">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
          Ask AI
        </button>
      </div>

      <!-- Content Area -->
      <div class="aip-content-wrap">
        
        <!-- SUMMARY TAB -->
        <div class="aip-view aip-flex-col" *ngIf="activeTab() === 'summary'">
          <div class="aip-scrollable aip-p-4">
            <div class="aip-flex-between aip-mb-3">
              <div class="aip-live-badge">
                <span class="aip-live-dot-pulse"></span>
                Generating live summary
              </div>
              <button class="aip-copy-btn" (click)="copySummary()">
                <svg *ngIf="!copied()" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                <svg *ngIf="copied()" viewBox="0 0 24 24" width="11" height="11" class="text-green-400" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {{ copied() ? 'Copied' : 'Copy' }}
              </button>
            </div>
            
            <div class="aip-summary-body">
              <div *ngFor="let block of summaryBlocks()" class="aip-summary-block">
                <h4 *ngIf="block.type === 'h4'" class="aip-sum-h4">{{ block.text }}</h4>
                <div *ngIf="block.type === 'lines'" class="aip-sum-lines">
                  <ng-container *ngFor="let line of block.lines">
                    <p *ngIf="line.type === 'bold-split'" class="aip-sum-p">
                      <span class="aip-sum-bold">{{ line.boldPart }}:</span>{{ line.textPart }}
                    </p>
                    <div *ngIf="line.type === 'bullet'" class="aip-sum-bullet-row">
                      <span class="aip-sum-bullet">•</span>
                      <p class="aip-sum-p-dim">{{ line.textPart }}</p>
                    </div>
                    <p *ngIf="line.type === 'normal'" class="aip-sum-p-dim">{{ line.textPart }}</p>
                  </ng-container>
                </div>
              </div>
            </div>

            <div class="aip-box-info">
              <p class="aip-box-title">Participants Active</p>
              <div class="aip-participants-chips">
                <span *ngFor="let p of ms.participants()" class="aip-chip">{{ p.name }}</span>
              </div>
            </div>
          </div>
          <div class="aip-footer">
            <button class="aip-regen-btn">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Regenerate summary
            </button>
          </div>
        </div>

        <!-- ACTIONS TAB -->
        <div class="aip-view aip-flex-col" *ngIf="activeTab() === 'actions'">
          <div class="aip-scrollable aip-p-3 space-y-1-5">
            <div class="aip-flex-between aip-mb-2 px-1">
              <p class="aip-action-counts">{{ pendingCount }} pending · {{ doneCount }} done</p>
              <button class="aip-send-all">Send to all</button>
            </div>
            <button *ngFor="let action of ai.actions()" 
              class="aip-action-item" 
              [class.done]="action.done"
              (click)="ai.toggleAction(action.id)">
              <div class="aip-action-chk" [class.done]="action.done">
                <svg *ngIf="action.done" viewBox="0 0 24 24" width="9" height="9" fill="none" class="text-white" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div class="aip-action-content">
                <p class="aip-action-text" [class.done]="action.done">{{ action.text }}</p>
                <div class="aip-action-meta">
                  <span class="aip-action-owner">{{ action.owner }}</span>
                  <span class="aip-action-pri" [ngClass]="['pri-' + action.priority]">{{ action.priority }}</span>
                </div>
              </div>
            </button>
          </div>
          <div class="aip-footer">
            <button class="aip-gen-more">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
              Generate more with AI
            </button>
          </div>
        </div>

        <!-- TRANSCRIPT TAB -->
        <div class="aip-view aip-flex-col" *ngIf="activeTab() === 'transcript'">
          <div class="aip-trans-hdr">
            <button class="aip-live-toggle" [class.on]="ai.transcriptOn()" (click)="ai.transcriptOn.update(v => !v)">
              <span class="aip-live-toggle-dot" [class.on]="ai.transcriptOn()"></span>
              {{ ai.transcriptOn() ? 'Live' : 'Paused' }}
            </button>
            <button class="aip-export-btn">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              Export
            </button>
          </div>
          <div class="aip-scrollable aip-p-3 space-y-3">
            <div *ngFor="let entry of ai.transcript" class="aip-trans-row">
              <span class="aip-trans-time">{{ entry.time }}</span>
              <div>
                <p class="aip-trans-speaker">{{ entry.speaker }}</p>
                <p class="aip-trans-text">{{ entry.text }}</p>
              </div>
            </div>
            <div *ngIf="ai.transcriptOn()" class="aip-trans-live-row">
              <span class="aip-trans-time">Live</span>
              <div class="aip-trans-typing">
                <div class="aip-typing-dot d1"></div>
                <div class="aip-typing-dot d2"></div>
                <div class="aip-typing-dot d3"></div>
                <span class="aip-trans-label">Transcribing...</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ASK AI TAB -->
        <div class="aip-view aip-flex-col" *ngIf="activeTab() === 'ask'">
          <div class="aip-scrollable aip-p-3 space-y-3" #scrollAskRef>
            <div *ngFor="let msg of ai.askMessages()" class="aip-ask-row" [class.user]="msg.role === 'user'">
              <div *ngIf="msg.role === 'ai'" class="aip-ask-ai-avatar">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" class="text-white" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
              </div>
              <div class="aip-ask-bubble" [class.user]="msg.role === 'user'">
                <div *ngIf="msg.loading" class="aip-b-loading">
                  <div class="aip-l-dot d1"></div><div class="aip-l-dot d2"></div><div class="aip-l-dot d3"></div>
                </div>
                <div *ngIf="!msg.loading" [innerHTML]="formatAskText(msg.text)"></div>
              </div>
            </div>
            <div id="ask-bottom"></div>
          </div>
          
          <div class="aip-ask-suggestions">
            <button *ngFor="let s of suggestions" class="aip-sugg-chip" (click)="askInput = s">{{ s }}</button>
          </div>

          <div class="aip-footer">
            <div class="aip-ask-input-wrap">
              <input class="aip-ask-input" [(ngModel)]="askInput" placeholder="Ask about this meeting..." (keydown.enter)="sendAsk()" />
              <button class="aip-ask-send" [disabled]="!askInput.trim()" (click)="sendAsk()">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  `,
  styleUrls: ['./ai-panel.component.scss']
})
export class AiPanelComponent {
  ms = inject(MeetingStateService);
  ai = inject(AiProcessorService);
  aiTabs = AI_TABS;
  suggestions = SUGGESTIONS;
  activeTab = signal<AITab>('summary');
  copied = signal(false);
  askInput = '';

  get pendingCount() { return this.ai.actions().filter(a => !a.done).length; }
  get doneCount() { return this.ai.actions().filter(a => a.done).length; }

  summaryBlocks() {
    const blocks: any[] = [];
    const sourceBlocks = this.ai.summary.split('\n\n');
    for (const block of sourceBlocks) {
      if (block.startsWith('**') && block.endsWith('**')) {
        blocks.push({ type: 'h4', text: block.replace(/\*\*/g, '') });
      } else {
        const lines: any[] = [];
        for (const line of block.split('\n')) {
          if (line.startsWith('**') && line.includes(':**')) {
            const parts = line.split(':**');
            lines.push({ type: 'bold-split', boldPart: parts[0].replace(/\*\*/g, ''), textPart: parts[1] });
          } else if (line.startsWith('- ')) {
            lines.push({ type: 'bullet', textPart: line.slice(2) });
          } else if (line.trim()) {
            lines.push({ type: 'normal', textPart: line });
          }
        }
        blocks.push({ type: 'lines', lines });
      }
    }
    return blocks;
  }

  formatAskText(text: string): string {
    return text.split('**').map((part, i) =>
      i % 2 === 1 ? `<strong class="text-white">${part}</strong>` : part
    ).join('');
  }

  copySummary() {
    navigator.clipboard.writeText(this.ai.summary.replace(/\*\*/g, '')).catch(() => {});
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  sendAsk() {
    if (!this.askInput.trim()) return;
    this.ai.sendAskMessage(this.askInput.trim());
    this.askInput = '';
    setTimeout(() => {
      const el = document.getElementById('ask-bottom');
      el?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }
}
