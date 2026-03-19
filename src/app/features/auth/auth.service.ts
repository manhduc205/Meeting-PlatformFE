import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';
import { KeycloakProfile } from 'keycloak-js';

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUser = signal<User | null>(null);
  private isAuthenticated = signal<boolean>(false);

  constructor(
    private router: Router,
    private keycloakService: KeycloakService
  ) {
    // Initialize user from Keycloak
    this.initializeUser();
  }

  /**
   * Initialize user data from Keycloak
   */
  private async initializeUser() {
    if (this.keycloakService.isLoggedIn()) {
      try {
        const profile = await this.keycloakService.loadUserProfile();
        const user = this.mapKeycloakProfileToUser(profile);
        this.currentUser.set(user);
        this.isAuthenticated.set(true);
      } catch (error) {
        console.error('Error loading user profile:', error);
        this.isAuthenticated.set(false);
      }
    }
  }

  /**
   * Map Keycloak profile to User interface
   */
  private mapKeycloakProfileToUser(profile: KeycloakProfile): User {
    return {
      id: profile.id || '',
      email: profile.email || '',
      name: `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.username || '',
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      // Keycloak doesn't provide picture by default, but you can add it via custom attributes
      picture: (profile as any).picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.firstName || '')}+${encodeURIComponent(profile.lastName || '')}&background=2d6ef7&color=fff`
    };
  }

  /**
   * Login with Keycloak (redirects to Keycloak login page)
   * Keycloak can be configured to use Google as Identity Provider
   */
  async login(redirectUri?: string): Promise<void> {
    await this.keycloakService.login({
      redirectUri: redirectUri || window.location.origin + '/home'
    });
  }

  /**
   * Logout from Keycloak
   */
  async logout(): Promise<void> {
    this.currentUser.set(null);
    this.isAuthenticated.set(false);

    await this.keycloakService.logout(window.location.origin + '/login');
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUser();
  }

  /**
   * Check if user is authenticated
   */
  isLoggedIn(): boolean {
    return this.keycloakService.isLoggedIn();
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

  /**
   * Get user roles from Keycloak
   */
  getUserRoles(): string[] {
    return this.keycloakService.getUserRoles();
  }

  /**
   * Check if user has a specific role
   */
  hasRole(role: string): boolean {
    return this.keycloakService.isUserInRole(role);
  }

  /**
   * Get Keycloak token
   */
  async getToken(): Promise<string> {
    return this.keycloakService.getToken();
  }

  /**
   * Refresh user profile data
   */
  async refreshUserProfile(): Promise<void> {
    if (this.keycloakService.isLoggedIn()) {
      try {
        const profile = await this.keycloakService.loadUserProfile();
        const user = this.mapKeycloakProfileToUser(profile);
        this.currentUser.set(user);
        this.isAuthenticated.set(true);
      } catch (error) {
        console.error('Error refreshing user profile:', error);
      }
    }
  }
}
