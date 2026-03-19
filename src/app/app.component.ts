import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './features/auth/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'meetingplatform-fe';

  constructor(private authService: AuthService) {}

  ngOnInit() {
    // Keycloak is initialized via app.config.ts
    // Just refresh user profile if logged in
    this.authService.refreshUserProfile();
  }
}