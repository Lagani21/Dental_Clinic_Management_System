import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Doctor } from '../../models/core.models';

@Component({
  selector: 'app-doctors',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatInputModule,
    MatFormFieldModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule
  ],
  templateUrl: './doctors.component.html',
  styleUrls: ['./doctors.component.scss']
})
export class DoctorsComponent implements OnInit {
  doctors: Doctor[] = [];
  filteredDoctors: Doctor[] = [];
  displayedColumns: string[] = ['name', 'specialization', 'experience', 'patients', 'availability', 'actions'];
  loading = false;
  searchControl = new FormControl('');

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadDoctors();
    this.setupSearch();
  }

  setupSearch(): void {
    this.searchControl.valueChanges.subscribe(value => {
      this.filterDoctors(value || '');
    });
  }

  filterDoctors(searchTerm: string): void {
    if (!searchTerm) {
      this.filteredDoctors = [...this.doctors];
      return;
    }

    const term = searchTerm.toLowerCase();
    this.filteredDoctors = this.doctors.filter(doctor =>
      `${doctor.user_details.first_name} ${doctor.user_details.last_name}`.toLowerCase().includes(term) ||
      doctor.user_details.email.toLowerCase().includes(term) ||
      doctor.user_details.specialization?.toLowerCase().includes(term)
    );
  }

  loadDoctors(): void {
    this.loading = true;
    this.apiService.getDoctors().subscribe({
      next: (response) => {
        this.doctors = response.results || response;
        this.filteredDoctors = [...this.doctors];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading doctors:', error);
        this.snackBar.open('Error loading doctors', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
        this.loading = false;
      }
    });
  }

  deleteDoctor(doctor: Doctor): void {
    if (confirm(`Are you sure you want to delete Dr. ${doctor.user_details.first_name} ${doctor.user_details.last_name}?`)) {
      this.apiService.deleteDoctor(doctor.id!).subscribe({
        next: () => {
          this.snackBar.open('Doctor deleted successfully', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          this.loadDoctors();
        },
        error: (error: any) => {
          console.error('Error deleting doctor:', error);
          this.snackBar.open('Error deleting doctor', 'Close', {
            duration: 3000,
            panelClass: ['error-snackbar']
          });
        }
      });
    }
  }

  canDeleteDoctor(): boolean {
    const user = this.authService.currentUserValue;
    return user?.role === 'admin';
  }

  canManageDoctors(): boolean {
    const user = this.authService.currentUserValue;
    return user?.role === 'admin';
  }
}
