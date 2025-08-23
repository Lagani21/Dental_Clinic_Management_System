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
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { TodoItem } from '../../models/core.models';
import { User } from '../../models/user.model';
import { TodoFormComponent } from '../../components/todo-form/todo-form.component';

@Component({
  selector: 'app-todo',
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
    MatChipsModule,
    MatSelectModule,
    ReactiveFormsModule
  ],
  templateUrl: './todo.component.html',
  styleUrls: ['./todo.component.scss']
})
export class TodoComponent implements OnInit {
  todos: TodoItem[] = [];
  filteredTodos: TodoItem[] = [];
  displayedColumns: string[] = ['title', 'description', 'priority', 'status', 'dueDate', 'assignedTo', 'actions'];
  loading = false;
  searchControl = new FormControl('');
  statusFilter = new FormControl('all');
  priorityFilter = new FormControl('all');

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadTodos();
    this.setupFilters();
  }

  setupFilters(): void {
    this.searchControl.valueChanges.subscribe(() => {
      this.applyFilters();
    });

    this.statusFilter.valueChanges.subscribe(() => {
      this.applyFilters();
    });

    this.priorityFilter.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }

  applyFilters(): void {
    let filtered = [...this.todos];

    // Search filter
    const searchTerm = this.searchControl.value?.toLowerCase() || '';
    if (searchTerm) {
      filtered = filtered.filter(todo =>
        todo.title.toLowerCase().includes(searchTerm) ||
        (todo.description && todo.description.toLowerCase().includes(searchTerm))
      );
    }

    // Status filter
    const statusFilter = this.statusFilter.value;
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(todo => todo.status === statusFilter);
    }

    // Priority filter
    const priorityFilter = this.priorityFilter.value;
    if (priorityFilter && priorityFilter !== 'all') {
      filtered = filtered.filter(todo => todo.priority === priorityFilter);
    }

    this.filteredTodos = filtered;
  }

  loadTodos(): void {
    this.loading = true;
    // For now, we'll use mock data since the backend API doesn't exist yet
    this.todos = this.getMockTodos();
    this.filteredTodos = [...this.todos];
    this.loading = false;
  }

  getMockTodos(): TodoItem[] {
    return [
      {
        id: 1,
        title: 'Review patient X-rays',
        description: 'Check recent X-rays for patient John Doe',
        priority: 'high',
        status: 'pending',
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        assigned_to: 1,
        created_by: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 2,
        title: 'Order dental supplies',
        description: 'Restock gloves, masks, and other essentials',
        priority: 'medium',
        status: 'in_progress',
        due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        assigned_to: 2,
        created_by: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 3,
        title: 'Schedule staff meeting',
        description: 'Weekly team meeting to discuss patient cases',
        priority: 'low',
        status: 'completed',
        due_date: new Date().toISOString().split('T')[0],
        assigned_to: 1,
        created_by: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  }

  addTodo(): void {
    const dialogRef = this.dialog.open(TodoFormComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      minWidth: '500px',
      data: {}
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Add to mock data for now
        const newTodo: TodoItem = {
          ...result,
          id: this.todos.length + 1,
          created_by: this.authService.currentUserValue?.id || 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        this.todos.unshift(newTodo);
        this.applyFilters();
        this.snackBar.open('Todo created successfully', 'Close', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
      }
    });
  }

  editTodo(todo: TodoItem): void {
    const dialogRef = this.dialog.open(TodoFormComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      minWidth: '500px',
      data: { todo }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const index = this.todos.findIndex(t => t.id === todo.id);
        if (index !== -1) {
          this.todos[index] = { ...this.todos[index], ...result, updated_at: new Date().toISOString() };
          this.applyFilters();
          this.snackBar.open('Todo updated successfully', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
        }
      }
    });
  }

  viewTodo(todo: TodoItem): void {
    const dialogRef = this.dialog.open(TodoFormComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      minWidth: '500px',
      data: { todo, viewOnly: true }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.action === 'edit') {
        this.editTodo(result.todo);
      }
    });
  }

  deleteTodo(todo: TodoItem): void {
    if (confirm(`Are you sure you want to delete "${todo.title}"?`)) {
      const index = this.todos.findIndex(t => t.id === todo.id);
      if (index !== -1) {
        this.todos.splice(index, 1);
        this.applyFilters();
        this.snackBar.open('Todo deleted successfully', 'Close', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
      }
    }
  }

  updateTodoStatus(todo: TodoItem, newStatus: string): void {
    const index = this.todos.findIndex(t => t.id === todo.id);
    if (index !== -1) {
      this.todos[index] = { ...this.todos[index], status: newStatus as any, updated_at: new Date().toISOString() };
      this.applyFilters();
      this.snackBar.open('Todo status updated', 'Close', {
        duration: 2000,
        panelClass: ['success-snackbar']
      });
    }
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

  formatDate(dateString: string): string {
    if (!dateString) return 'No due date';
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else if (date < today) {
      return 'Overdue';
    } else {
      return date.toLocaleDateString();
    }
  }

  isOverdue(dateString: string): boolean {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    return date < today;
  }

  canManageTodos(): boolean {
    const user = this.authService.currentUserValue;
    return user?.role === 'admin';
  }

  canViewTodoDetails(): boolean {
    const user = this.authService.currentUserValue;
    return user?.role === 'admin' || user?.role === 'doctor';
  }
}
