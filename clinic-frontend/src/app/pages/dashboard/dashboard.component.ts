import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { User } from '../../models/user.model';
import { Appointment } from '../../models/core.models';
import { AppointmentFormComponent } from '../../components/appointment-form/appointment-form.component';

interface CalendarDay {
  day: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  hasAppointments: boolean;
  appointmentCount: number;
  date: Date;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  currentUser: User | null = null;
  
  stats = {
    totalPatients: 0,
    todayAppointments: 0,
    pendingBills: 0,
    lowStockItems: 0
  };
  
  // Calendar properties
  currentDate = new Date();
  currentMonth = '';
  currentYear = 0;
  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  calendarDays: CalendarDay[] = [];
  
  // Appointments
  todayAppointments: Appointment[] = [];
  allAppointments: Appointment[] = [];

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
    });
    this.loadData();
    this.initializeCalendar();
  }



  private loadData(): void {
    // Load real appointments data
    this.apiService.getAppointments().subscribe({
      next: (response) => {
        this.allAppointments = response.results || response;
        this.loadTodayAppointments();
        this.generateCalendar();
        this.updateStats();
      },
      error: (error) => {
        console.error('Error loading appointments:', error);
        this.loadMockData();
      }
    });
  }

  private loadTodayAppointments(): void {
    const today = new Date().toISOString().split('T')[0];
    this.todayAppointments = this.allAppointments.filter(
      appointment => appointment.appointment_date === today
    );
  }

  private updateStats(): void {
    // Update stats with real data
    this.stats.todayAppointments = this.todayAppointments.length;
    // You can load other stats from APIs here
    this.stats.totalPatients = 156; // From API
    this.stats.pendingBills = 12; // From API
    this.stats.lowStockItems = 3; // From API
  }

  private loadMockData(): void {
    // Fallback mock data
    this.stats = {
      totalPatients: 156,
      todayAppointments: 8,
      pendingBills: 12,
      lowStockItems: 3
    };
  }

  // Calendar methods
  private initializeCalendar(): void {
    this.currentMonth = this.currentDate.toLocaleString('default', { month: 'long' });
    this.currentYear = this.currentDate.getFullYear();
    this.generateCalendar();
  }

  private generateCalendar(): void {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Start from Sunday of the week containing the first day
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    this.calendarDays = [];
    const today = new Date();
    
    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const appointmentsOnDay = this.getAppointmentsForDate(date);
      
      this.calendarDays.push({
        day: date.getDate(),
        isToday: this.isSameDay(date, today),
        isCurrentMonth: date.getMonth() === month,
        hasAppointments: appointmentsOnDay.length > 0,
        appointmentCount: appointmentsOnDay.length,
        date: new Date(date)
      });
    }
  }

  private getAppointmentsForDate(date: Date): Appointment[] {
    const dateString = date.toISOString().split('T')[0];
    return this.allAppointments.filter(
      appointment => appointment.appointment_date === dateString
    );
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return date1.toDateString() === date2.toDateString();
  }

  // Calendar navigation
  previousMonth(): void {
    this.currentDate.setMonth(this.currentDate.getMonth() - 1);
    this.initializeCalendar();
  }

  nextMonth(): void {
    this.currentDate.setMonth(this.currentDate.getMonth() + 1);
    this.initializeCalendar();
  }

  selectDate(day: CalendarDay): void {
    if (this.isAdmin()) {
      this.openAppointmentForm(day.date);
    } else {
      console.log('Selected date:', day.date);
      // For doctors, you could show existing appointments for the day
    }
  }

  // Action methods
  addAppointment(): void {
    this.openAppointmentForm(new Date());
  }

  openAppointmentForm(selectedDate: Date): void {
    const dateString = selectedDate.toISOString().split('T')[0];
    
    const dialogRef = this.dialog.open(AppointmentFormComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      minWidth: '500px',
      data: { selectedDate: dateString }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Refresh calendar and appointments after successful creation
        this.loadData();
      }
    });
  }

  refreshCalendar(): void {
    this.loadData();
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'scheduled':
        return 'primary';
      case 'confirmed':
        return 'accent';
      case 'completed':
        return '';
      case 'cancelled':
        return 'warn';
      default:
        return '';
    }
  }

  // Helper method for template
  isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }
}