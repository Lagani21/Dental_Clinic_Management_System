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
import { MatChipsModule } from '@angular/material/chips';

import { TodoItem } from '../../models/core.models';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-todo-form',
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
    MatChipsModule
  ],
  templateUrl: './todo-form.component.html',
  styleUrls: ['./todo-form.component.scss']
})
export class TodoFormComponent implements OnInit {
  todoForm: FormGroup;
  loading = false;
  isEditMode = false;
  viewOnly = false;
  
  // Mock users for assignment (in real app, this would come from API)
  users: User[] = [
    { 
      id: 1, 
      username: 'admin', 
      first_name: 'Admin', 
      last_name: 'User', 
      full_name: 'Admin User',
      email: 'admin@clinic.com', 
      role: 'admin', 
      phone: '', 
      specialization: '', 
      license_number: '',
      is_active: true,
      date_joined: new Date().toISOString()
    },
    { 
      id: 2, 
      username: 'drjohn', 
      first_name: 'Dr. John', 
      last_name: 'Smith', 
      full_name: 'Dr. John Smith',
      email: 'john@clinic.com', 
      role: 'doctor', 
      phone: '', 
      specialization: 'General Dentistry', 
      license_number: 'DENT123',
      is_active: true,
      date_joined: new Date().toISOString()
    },
    { 
      id: 3, 
      username: 'drsarah', 
      first_name: 'Dr. Sarah', 
      last_name: 'Johnson', 
      full_name: 'Dr. Sarah Johnson',
      email: 'sarah@clinic.com', 
      role: 'doctor', 
      phone: '', 
      specialization: 'Orthodontics', 
      license_number: 'DENT456',
      is_active: true,
      date_joined: new Date().toISOString()
    }
  ];
  
  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<TodoFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      todo?: TodoItem; 
      viewOnly?: boolean;
    }
  ) {
    this.isEditMode = !!data?.todo;
    this.viewOnly = data?.viewOnly || false;
    this.todoForm = this.createForm();
  }

  ngOnInit(): void {
    if (this.isEditMode && this.data.todo) {
      this.populateForm(this.data.todo);
    }
    
    if (this.viewOnly) {
      this.todoForm.disable();
    }
  }

  createForm(): FormGroup {
    return this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      priority: ['medium', [Validators.required]],
      status: ['pending', [Validators.required]],
      due_date: [''],
      assigned_to: ['']
    });
  }

  populateForm(todo: TodoItem): void {
    this.todoForm.patchValue({
      title: todo.title,
      description: todo.description || '',
      priority: todo.priority,
      status: todo.status,
      due_date: todo.due_date || '',
      assigned_to: todo.assigned_to || ''
    });
  }

  onSubmit(): void {
    if (this.todoForm.invalid || this.viewOnly) {
      return;
    }

    this.loading = true;
    const formValue = this.todoForm.value;
    
    // Simulate API call delay
    setTimeout(() => {
      this.loading = false;
      this.dialogRef.close(formValue);
    }, 500);
  }

  onEdit(): void {
    if (this.viewOnly) {
      this.dialogRef.close({ action: 'edit', todo: this.data.todo });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getErrorMessage(fieldName: string): string {
    const control = this.todoForm.get(fieldName);
    if (control?.hasError('required')) {
      return `${fieldName.replace('_', ' ')} is required`;
    }
    if (control?.hasError('minlength')) {
      return `${fieldName.replace('_', ' ')} must be at least ${control.errors?.['minlength'].requiredLength} characters`;
    }
    return '';
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'high': return '#f44336';
      case 'medium': return '#ff9800';
      case 'low': return '#4caf50';
      default: return '#666';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return '#ff9800';
      case 'in_progress': return '#2196f3';
      case 'completed': return '#4caf50';
      case 'cancelled': return '#f44336';
      default: return '#666';
    }
  }

  getUserName(userId: number): string {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      return user.role === 'doctor' ? `Dr. ${user.first_name} ${user.last_name}` : `${user.first_name} ${user.last_name}`;
    }
    return 'Unassigned';
  }
}
