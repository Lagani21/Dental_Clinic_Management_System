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
import { MatCheckboxModule } from '@angular/material/checkbox';

import { ApiService } from '../../services/api.service';
import { Doctor } from '../../models/core.models';

@Component({
  selector: 'app-doctor-form',
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
    MatIconModule,
    MatCheckboxModule
  ],
  templateUrl: './doctor-form.component.html',
  styleUrls: ['./doctor-form.component.scss']
})
export class DoctorFormComponent implements OnInit {
  doctorForm: FormGroup;
  loading = false;
  isEditMode = false;
  
  specializations = [
    'General Practice',
    'Cardiology',
    'Neurology',
    'Pediatrics',
    'Orthopedics',
    'Dermatology',
    'Ophthalmology',
    'ENT (Ear, Nose, Throat)',
    'Psychiatry',
    'Oncology',
    'Endocrinology',
    'Gastroenterology',
    'Pulmonology',
    'Nephrology',
    'Rheumatology',
    'Emergency Medicine',
    'Anesthesiology',
    'Radiology',
    'Pathology',
    'Surgery'
  ];

  availableDays = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday'
  ];
  
  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<DoctorFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { doctor?: Doctor }
  ) {
    this.isEditMode = !!data?.doctor;
    this.doctorForm = this.createForm();
  }

  ngOnInit(): void {
    if (this.isEditMode && this.data.doctor) {
      this.populateForm(this.data.doctor);
    }
  }

  createForm(): FormGroup {
    return this.fb.group({
      // Doctor profile fields only (user fields are read-only for now)
      bio: [''],
      years_of_experience: [0, [Validators.min(0), Validators.max(50)]],
      consultation_fee: [0, [Validators.min(0)]],
      available_days: [[]],
      start_time: ['09:00'],
      end_time: ['17:00']
    });
  }

  populateForm(doctor: Doctor): void {
    this.doctorForm.patchValue({
      bio: doctor.bio || '',
      years_of_experience: doctor.years_of_experience || 0,
      consultation_fee: doctor.consultation_fee || 0,
      available_days: doctor.available_days ? doctor.available_days.split(',') : [],
      start_time: doctor.start_time || '09:00',
      end_time: doctor.end_time || '17:00'
    });
  }

  onSubmit(): void {
    if (this.doctorForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.loading = true;
    const formValue = this.doctorForm.value;
    
    // For now, we'll only handle editing existing doctors
    // Creating new doctors requires backend changes to handle User creation
    if (!this.isEditMode) {
      this.snackBar.open('Creating new doctors is not yet implemented. Please contact an administrator.', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar']
      });
      this.loading = false;
      return;
    }

    // Prepare data for backend (edit mode only)
    const doctorData = {
      bio: formValue.bio,
      years_of_experience: formValue.years_of_experience,
      consultation_fee: formValue.consultation_fee,
      available_days: Array.isArray(formValue.available_days) 
        ? formValue.available_days.join(',') 
        : formValue.available_days,
      start_time: formValue.start_time,
      end_time: formValue.end_time
    };

    const request = this.apiService.updateDoctor(this.data.doctor!.id!, doctorData);

    request.subscribe({
      next: (doctor) => {
        this.loading = false;
        const message = this.isEditMode ? 'Doctor updated successfully' : 'Doctor created successfully';
        this.snackBar.open(message, 'Close', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
        this.dialogRef.close(doctor);
      },
      error: (error) => {
        this.loading = false;
        console.error('Error saving doctor:', error);
        let errorMessage = 'Error saving doctor';
        
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

  onDayChange(day: string, checked: boolean): void {
    const currentDays = this.doctorForm.get('available_days')?.value || [];
    if (checked) {
      if (!currentDays.includes(day)) {
        this.doctorForm.patchValue({
          available_days: [...currentDays, day]
        });
      }
    } else {
      this.doctorForm.patchValue({
        available_days: currentDays.filter((d: string) => d !== day)
      });
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.doctorForm.controls).forEach(key => {
      const control = this.doctorForm.get(key);
      control?.markAsTouched();
    });
  }

  getErrorMessage(fieldName: string): string {
    const control = this.doctorForm.get(fieldName);
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
    if (control?.hasError('min')) {
      return `${fieldName.replace('_', ' ')} must be at least ${control.errors?.['min'].min}`;
    }
    if (control?.hasError('max')) {
      return `${fieldName.replace('_', ' ')} must be at most ${control.errors?.['max'].max}`;
    }
    return '';
  }
}
