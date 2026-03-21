import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import Keycloak from 'keycloak-js';

/**
 * Auth Guard to protect routes that require authentication
 * Redirects to CUSTOM Angular login page if user is not authenticated
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const keycloak = inject(Keycloak);
  const router = inject(Router);

  // 1. Kiểm tra nếu đã có Token hợp lệ
  if (keycloak.authenticated) {
    return true;
  }

  // 2. Chặn quyền truy cập và điều hướng về UI Login của Angular
  // Tuyệt đối KHÔNG dùng keycloak.login() ở đây để giữ giao diện Glassmorphism
  router.navigate(['/login']);
  return false;
};

/**
 * Guest Guard to prevent authenticated users from accessing login page
 * Redirects to home page if user is already authenticated
 */
export const guestGuard: CanActivateFn = async () => {
  const keycloak = inject(Keycloak);
  const router = inject(Router);

  // Nếu đã login thành công, không cho phép quay lại trang đăng nhập
  if (keycloak.authenticated) {
    // Điều hướng về '/' vì HomeComponent của bạn nằm ở path này
    router.navigate(['/']); 
    return false;
  }

  return true;
};