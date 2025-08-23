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
import { TreatmentCatalog } from '../../models/core.models';
import { TreatmentFormComponent } from '../../components/treatment-form/treatment-form.component';

@Component({
  selector: 'app-treatments',
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
  templateUrl: './treatments.component.html',
  styleUrls: ['./treatments.component.scss']
})
export class TreatmentsComponent implements OnInit {
  treatments: TreatmentCatalog[] = [];
  filteredTreatments: TreatmentCatalog[] = [];
  displayedColumns: string[] = ['name', 'description', 'baseCost', 'duration', 'category', 'actions'];
  loading = false;
  searchControl = new FormControl('');

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadTreatments();
    this.setupSearch();
  }

  setupSearch(): void {
    this.searchControl.valueChanges.subscribe(value => {
      this.filterTreatments(value || '');
    });
  }

  filterTreatments(searchTerm: string): void {
    if (!searchTerm) {
      this.filteredTreatments = [...this.treatments];
      return;
    }

    const term = searchTerm.toLowerCase();
    this.filteredTreatments = this.treatments.filter(treatment =>
      treatment.name.toLowerCase().includes(term) ||
      treatment.description.toLowerCase().includes(term) ||
      treatment.category.toLowerCase().includes(term)
    );
  }

  loadTreatments(): void {
    this.loading = true;
    this.apiService.getTreatmentCatalog().subscribe({
      next: (response) => {
        this.treatments = response.results || response;
        this.filteredTreatments = [...this.treatments];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading treatments:', error);
        this.snackBar.open('Error loading treatments', 'Close', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
        this.loading = false;
      }
    });
  }

  addTreatment(): void {
    const dialogRef = this.dialog.open(TreatmentFormComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      minWidth: '500px',
      data: {}
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadTreatments();
      }
    });
  }

  editTreatment(treatment: TreatmentCatalog): void {
    const dialogRef = this.dialog.open(TreatmentFormComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      minWidth: '500px',
      data: { treatment }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadTreatments();
      }
    });
  }

  viewTreatment(treatment: TreatmentCatalog): void {
    const dialogRef = this.dialog.open(TreatmentFormComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      minWidth: '500px',
      data: { treatment, viewOnly: true }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.action === 'edit') {
        this.editTreatment(result.treatment);
      }
    });
  }

  deleteTreatment(treatment: TreatmentCatalog): void {
    if (confirm(`Are you sure you want to delete ${treatment.name}?`)) {
      this.apiService.deleteTreatment(treatment.id!).subscribe({
        next: () => {
          this.snackBar.open('Treatment deleted successfully', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          this.loadTreatments();
        },
        error: (error) => {
          console.error('Error deleting treatment:', error);
          this.snackBar.open('Error deleting treatment', 'Close', {
            duration: 3000,
            panelClass: ['error-snackbar']
          });
        }
      });
    }
  }

  canManageTreatments(): boolean {
    const user = this.authService.currentUserValue;
    return user?.role === 'admin';
  }

  canViewTreatmentDetails(): boolean {
    const user = this.authService.currentUserValue;
    return user?.role === 'admin' || user?.role === 'doctor';
  }
}
