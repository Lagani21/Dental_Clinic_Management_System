import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  Patient, Doctor, Appointment, TreatmentCatalog, TreatmentRecord, 
  Bill, InventoryItem, TreatmentInventoryUsage, ApiResponse, DashboardStats 
} from '../models/core.models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Patient API
  getPatients(params?: any): Observable<ApiResponse<Patient>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get<ApiResponse<Patient>>(`${this.API_URL}/patients/`, { params: httpParams });
  }

  getPatient(id: number): Observable<Patient> {
    return this.http.get<Patient>(`${this.API_URL}/patients/${id}/`);
  }

  createPatient(patient: Partial<Patient>): Observable<Patient> {
    return this.http.post<Patient>(`${this.API_URL}/patients/`, patient);
  }

  updatePatient(id: number, patient: Partial<Patient>): Observable<Patient> {
    return this.http.patch<Patient>(`${this.API_URL}/patients/${id}/`, patient);
  }

  deletePatient(id: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/patients/${id}/`);
  }

  getPatientAppointments(patientId: number): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${this.API_URL}/patients/${patientId}/appointments/`);
  }

  getPatientTreatments(patientId: number): Observable<TreatmentRecord[]> {
    return this.http.get<TreatmentRecord[]>(`${this.API_URL}/patients/${patientId}/treatments/`);
  }

  // Doctor API
  getDoctors(params?: any): Observable<ApiResponse<Doctor>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get<ApiResponse<Doctor>>(`${this.API_URL}/doctors/`, { params: httpParams });
  }

  getDoctor(id: number): Observable<Doctor> {
    return this.http.get<Doctor>(`${this.API_URL}/doctors/${id}/`);
  }

  createDoctor(doctor: Partial<Doctor>): Observable<Doctor> {
    return this.http.post<Doctor>(`${this.API_URL}/doctors/`, doctor);
  }

  updateDoctor(id: number, doctor: Partial<Doctor>): Observable<Doctor> {
    return this.http.patch<Doctor>(`${this.API_URL}/doctors/${id}/`, doctor);
  }

  deleteDoctor(id: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/doctors/${id}/`);
  }

  getDoctorSchedule(doctorId: number, startDate: string, endDate: string): Observable<Appointment[]> {
    const params = new HttpParams()
      .set('start_date', startDate)
      .set('end_date', endDate);
    return this.http.get<Appointment[]>(`${this.API_URL}/doctors/${doctorId}/schedule/`, { params });
  }

  // Appointment API
  getAppointments(params?: any): Observable<ApiResponse<Appointment>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get<ApiResponse<Appointment>>(`${this.API_URL}/appointments/`, { params: httpParams });
  }

  getAppointment(id: number): Observable<Appointment> {
    return this.http.get<Appointment>(`${this.API_URL}/appointments/${id}/`);
  }

  createAppointment(appointment: Partial<Appointment>): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.API_URL}/appointments/`, appointment);
  }

  updateAppointment(id: number, appointment: Partial<Appointment>): Observable<Appointment> {
    return this.http.patch<Appointment>(`${this.API_URL}/appointments/${id}/`, appointment);
  }

  deleteAppointment(id: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/appointments/${id}/`);
  }

  getTodayAppointments(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${this.API_URL}/appointments/today/`);
  }

  updateAppointmentStatus(id: number, status: string): Observable<Appointment> {
    return this.http.patch<Appointment>(`${this.API_URL}/appointments/${id}/update_status/`, { status });
  }

  // Treatment Catalog API
  getTreatmentCatalog(params?: any): Observable<ApiResponse<TreatmentCatalog>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get<ApiResponse<TreatmentCatalog>>(`${this.API_URL}/treatments/`, { params: httpParams });
  }

  getTreatment(id: number): Observable<TreatmentCatalog> {
    return this.http.get<TreatmentCatalog>(`${this.API_URL}/treatments/${id}/`);
  }

  createTreatment(treatment: Partial<TreatmentCatalog>): Observable<TreatmentCatalog> {
    return this.http.post<TreatmentCatalog>(`${this.API_URL}/treatments/`, treatment);
  }

  updateTreatment(id: number, treatment: Partial<TreatmentCatalog>): Observable<TreatmentCatalog> {
    return this.http.patch<TreatmentCatalog>(`${this.API_URL}/treatments/${id}/`, treatment);
  }

  deleteTreatment(id: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/treatments/${id}/`);
  }

  // Treatment Record API
  getTreatmentRecords(params?: any): Observable<ApiResponse<TreatmentRecord>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get<ApiResponse<TreatmentRecord>>(`${this.API_URL}/treatment-records/`, { params: httpParams });
  }

  getTreatmentRecord(id: number): Observable<TreatmentRecord> {
    return this.http.get<TreatmentRecord>(`${this.API_URL}/treatment-records/${id}/`);
  }

  createTreatmentRecord(record: Partial<TreatmentRecord>): Observable<TreatmentRecord> {
    return this.http.post<TreatmentRecord>(`${this.API_URL}/treatment-records/`, record);
  }

  updateTreatmentRecord(id: number, record: Partial<TreatmentRecord>): Observable<TreatmentRecord> {
    return this.http.patch<TreatmentRecord>(`${this.API_URL}/treatment-records/${id}/`, record);
  }

  deleteTreatmentRecord(id: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/treatment-records/${id}/`);
  }

  // Bill API
  getBills(params?: any): Observable<ApiResponse<Bill>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get<ApiResponse<Bill>>(`${this.API_URL}/bills/`, { params: httpParams });
  }

  getBill(id: number): Observable<Bill> {
    return this.http.get<Bill>(`${this.API_URL}/bills/${id}/`);
  }

  createBill(bill: Partial<Bill>): Observable<Bill> {
    return this.http.post<Bill>(`${this.API_URL}/bills/`, bill);
  }

  updateBill(id: number, bill: Partial<Bill>): Observable<Bill> {
    return this.http.patch<Bill>(`${this.API_URL}/bills/${id}/`, bill);
  }

  deleteBill(id: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/bills/${id}/`);
  }

  updateBillStatus(id: number, status: string): Observable<Bill> {
    return this.http.patch<Bill>(`${this.API_URL}/bills/${id}/update_status/`, { status });
  }

  // Inventory API
  getInventoryItems(params?: any): Observable<ApiResponse<InventoryItem>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get<ApiResponse<InventoryItem>>(`${this.API_URL}/inventory/`, { params: httpParams });
  }

  getInventoryItem(id: number): Observable<InventoryItem> {
    return this.http.get<InventoryItem>(`${this.API_URL}/inventory/${id}/`);
  }

  createInventoryItem(item: Partial<InventoryItem>): Observable<InventoryItem> {
    return this.http.post<InventoryItem>(`${this.API_URL}/inventory/`, item);
  }

  updateInventoryItem(id: number, item: Partial<InventoryItem>): Observable<InventoryItem> {
    return this.http.patch<InventoryItem>(`${this.API_URL}/inventory/${id}/`, item);
  }

  deleteInventoryItem(id: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/inventory/${id}/`);
  }

  getLowStockItems(): Observable<InventoryItem[]> {
    return this.http.get<InventoryItem[]>(`${this.API_URL}/inventory/low_stock/`);
  }

  updateInventoryStock(id: number, quantity: number, operation: 'set' | 'add' | 'subtract'): Observable<InventoryItem> {
    return this.http.patch<InventoryItem>(`${this.API_URL}/inventory/${id}/update_stock/`, {
      quantity,
      operation
    });
  }

  // Dashboard API
  getDashboardStats(): Observable<DashboardStats> {
    // This would be a custom endpoint on your backend
    return this.http.get<DashboardStats>(`${this.API_URL}/dashboard/stats/`);
  }
}
