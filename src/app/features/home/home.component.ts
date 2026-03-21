import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  constructor(public router: Router) {}
  authService = inject(AuthService);
  userSignal = this.authService.getUserSignal();

  get user() {
    return this.userSignal();
  }

  showUserMenu = signal(false);
  sidebarOpen = signal(false);

  toggleUserMenu() {
    this.showUserMenu.update(v => !v);
  }

  onLogout() {
    this.authService.logout();
  }

  toggleSidebar() {
    this.sidebarOpen.update(v => !v);
  }

  closeSidebar() {
    this.sidebarOpen.set(false);
  }

  navItems = [
    { icon: 'home', label: 'Home', route: '/', active: true },
    { icon: 'video_camera_front', label: 'Meetings', route: null, active: false },
    { icon: 'record_voice_over', label: 'Recordings', route: '/recordings', active: false },
    { icon: 'contacts', label: 'Contacts', route: null, active: false },
  ];

  actionButtons = [
    { icon: 'video_call', label: 'New Meeting', color: 'orange', route: 'waiting-room' },
    { icon: 'add_box', label: 'Join', color: 'primary', route: 'waiting-room' },
    { icon: 'calendar_month', label: 'Schedule', color: 'primary', route: null },
    { icon: 'present_to_all', label: 'Share Screen', color: 'primary', route: null },
  ];

  handleAction(btn: any) {
    if (btn.route) {
      this.router.navigate([`/${btn.route}`], {
        queryParams: { title: 'Weekly Sync: Product & Design' }
      });
    }
  }

  quickActions = [
    { icon: 'description', label: 'Review Transcript', sub: 'Design Sync - Yesterday', bg: 'green' },
    { icon: 'group_add', label: 'Invite Team', sub: 'Invite new members to workspace', bg: 'purple' },
  ];

  meetings = [
    {
      month: 'Oct',
      day: '24',
      title: 'Product Strategy Sync',
      time: '10:00 AM - 11:00 AM',
      active: true,
      action: 'Start',
      avatars: [
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDk6LGZfQUpzZ9Anb489kuqg-6gUQYzOtH8_zEzMS2HEaVa39Toy9cnUpKwJzOclXrLjfYkcNWxEpGKnJWCnXKXCJUYoDiE9ET4d9XEfgzg8sekBleDW0UVP09rpi-ofe1jwY-rfhasmp2SpSeoE70IJvnNYUXZES6kLNSTxJtQmpEUVuPrL5N_U2tLah309ysDipZG2GiFoquL4VJF5AxE0IQohkm0o8c8IM1-rXNgNZ4z-WPhAvmQUa5cMywytd0isxu7j3kjuvM',
        'https://lh3.googleusercontent.com/aida-public/AB6AXuCXhy8omsnfqJma8lCAfmGG6JbbXiqMfgMw5a8bi7JTUdsLMwUqHcBpV40Y2KwtbZ2QXkk5pMbelyxaJoGrjJxAXYpzml3pU3mrriamPsFQucu6LZNHXKfrC_vrj6cdUz1bgMGRbr8R2V6jVVJ7IOLD4XqdPks1ie3OtxR39CMdj6W30BWvYVwtcv5MNIx1cZl8hIv5L92UHp01jvnLCs2UojV3eaupMrkuu31H_wiNES7J1MfTunTvPX7JTBKV2KTqtb43gnnN7a8'
      ],
      extra: '+4'
    },
    {
      month: 'Oct',
      day: '24',
      title: 'Weekly Design Review',
      time: '01:30 PM - 02:30 PM',
      active: false,
      action: 'Join',
      avatars: [
        'https://lh3.googleusercontent.com/aida-public/AB6AXuDYYbNUICIfsFRmkSK3n3JRCz9_UmiIh9TQdHRn4rgCen7vdG9dYFN-iK2ZU_FS6jbzDSqy1qTRZHgCcvpZs9evoSl_6aImXmZzBT4L_VTDSUlsSZfkXP5aKdzDjTZb1GXoWpi47NEd7SlSxDxzqOf_VgoRvDZNoohDT7HKjhCrI2FqFr5t7w0ldfEYE-YH8IZN8Hs8jgg6YBX4HtFSEBYEXWKX96soss4cwfvKQN46EDkwpUCpfTwvUorGQvwNMnICWEYu4ClBKnE'
      ],
      extra: '+2'
    },
    {
      month: 'Oct',
      day: '25',
      title: 'Marketing Workshop',
      time: '11:00 AM - 12:30 PM',
      active: false,
      action: null,
      avatars: [],
      extra: null
    }
  ];
}
