import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true, // Bắt buộc phải có để chạy kiến trúc hiện đại
  imports: [RouterOutlet], // Import RouterOutlet để app.component.html nhận ra thẻ <router-outlet>
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'meetingplatform-fe';
}