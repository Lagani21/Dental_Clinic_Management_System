import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';

import { Patient, Doctor } from '../../models/core.models';

@Component({
  selector: 'app-patient-view',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatSnackBarModule,
    MatIconModule
  ],
  templateUrl: './patient-view.component.html',
  styleUrls: ['./patient-view.component.scss']
})
export class PatientViewComponent implements OnInit {
  patient: Patient;
  doctors: Doctor[] = [];
  
  constructor(
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<PatientViewComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { patient: Patient }
  ) {
    this.patient = data.patient;
  }

  ngOnInit(): void {
    // Load doctors for display purposes
    this.loadDoctors();
  }

  loadDoctors(): void {
    // This would typically come from a service
    // For now, we'll use the assigned doctor if available
  }

  onEdit(): void {
    // Close this dialog and signal to open edit form
    this.dialogRef.close({ action: 'edit', patient: this.patient });
  }

  onClose(): void {
    this.dialogRef.close();
  }

  getAssignedDoctorName(): string {
    if (this.patient.assigned_doctor_details) {
      return `${this.patient.assigned_doctor_details.first_name} ${this.patient.assigned_doctor_details.last_name}`;
    }
    return 'Not assigned';
  }

  getSpecialization(): string {
    if (this.patient.assigned_doctor_details?.specialization) {
      return this.patient.assigned_doctor_details.specialization;
    }
    return 'N/A';
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  }

  calculateAge(dateOfBirth: string): string {
    if (!dateOfBirth) return 'N/A';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return `${age} years`;
  }
}
