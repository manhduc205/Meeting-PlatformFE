import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideKeycloak,
  createInterceptorCondition,
  INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
  includeBearerTokenInterceptor
} from 'keycloak-angular';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),

    // 1. Kích hoạt HttpClient và nhét Interceptor của Keycloak vào
    provideHttpClient(withInterceptors([includeBearerTokenInterceptor])),

    // 2. Cấu hình Keycloak Standalone
    provideKeycloak({
      config: {
        url: 'http://localhost:8080',
        realm: 'meeting-realm',
        clientId: 'meeting-client'
      },
      initOptions: {
        onLoad: 'check-sso', // Kiểm tra session ngầm, không ép redirect ngay
        silentCheckSsoRedirectUri: window.location.origin + '/assets/silent-check-sso.html',
        checkLoginIframe: false // Tắt iframe check để tránh lỗi CORS
      }
    }),

    // 3. Tối ưu Thuật toán Lọc API: CHỈ đính kèm Token khi gọi API của Spring Boot
    {
      provide: INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
      useValue: [
        createInterceptorCondition<string>({
          // Backend Spring Boot chạy ở port 8088
          urlPattern: /^(http:\/\/localhost:8088)(\/.*)?$/i,
          bearerPrefix: 'Bearer'
        })
      ]
    }
  ]
};