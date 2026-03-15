import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'waiting-room',
    loadComponent: () => import('./features/waiting-room/waiting-room.component').then(m => m.WaitingRoomComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];