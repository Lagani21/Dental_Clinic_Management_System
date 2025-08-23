import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Appointment } from '../../models/core.models';

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatInputModule,
    MatFormFieldModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule
  ],
  templateUrl: './appointments.component.html',
  styleUrls: ['./appointments.component.scss']
})
export class AppointmentsComponent implements OnInit {
  appointments: Appointment[] = [];
  filteredAppointments: Appointment[] = [];
  displayedColumns: string[] = ['patient', 'doctor', 'date', 'time', 'duration', 'status', 'reason', 'actions'];
  loading = false;
  searchControl = new FormControl('');

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadAppointments();
    this.setupSearch();
  }

  setupSearch(): void {
    this.searchControl.valueChanges.subscribe(value => {
      this.filterAppointments(value || '');
    });
  }

  filterAppointments(searchTerm: string): void {
    if (!searchTerm) {
      this.filteredAppointments = [...this.appointments];
      return;
    }

    const term = searchTerm.toLowerCase();
    this.filteredAppointments = this.appointments.filter(appointment =>
      appointment.patient_name.toLowerCase().includes(term) ||
      appointment.doctor_name.toLowerCase().includes(term) ||
      appointment.reason.toLowerCase().includes(term) ||
      appointment.status.toLowerCase().includes(term)
    );
  }

  loadAppointments(): void {
    this.loading = true;
    this.apiService.getAppointments().subscribe({
      next: (response) => {
        this.appointments = response.results || response;
        this.filteredAppointments = [...this.appointments];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading appointments:', error);
        this.snackBar.open('Error loading appointments', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
        this.loading = false;
      }
    });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'scheduled':
        return 'primary';
      case 'confirmed':
        return 'accent';
      case 'in_progress':
        return 'warn';
      case 'completed':
        return '';
      case 'cancelled':
        return 'warn';
      case 'no_show':
        return 'warn';
      default:
        return '';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'in_progress':
        return 'In Progress';
      case 'no_show':
        return 'No Show';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  }

  canManageAppointments(): boolean {
    const user = this.authService.currentUserValue;
    return user?.role === 'admin';
  }

  canViewAppointments(): boolean {
    const user = this.authService.currentUserValue;
    return user?.role === 'admin' || user?.role === 'doctor';
  }
}
