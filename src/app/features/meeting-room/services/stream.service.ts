import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StreamService {
  // Placeholder for WebRTC stream management
  // In production: handle getUserMedia, peer connections, etc.

  async requestMediaPermissions(): Promise<{ video: boolean; audio: boolean }> {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      return { video: true, audio: true };
    } catch {
      return { video: false, audio: false };
    }
  }
}
