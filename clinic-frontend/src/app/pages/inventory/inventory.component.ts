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
import { InventoryItem } from '../../models/core.models';
import { InventoryFormComponent } from '../../components/inventory-form/inventory-form.component';

@Component({
  selector: 'app-inventory',
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
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.scss']
})
export class InventoryComponent implements OnInit {
  inventoryItems: InventoryItem[] = [];
  filteredItems: InventoryItem[] = [];
  displayedColumns: string[] = ['name', 'description', 'category', 'sku', 'currentStock', 'minimumStock', 'unitCost', 'actions'];
  loading = false;
  searchControl = new FormControl('');
  categoryFilter = new FormControl('all');

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadInventory();
    this.setupFilters();
  }

  setupFilters(): void {
    this.searchControl.valueChanges.subscribe(() => {
      this.applyFilters();
    });

    this.categoryFilter.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }

  applyFilters(): void {
    let filtered = [...this.inventoryItems];

    // Search filter
    const searchTerm = this.searchControl.value?.toLowerCase() || '';
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm) ||
        (item.description && item.description.toLowerCase().includes(searchTerm)) ||
        item.sku.toLowerCase().includes(searchTerm)
      );
    }

    // Category filter
    const categoryFilter = this.categoryFilter.value;
    if (categoryFilter && categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    this.filteredItems = filtered;
  }

  loadInventory(): void {
    this.loading = true;
    // For now, we'll use mock data since the backend API doesn't exist yet
    this.inventoryItems = this.getMockInventory();
    this.filteredItems = [...this.inventoryItems];
    this.loading = false;
  }

  getMockInventory(): InventoryItem[] {
    return [
      {
        id: 1,
        name: 'Dental Gloves (Large)',
        description: 'Latex-free dental examination gloves, size large',
        category: 'supplies',
        sku: 'DG-L-001',
        current_stock: 150,
        minimum_stock: 50,
        is_low_stock: false,
        unit_cost: 0.25,
        supplier: 'MedSupply Co.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 2,
        name: 'X-Ray Film',
        description: 'Dental X-ray film, size 2',
        category: 'supplies',
        sku: 'XF-2-001',
        current_stock: 25,
        minimum_stock: 30,
        is_low_stock: true,
        unit_cost: 1.50,
        supplier: 'Dental Imaging Inc.',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 3,
        name: 'Dental Drill Handpiece',
        description: 'High-speed dental drill handpiece',
        category: 'equipment',
        sku: 'DD-H-001',
        current_stock: 3,
        minimum_stock: 2,
        is_low_stock: false,
        unit_cost: 450.00,
        supplier: 'Dental Equipment Pro',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
  }

  addInventoryItem(): void {
    const dialogRef = this.dialog.open(InventoryFormComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      minWidth: '500px',
      data: {}
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Add to mock data for now
        const newItem: InventoryItem = {
          ...result,
          id: this.inventoryItems.length + 1,
          is_low_stock: result.current_stock <= result.minimum_stock,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        this.inventoryItems.unshift(newItem);
        this.applyFilters();
        this.snackBar.open('Inventory item created successfully', 'Close', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
      }
    });
  }

  editInventoryItem(item: InventoryItem): void {
    const dialogRef = this.dialog.open(InventoryFormComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      minWidth: '500px',
      data: { item }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const index = this.inventoryItems.findIndex(i => i.id === item.id);
        if (index !== -1) {
          this.inventoryItems[index] = { 
            ...this.inventoryItems[index], 
            ...result, 
            is_low_stock: result.current_stock <= result.minimum_stock,
            updated_at: new Date().toISOString() 
          };
          this.applyFilters();
          this.snackBar.open('Inventory item updated successfully', 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
        }
      }
    });
  }

  viewInventoryItem(item: InventoryItem): void {
    const dialogRef = this.dialog.open(InventoryFormComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      minWidth: '500px',
      data: { item, viewOnly: true }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.action === 'edit') {
        this.editInventoryItem(result.item);
      }
    });
  }

  deleteInventoryItem(item: InventoryItem): void {
    if (confirm(`Are you sure you want to delete "${item.name}"?`)) {
      const index = this.inventoryItems.findIndex(i => i.id === item.id);
      if (index !== -1) {
        this.inventoryItems.splice(index, 1);
        this.applyFilters();
        this.snackBar.open('Inventory item deleted successfully', 'Close', {
          duration: 3000,
          panelClass: ['success-snackbar']
        });
      }
    }
  }

  getCategoryColor(category: string): string {
    switch (category) {
      case 'equipment': return '#2196f3';
      case 'supplies': return '#4caf50';
      case 'medication': return '#ff9800';
      case 'consumables': return '#9c27b0';
      default: return '#666';
    }
  }

  getStockStatusColor(item: InventoryItem): string {
    if (item.is_low_stock) return '#f44336';
    if (item.current_stock <= item.minimum_stock * 1.2) return '#ff9800';
    return '#4caf50';
  }

  canManageInventory(): boolean {
    const user = this.authService.currentUserValue;
    return user?.role === 'admin';
  }

  canViewInventoryDetails(): boolean {
    const user = this.authService.currentUserValue;
    return user?.role === 'admin' || user?.role === 'doctor';
  }
}
