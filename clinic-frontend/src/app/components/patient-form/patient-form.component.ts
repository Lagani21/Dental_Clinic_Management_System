import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';

import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

import { ApiService } from '../../services/api.service';
import { Patient, Doctor } from '../../models/core.models';

@Component({
  selector: 'app-patient-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,

    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatIconModule
  ],
  templateUrl: './patient-form.component.html',
  styleUrls: ['./patient-form.component.scss']
})
export class PatientFormComponent implements OnInit {
  patientForm: FormGroup;
  loading = false;
  isEditMode = false;
  doctors: Doctor[] = [];
  
  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<PatientFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { patient?: Patient }
  ) {
    this.isEditMode = !!data?.patient;
    this.patientForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadDoctors();
    if (this.isEditMode && this.data.patient) {
      this.populateForm(this.data.patient);
    }
  }

  createForm(): FormGroup {
    return this.fb.group({
      first_name: ['', [Validators.required, Validators.minLength(2)]],
      last_name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\+?[\d\s-()]+$/)]],
      date_of_birth: ['', [Validators.required]],
      address: ['', [Validators.required]],
      emergency_contact_name: ['', [Validators.required]],
      emergency_contact_phone: ['', [Validators.required, Validators.pattern(/^\+?[\d\s-()]+$/)]],
      medical_history: [''],
      allergies: [''],
      assigned_doctor: ['']
    });
  }

  populateForm(patient: Patient): void {
    this.patientForm.patchValue({
      first_name: patient.first_name,
      last_name: patient.last_name,
      email: patient.email,
      phone: patient.phone,
      date_of_birth: patient.date_of_birth, // Keep as string for HTML date input
      address: patient.address,
      emergency_contact_name: patient.emergency_contact_name,
      emergency_contact_phone: patient.emergency_contact_phone,
      medical_history: patient.medical_history,
      allergies: patient.allergies,
      assigned_doctor: patient.assigned_doctor
    });
  }

  loadDoctors(): void {
    this.apiService.getDoctors().subscribe({
      next: (response) => {
        this.doctors = response.results || response;
      },
      error: (error) => {
        console.error('Error loading doctors:', error);
        this.snackBar.open('Error loading doctors', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  onSubmit(): void {
    if (this.patientForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.loading = true;
    const formValue = this.patientForm.value;
    
    // Date is already in YYYY-MM-DD format from HTML date input

    const request = this.isEditMode
      ? this.apiService.updatePatient(this.data.patient!.id!, formValue)
      : this.apiService.createPatient(formValue);

    request.subscribe({
      next: (patient) => {
        this.loading = false;
        const message = this.isEditMode ? 'Patient updated successfully' : 'Patient created successfully';
        this.snackBar.open(message, 'Close', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
        this.dialogRef.close(patient);
      },
      error: (error) => {
        this.loading = false;
        console.error('Error saving patient:', error);
        let errorMessage = 'Error saving patient';
        
        if (error.error) {
          if (typeof error.error === 'string') {
            errorMessage = error.error;
          } else if (error.error.detail) {
            errorMessage = error.error.detail;
          } else {
            // Handle field-specific errors
            const fieldErrors = [];
            for (const [field, errors] of Object.entries(error.error)) {
              if (Array.isArray(errors)) {
                fieldErrors.push(`${field}: ${errors.join(', ')}`);
              }
            }
            if (fieldErrors.length > 0) {
              errorMessage = fieldErrors.join('; ');
            }
          }
        }
        
        this.snackBar.open(errorMessage, 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  private markFormGroupTouched(): void {
    Object.keys(this.patientForm.controls).forEach(key => {
      const control = this.patientForm.get(key);
      control?.markAsTouched();
    });
  }

  getErrorMessage(fieldName: string): string {
    const control = this.patientForm.get(fieldName);
    if (control?.hasError('required')) {
      return `${fieldName.replace('_', ' ')} is required`;
    }
    if (control?.hasError('email')) {
      return 'Enter a valid email';
    }
    if (control?.hasError('pattern')) {
      return 'Enter a valid phone number';
    }
    if (control?.hasError('minlength')) {
      return `${fieldName.replace('_', ' ')} must be at least ${control.errors?.['minlength'].requiredLength} characters`;
    }
    return '';
  }

  calculateAge(dateOfBirth: string): string {
    if (!dateOfBirth) return '';
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
