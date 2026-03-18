import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

interface Star {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  opacity: number;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements AfterViewInit, OnDestroy {
  @ViewChild('bgCanvas', { static: false }) bgCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('leftCanvas', { static: false }) leftCanvasRef!: ElementRef<HTMLCanvasElement>;

  loading = signal(false);
  imageError = signal(false);
  private animationFrameId: number | null = null;
  private leftAnimationFrameId: number | null = null;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngAfterViewInit() {
    // Initialize background constellation
    if (this.bgCanvasRef) {
      this.initConstellation(this.bgCanvasRef.nativeElement, 'light');
    }

    // Initialize left panel constellation
    if (this.leftCanvasRef) {
      this.initConstellation(this.leftCanvasRef.nativeElement, 'blue');
    }
  }

  ngOnDestroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.leftAnimationFrameId) {
      cancelAnimationFrame(this.leftAnimationFrameId);
    }
  }

  private initConstellation(canvas: HTMLCanvasElement, tint: 'light' | 'blue') {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const NUM_STARS = tint === 'blue' ? 55 : 90;
    const MAX_DIST = tint === 'blue' ? 110 : 130;
    let stars: Star[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    const initStars = () => {
      stars = Array.from({ length: NUM_STARS }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.6 + 0.5,
        opacity: Math.random() * 0.55 + 0.3,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update star positions
      for (const s of stars) {
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < 0 || s.x > canvas.width) s.vx *= -1;
        if (s.y < 0 || s.y > canvas.height) s.vy *= -1;
      }

      // Draw connecting lines
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[i].x - stars[j].x;
          const dy = stars[i].y - stars[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            const alpha = tint === 'blue'
              ? (1 - dist / MAX_DIST) * 0.35
              : (1 - dist / MAX_DIST) * 0.18;
            ctx.beginPath();
            ctx.moveTo(stars[i].x, stars[i].y);
            ctx.lineTo(stars[j].x, stars[j].y);
            ctx.strokeStyle = tint === 'blue'
              ? `rgba(180, 210, 255, ${alpha})`
              : `rgba(100, 120, 200, ${alpha})`;
            ctx.lineWidth = 0.65;
            ctx.stroke();
          }
        }
      }

      // Draw stars
      for (const s of stars) {
        const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3.5);
        if (tint === 'blue') {
          grd.addColorStop(0, `rgba(200, 225, 255, ${s.opacity * 0.7})`);
          grd.addColorStop(1, 'rgba(150,200,255,0)');
        } else {
          grd.addColorStop(0, `rgba(110, 130, 210, ${s.opacity * 0.55})`);
          grd.addColorStop(1, 'rgba(110,130,210,0)');
        }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = tint === 'blue'
          ? `rgba(210, 230, 255, ${s.opacity})`
          : `rgba(90, 115, 200, ${s.opacity})`;
        ctx.fill();
      }

      if (tint === 'blue') {
        this.leftAnimationFrameId = requestAnimationFrame(draw);
      } else {
        this.animationFrameId = requestAnimationFrame(draw);
      }
    };

    resize();
    initStars();
    draw();

    const onResize = () => {
      resize();
      initStars();
    };
    window.addEventListener('resize', onResize);
  }

  async handleLogin() {
    this.loading.set(true);

    try {
      // Call AuthService to handle Google OAuth
      await this.authService.loginWithGoogle();

      // Navigate to home after successful login
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Login error:', error);
      this.loading.set(false);
    }
  }

  handleSignUp() {
    // Handle sign up navigation
    console.log('Navigate to sign up');
  }

  onImageError() {
    console.log('Image failed to load, showing placeholder');
    this.imageError.set(true);
  }
}
