import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './features/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
    canActivate: [authGuard],
    children: [
      { path: '', loadComponent: () => import('./features/home/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'recordings', loadComponent: () => import('./features/home/recording-video/recordings.component').then(m => m.RecordingsComponent) },
      { path: 'recordings/:id', loadComponent: () => import('./features/home/recording-video/recording-detail.component').then(m => m.RecordingDetailComponent) }
    ]
  },
  {
    path: 'waiting-room',
    loadComponent: () => import('./features/waiting-room/waiting-room.component').then(m => m.WaitingRoomComponent),
    canActivate: [authGuard]
  },
  {
    path: 'meeting-room',
    loadComponent: () => import('./features/meeting-room/video-call.component').then(m => m.VideoCallComponent),
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];