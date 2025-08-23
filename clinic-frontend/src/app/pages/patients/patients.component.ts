import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Patient } from '../../models/core.models';
import { PatientFormComponent } from '../../components/patient-form/patient-form.component';
import { PatientViewComponent } from '../../components/patient-view/patient-view.component';

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatToolbarModule,
    MatInputModule,
    MatFormFieldModule,
    MatSnackBarModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule
  ],
  templateUrl: './patients.component.html',
  styleUrls: ['./patients.component.scss']
})
export class PatientsComponent implements OnInit {
  patients: Patient[] = [];
  filteredPatients: Patient[] = [];
  displayedColumns: string[] = ['name', 'email', 'phone', 'dateOfBirth', 'assignedDoctor', 'actions'];
  loading = false;
  searchControl = new FormControl('');

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadPatients();
    this.setupSearch();
  }

  setupSearch(): void {
    this.searchControl.valueChanges.subscribe(value => {
      this.filterPatients(value || '');
    });
  }

  filterPatients(searchTerm: string): void {
    if (!searchTerm) {
      this.filteredPatients = [...this.patients];
      return;
    }

    const term = searchTerm.toLowerCase();
    this.filteredPatients = this.patients.filter(patient =>
      `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(term) ||
      patient.email.toLowerCase().includes(term) ||
      patient.phone.toLowerCase().includes(term)
    );
  }

  loadPatients(): void {
    this.loading = true;
    this.apiService.getPatients().subscribe({
      next: (response) => {
        this.patients = response.results || response;
        this.filteredPatients = [...this.patients];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading patients:', error);
        this.snackBar.open('Error loading patients', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
        this.loading = false;
      }
    });
  }

  deletePatient(patient: Patient): void {
    if (confirm(`Are you sure you want to delete ${patient.first_name} ${patient.last_name}?`)) {
      this.apiService.deletePatient(patient.id!).subscribe({
        next: () => {
          this.snackBar.open('Patient deleted successfully', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          this.loadPatients();
        },
        error: (error) => {
          console.error('Error deleting patient:', error);
          this.snackBar.open('Error deleting patient', 'Close', {
            duration: 3000,
            panelClass: ['error-snackbar']
          });
        }
      });
    }
  }

  canDeletePatient(): boolean {
    const user = this.authService.currentUserValue;
    return user?.role === 'admin';
  }

  canViewPatientDetails(): boolean {
    const user = this.authService.currentUserValue;
    return user?.role === 'admin' || user?.role === 'doctor';
  }

  openPatientForm(patient?: Patient): void {
    const dialogRef = this.dialog.open(PatientFormComponent, {
      width: '800px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      minWidth: '600px',
      data: { patient }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadPatients();
      }
    });
  }

  addPatient(): void {
    this.openPatientForm();
  }

  editPatient(patient: Patient): void {
    this.openPatientForm(patient);
  }

  viewPatient(patient: Patient): void {
    const dialogRef = this.dialog.open(PatientViewComponent, {
      width: '800px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      minWidth: '600px',
      data: { patient }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.action === 'edit') {
        // Open edit form
        this.openPatientForm(result.patient);
      }
    });
  }
}
