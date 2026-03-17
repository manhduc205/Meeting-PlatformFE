import { Injectable } from '@angular/core';
import { ActionItem, AskMessage, TranscriptEntry } from '../models/meeting.model';
import { signal } from '@angular/core';

const MOCK_SUMMARY = `**Product Review Q3** is an ongoing meeting reviewing quarterly product milestones and planning the next sprint.

**Key topics discussed so far:**
- Q3 roadmap progress: 78% of planned features shipped
- Two critical bugs fixed in the payment flow
- Mobile redesign is 60% complete — on track for Q4
- Performance improvements reduced load time by 40%
- New Slack & Notion integrations are in final testing`;

const AI_RESPONSES: Record<string, string> = {
  default: "I'm analyzing the meeting in real-time. Based on the discussion so far, the team is reviewing Q3 results and planning Q4 priorities. Is there something specific you'd like to know?",
  summary: "The meeting has covered Q3 performance metrics (78% completion rate), mobile redesign progress, and upcoming integrations. The team seems aligned on priorities for next sprint.",
  action: "I've identified 5 action items so far. The highest priority ones are the product demo screen share and the mobile redesign review. Would you like me to send these to everyone after the meeting?",
  bug: "No specific bugs were mentioned in this meeting. The team noted that two critical payment flow bugs were fixed in Q3.",
  sprint: "Based on the discussion, next sprint will likely focus on: completing the mobile redesign, launching Slack & Notion integrations, and addressing performance improvements for the dashboard.",
};

@Injectable({ providedIn: 'root' })
export class AiProcessorService {
  summary = MOCK_SUMMARY;
  transcriptOn = signal(true);

  actions = signal<ActionItem[]>([
    { id: 'a1', text: 'Share screen for the product demo', owner: 'Nguyễn Đức', done: false, priority: 'high' },
    { id: 'a2', text: 'Schedule follow-up on Q3 roadmap review', owner: 'Alex Morgan', done: false, priority: 'medium' },
    { id: 'a3', text: 'Send meeting notes to all participants', owner: 'Sarah Johnson', done: true, priority: 'low' },
    { id: 'a4', text: 'Review mobile redesign mockups by EOD', owner: 'Emily Davis', done: false, priority: 'high' },
    { id: 'a5', text: 'Test Slack integration in staging environment', owner: 'Michael Chen', done: false, priority: 'medium' },
  ]);

  transcript: TranscriptEntry[] = [
    { time: '00:02:14', speaker: 'Nguyễn Đức', text: "Welcome everyone! Let's get started with the Q3 review." },
    { time: '00:03:41', speaker: 'Sarah Johnson', text: 'Can you share your screen for the demo?' },
    { time: '00:05:22', speaker: 'Nguyễn Đức', text: "I'll share my screen in a moment. First, let me finish the overview. We've completed 78% of our planned features." },
    { time: '00:07:08', speaker: 'Michael Chen', text: 'Great presentation so far. The performance numbers are really impressive.' },
    { time: '00:09:55', speaker: 'Emily Davis', text: 'When will we review the mobile redesign mockups?' },
    { time: '00:11:30', speaker: 'Nguyễn Đức', text: "We'll cover that in the second half. David, can you give us an update on the integrations?" },
    { time: '00:13:12', speaker: 'David Kim', text: 'The Slack integration is in final testing. Should be ready by end of week.' },
    { time: '00:15:44', speaker: 'Alex Morgan', text: 'Perfect timing. We have a client demo next Monday.' },
  ];

  askMessages = signal<AskMessage[]>([
    { id: 'init', role: 'ai', text: "Hi! I'm your AI Companion for **Product Review Q3**. I can summarize the meeting, track action items, generate transcripts, and answer your questions. What would you like to know?" }
  ]);

  toggleAction(id: string) {
    this.actions.update(prev => prev.map(a => a.id === id ? { ...a, done: !a.done } : a));
  }

  getAIResponse(input: string): string {
    const lower = input.toLowerCase();
    if (lower.includes('summar') || lower.includes('recap')) return AI_RESPONSES['summary'];
    if (lower.includes('action') || lower.includes('task') || lower.includes('todo')) return AI_RESPONSES['action'];
    if (lower.includes('bug') || lower.includes('issue') || lower.includes('fix')) return AI_RESPONSES['bug'];
    if (lower.includes('sprint') || lower.includes('next') || lower.includes('priorit')) return AI_RESPONSES['sprint'];
    return AI_RESPONSES['default'];
  }

  sendAskMessage(text: string) {
    const userMsg: AskMessage = { id: `u-${Date.now()}`, role: 'user', text };
    const loadingMsg: AskMessage = { id: `ai-${Date.now()}`, role: 'ai', text: '', loading: true };
    this.askMessages.update(prev => [...prev, userMsg, loadingMsg]);

    const response = this.getAIResponse(text);
    setTimeout(() => {
      this.askMessages.update(prev =>
        prev.map(m => m.loading ? { ...m, text: response, loading: false } : m)
      );
    }, 1200 + Math.random() * 600);
  }
}
