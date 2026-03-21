import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import Keycloak, { KeycloakProfile } from 'keycloak-js';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

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
    private keycloak: Keycloak,
    private http: HttpClient
  ) {
    // Initialize user from Keycloak
    this.initializeUser();
  }

  /**
   * Initialize user data from Keycloak
   */
  private async initializeUser() {
    if (this.keycloak.authenticated) {
      try {
        const profile = await this.keycloak.loadUserProfile();
        const user = this.mapKeycloakProfileToUser(profile, this.keycloak.tokenParsed);
        this.currentUser.set(user);
        this.isAuthenticated.set(true);
        
        // Sync user with backend
        this.http.get(`${environment.backendApiUrl}/sync`, { responseType: 'text' }).subscribe({
          next: (res) => console.log('User synchronization response:', res),
          error: (err) => console.error('Failed to synchronize user:', err)
        });
      } catch (error) {
        console.error('Error loading user profile:', error);
        this.isAuthenticated.set(false);
      }
    }
  }

  /**
   * Map Keycloak profile to User interface
   */
  private mapKeycloakProfileToUser(profile: KeycloakProfile, tokenParsed?: any): User {
    const fallbackName = profile.firstName ? (profile.firstName + ' ' + (profile.lastName || '')) : (profile.username || 'User');
    const pictureUrl = tokenParsed?.picture || (profile as any).picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=2d6ef7&color=fff`;

    return {
      id: profile.id || '',
      email: profile.email || tokenParsed?.email || '',
      name: fallbackName,
      username: profile.username || tokenParsed?.preferred_username,
      firstName: profile.firstName || tokenParsed?.given_name,
      lastName: profile.lastName || tokenParsed?.family_name,
      picture: pictureUrl
    };
  }

  /**
   * Login with Keycloak (redirects to Keycloak login page)
   * Keycloak can be configured to use Google as Identity Provider
   */
  async login(redirectUri?: string): Promise<void> {
    await this.keycloak.login({
      idpHint: 'google', // This will hint Keycloak to show Google login option directly
      redirectUri: redirectUri || window.location.origin + '/home'
    });
  }

  /**
   * Logout from Keycloak
   */
  async logout(): Promise<void> {
    this.currentUser.set(null);
    this.isAuthenticated.set(false);

    const redirectUri = window.location.origin + '/login';
    await this.keycloak.logout({ 
      redirectUri: redirectUri
    });
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
    return !!this.keycloak.authenticated;
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
    return this.keycloak.realmAccess?.roles || [];
  }

  /**
   * Check if user has a specific role
   */
  hasRole(role: string): boolean {
    return this.keycloak.hasRealmRole(role);
  }

  /**
   * Get Keycloak token
   */
  async getToken(): Promise<string> {
    return this.keycloak.token || '';
  }

  /**
   * Refresh user profile data
   */
  async refreshUserProfile(): Promise<void> {
    if (this.keycloak.authenticated) {
      try {
        const profile = await this.keycloak.loadUserProfile();
        const user = this.mapKeycloakProfileToUser(profile, this.keycloak.tokenParsed);
        this.currentUser.set(user);
        this.isAuthenticated.set(true);
      } catch (error) {
        console.error('Error refreshing user profile:', error);
      }
    }
  }
}
