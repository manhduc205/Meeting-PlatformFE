import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUser = signal<User | null>(null);
  private isAuthenticated = signal<boolean>(false);

  constructor(private router: Router) {
    // Check if user is already logged in (from localStorage)
    this.checkAuthStatus();
  }

  /**
   * Check authentication status from localStorage
   */
  private checkAuthStatus() {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.currentUser.set(user);
        this.isAuthenticated.set(true);
      } catch (e) {
        console.error('Error parsing user data:', e);
        this.logout();
      }
    }
  }

  /**
   * Simulate Google OAuth login
   * TODO: Replace with actual Google OAuth implementation
   */
  async loginWithGoogle(): Promise<void> {
    return new Promise((resolve) => {
      // Simulate API call delay
      setTimeout(() => {
        // Mock user data - replace with actual Google OAuth response
        const mockUser: User = {
          id: '123456',
          email: 'user@example.com',
          name: 'User Name',
          picture: 'https://ui-avatars.com/api/?name=User+Name&background=2d6ef7&color=fff'
        };

        this.setUser(mockUser);
        resolve();
      }, 1500);
    });
  }

  /**
   * Set current user and save to localStorage
   */
  private setUser(user: User) {
    this.currentUser.set(user);
    this.isAuthenticated.set(true);
    localStorage.setItem('currentUser', JSON.stringify(user));
  }

  /**
   * Logout user and clear data
   */
  logout() {
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    localStorage.removeItem('currentUser');
    this.router.navigate(['/login']);
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser();
  }

  /**
   * Check if user is authenticated
   */
  isLoggedIn(): boolean {
    return this.isAuthenticated();
  }

  /**
   * Get user signal (reactive)
   */
  getUserSignal() {
    return this.currentUser.asReadonly();
  }

  /**
   * Get authentication status signal (reactive)
   */
  getAuthStatusSignal() {
    return this.isAuthenticated.asReadonly();
  }
}
