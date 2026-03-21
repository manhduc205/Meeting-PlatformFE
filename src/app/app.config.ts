import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  KeycloakService,
  provideKeycloak,
  includeBearerTokenInterceptor,
  INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
  createInterceptorCondition
} from 'keycloak-angular';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),

    // 1. Kích hoạt HttpClient kẹp Token
    provideHttpClient(withInterceptors([includeBearerTokenInterceptor])),

    // 2. Cấu hình Keycloak động theo môi trường
    provideKeycloak({
      config: {
        url: environment.keycloak.url,
        realm: environment.keycloak.realm,
        clientId: environment.keycloak.clientId
      },
      initOptions: {
        onLoad: 'check-sso',
        silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
        // 3. Tối ưu thuật toán: Thêm cái này để tránh lỗi iframe trên localhost
        checkLoginIframe: false
      }
    }),

    // 3. Regex động chặn lộ Token
    {
      provide: INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
      useValue: [
        createInterceptorCondition({
          // Tự động khớp với bất kỳ domain Backend nào bạn cấu hình
          urlPattern: new RegExp(`^${environment.backendApiUrl}(\\/.*)?$`, 'i'),
          bearerPrefix: 'Bearer'
        })
      ]
    }
  ]
};