import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSidenavModule,
    MatListModule,
    MatDividerModule
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit {
  currentUser: User | null = null;
  sidenavOpened = false;

  menuItems = [
    { label: 'Dashboard', route: '/dashboard', icon: 'dashboard', roles: ['admin', 'doctor'] },
    { label: 'Patients', route: '/patients', icon: 'people', roles: ['admin', 'doctor'] },
    { label: 'Appointments', route: '/appointments', icon: 'event', roles: ['admin', 'doctor'] },
    { label: 'Billing', route: '/billing', icon: 'receipt', roles: ['admin', 'doctor'] },
    { label: 'Inventory', route: '/inventory', icon: 'inventory', roles: ['admin'] },
    { label: 'Profile', route: '/profile', icon: 'person', roles: ['admin', 'doctor'] }
  ];

  constructor(
    private authService: AuthService,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
    });
  }

  get filteredMenuItems() {
    if (!this.currentUser) return [];
    
    return this.menuItems.filter(item => 
      item.roles.includes(this.currentUser!.role)
    );
  }

  toggleSidenav(): void {
    this.sidenavOpened = !this.sidenavOpened;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
    this.sidenavOpened = false; // Close sidenav on mobile
  }
}
