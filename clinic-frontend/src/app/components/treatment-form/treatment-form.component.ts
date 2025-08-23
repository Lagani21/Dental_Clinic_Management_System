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

import { ApiService } from '../../services/api.service';
import { TreatmentCatalog } from '../../models/core.models';

@Component({
  selector: 'app-treatment-form',
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
  templateUrl: './treatment-form.component.html',
  styleUrls: ['./treatment-form.component.scss']
})
export class TreatmentFormComponent implements OnInit {
  treatmentForm: FormGroup;
  loading = false;
  isEditMode = false;
  viewOnly = false;
  
  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<TreatmentFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      treatment?: TreatmentCatalog; 
      viewOnly?: boolean;
    }
  ) {
    this.isEditMode = !!data?.treatment;
    this.viewOnly = data?.viewOnly || false;
    this.treatmentForm = this.createForm();
  }

  ngOnInit(): void {
    if (this.isEditMode && this.data.treatment) {
      this.populateForm(this.data.treatment);
    }
    
    if (this.viewOnly) {
      this.treatmentForm.disable();
    }
  }

  createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      base_cost: ['', [Validators.required, Validators.min(0)]],
      duration_minutes: ['', [Validators.required, Validators.min(1)]],
      category: ['', [Validators.required]],
      is_active: [true]
    });
  }

  populateForm(treatment: TreatmentCatalog): void {
    this.treatmentForm.patchValue({
      name: treatment.name,
      description: treatment.description,
      base_cost: treatment.base_cost,
      duration_minutes: treatment.duration_minutes,
      category: treatment.category,
      is_active: treatment.is_active
    });
  }

  onSubmit(): void {
    if (this.treatmentForm.invalid || this.viewOnly) {
      return;
    }

    this.loading = true;
    const formValue = this.treatmentForm.value;
    
    const request = this.isEditMode
      ? this.apiService.updateTreatment(this.data.treatment!.id!, formValue)
      : this.apiService.createTreatment(formValue);

    request.subscribe({
      next: (treatment) => {
        this.loading = false;
        const message = this.isEditMode ? 'Treatment updated successfully' : 'Treatment created successfully';
        this.snackBar.open(message, 'Close', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
        this.dialogRef.close(treatment);
      },
      error: (error) => {
        this.loading = false;
        console.error('Error saving treatment:', error);
        let errorMessage = 'Error saving treatment';
        
        if (error.error) {
          if (typeof error.error === 'string') {
            errorMessage = error.error;
          } else if (error.error.detail) {
            errorMessage = error.error.detail;
          }
        }
        
        this.snackBar.open(errorMessage, 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  onEdit(): void {
    if (this.viewOnly) {
      this.dialogRef.close({ action: 'edit', treatment: this.data.treatment });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  private markFormGroupTouched(): void {
    Object.keys(this.treatmentForm.controls).forEach(key => {
      const control = this.treatmentForm.get(key);
      control?.markAsTouched();
    });
  }

  getErrorMessage(fieldName: string): string {
    const control = this.treatmentForm.get(fieldName);
    if (control?.hasError('required')) {
      return `${fieldName.replace('_', ' ')} is required`;
    }
    if (control?.hasError('minlength')) {
      return `${fieldName.replace('_', ' ')} must be at least ${control.errors?.['minlength'].requiredLength} characters`;
    }
    if (control?.hasError('min')) {
      return `${fieldName.replace('_', ' ')} must be at least ${control.errors?.['min'].min}`;
    }
    return '';
  }
}
