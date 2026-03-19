import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';

/**
 * Auth Guard to protect routes that require authentication
 * Redirects to Keycloak login page if user is not authenticated
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const keycloak = inject(KeycloakService);

  // Check if user is logged in
  if (keycloak.isLoggedIn()) {
    return true;
  }

  // Nếu chưa đăng nhập, đá sang màn hình Login của Keycloak
  await keycloak.login({
    redirectUri: window.location.origin + state.url
  });
  return false;
};

/**
 * Guest Guard to prevent authenticated users from accessing login page
 * Redirects to home page if user is already authenticated
 */
export const guestGuard: CanActivateFn = async () => {
  const keycloak = inject(KeycloakService);
  const router = inject(Router);

  // Check if user is already logged in
  if (keycloak.isLoggedIn()) {
    // Redirect to home if already logged in
    router.navigate(['/home']);
    return false;
  }

  return true;
};
