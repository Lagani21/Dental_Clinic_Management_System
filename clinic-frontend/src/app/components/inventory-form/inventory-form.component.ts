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

import { InventoryItem } from '../../models/core.models';

@Component({
  selector: 'app-inventory-form',
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
  templateUrl: './inventory-form.component.html',
  styleUrls: ['./inventory-form.component.scss']
})
export class InventoryFormComponent implements OnInit {
  inventoryForm: FormGroup;
  loading = false;
  isEditMode = false;
  viewOnly = false;
  
  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<InventoryFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      item?: InventoryItem; 
      viewOnly?: boolean;
    }
  ) {
    this.isEditMode = !!data?.item;
    this.viewOnly = data?.viewOnly || false;
    this.inventoryForm = this.createForm();
  }

  ngOnInit(): void {
    if (this.isEditMode && this.data.item) {
      this.populateForm(this.data.item);
    }
    
    if (this.viewOnly) {
      this.inventoryForm.disable();
    }
  }

  createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      description: [''],
      category: ['supplies', [Validators.required]],
      sku: ['', [Validators.required, Validators.minLength(3)]],
      current_stock: ['', [Validators.required, Validators.min(0)]],
      minimum_stock: ['', [Validators.required, Validators.min(0)]],
      unit_cost: ['', [Validators.required, Validators.min(0)]],
      supplier: ['']
    });
  }

  populateForm(item: InventoryItem): void {
    this.inventoryForm.patchValue({
      name: item.name,
      description: item.description || '',
      category: item.category,
      sku: item.sku,
      current_stock: item.current_stock,
      minimum_stock: item.minimum_stock,
      unit_cost: item.unit_cost,
      supplier: item.supplier || ''
    });
  }

  onSubmit(): void {
    if (this.inventoryForm.invalid || this.viewOnly) {
      return;
    }

    this.loading = true;
    const formValue = this.inventoryForm.value;
    
    // Simulate API call delay
    setTimeout(() => {
      this.loading = false;
      this.dialogRef.close(formValue);
    }, 500);
  }

  onEdit(): void {
    if (this.viewOnly) {
      this.dialogRef.close({ action: 'edit', item: this.data.item });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  private markFormGroupTouched(): void {
    Object.keys(this.inventoryForm.controls).forEach(key => {
      const control = this.inventoryForm.get(key);
      control?.markAsTouched();
    });
  }

  getErrorMessage(fieldName: string): string {
    const control = this.inventoryForm.get(fieldName);
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
