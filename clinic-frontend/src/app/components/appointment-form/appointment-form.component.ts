import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiService } from '../../services/api.service';
import { Patient, Doctor, Appointment } from '../../models/core.models';
import { PatientFormComponent } from '../patient-form/patient-form.component';

@Component({
  selector: 'app-appointment-form',
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
    MatProgressSpinnerModule
  ],
  templateUrl: './appointment-form.component.html',
  styleUrls: ['./appointment-form.component.scss']
})
export class AppointmentFormComponent implements OnInit {
  appointmentForm: FormGroup;
  loading = false;
  isEditMode = false;
  patients: Patient[] = [];
  doctors: Doctor[] = [];
  selectedDate: string;
  
  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    public dialogRef: MatDialogRef<AppointmentFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      appointment?: Appointment; 
      selectedDate?: string;
    }
  ) {
    this.isEditMode = !!data?.appointment;
    this.selectedDate = data?.selectedDate || '';
    this.appointmentForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadPatients();
    this.loadDoctors();
    if (this.isEditMode && this.data.appointment) {
      this.populateForm(this.data.appointment);
    }
  }

  createForm(): FormGroup {
    return this.fb.group({
      patient: ['', [Validators.required]],
      doctor: ['', [Validators.required]],
      appointment_date: [this.selectedDate, [Validators.required]],
      appointment_time: ['', [Validators.required]],
      reason: ['', [Validators.required]],
      notes: [''],
      status: ['scheduled', [Validators.required]]
    });
  }

  populateForm(appointment: Appointment): void {
    this.appointmentForm.patchValue({
      patient: appointment.patient,
      doctor: appointment.doctor,
      appointment_date: appointment.appointment_date,
      appointment_time: appointment.appointment_time,
      reason: appointment.reason,
      notes: appointment.notes,
      status: appointment.status
    });
  }

  loadPatients(): void {
    this.apiService.getPatients().subscribe({
      next: (response) => {
        this.patients = response.results || response;
      },
      error: (error) => {
        console.error('Error loading patients:', error);
        this.snackBar.open('Error loading patients', 'Close', {
          duration: 3000
        });
      }
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
          duration: 3000
        });
      }
    });
  }

  onSubmit(): void {
    if (this.appointmentForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.loading = true;
    const formValue = this.appointmentForm.value;
    
    const request = this.isEditMode
      ? this.apiService.updateAppointment(this.data.appointment!.id!, formValue)
      : this.apiService.createAppointment(formValue);

    request.subscribe({
      next: (appointment) => {
        this.loading = false;
        const message = this.isEditMode ? 'Appointment updated successfully' : 'Appointment scheduled successfully';
        this.snackBar.open(message, 'Close', {
          duration: 3000
        });
        this.dialogRef.close(appointment);
      },
      error: (error) => {
        this.loading = false;
        console.error('Error saving appointment:', error);
        let errorMessage = 'Error saving appointment';
        
        if (error.error) {
          if (typeof error.error === 'string') {
            errorMessage = error.error;
          } else if (error.error.detail) {
            errorMessage = error.error.detail;
          }
        }
        
        this.snackBar.open(errorMessage, 'Close', {
          duration: 5000
        });
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  addNewPatient(): void {
    const patientDialogRef = this.dialog.open(PatientFormComponent, {
      width: '800px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      minWidth: '600px',
      data: {}
    });

    patientDialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Add the new patient to the list and select it
        this.patients.push(result);
        this.appointmentForm.patchValue({ patient: result.id });
        this.snackBar.open('New patient added and selected for appointment', 'Close', {
          duration: 3000
        });
      }
    });
  }

  private markFormGroupTouched(): void {
    Object.keys(this.appointmentForm.controls).forEach(key => {
      const control = this.appointmentForm.get(key);
      control?.markAsTouched();
    });
  }

  getErrorMessage(fieldName: string): string {
    const control = this.appointmentForm.get(fieldName);
    if (control?.hasError('required')) {
      return `${fieldName.replace('_', ' ')} is required`;
    }
    return '';
  }

  getPatientName(patientId: number): string {
    const patient = this.patients.find(p => p.id === patientId);
    return patient ? `${patient.first_name} ${patient.last_name}` : '';
  }

  getDoctorName(doctorId: number): string {
    const doctor = this.doctors.find(d => d.id === doctorId);
    return doctor ? `Dr. ${doctor.user_details.first_name} ${doctor.user_details.last_name}` : '';
  }
}
