import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './components/navbar/navbar.component';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, NavbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'Dental Clinic Management System';

  constructor(public authService: AuthService) {}

  ngOnInit(): void {
    // Try to load user from storage on app initialization
    if (this.authService.isLoggedIn) {
      this.authService.getCurrentUser().subscribe({
        error: () => {
          // If token is invalid, logout
          this.authService.logout();
        }
      });
    }
  }
}
