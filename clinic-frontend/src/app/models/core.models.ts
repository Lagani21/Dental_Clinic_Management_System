import { User } from './user.model';

export interface Patient {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  medical_history?: string;
  allergies?: string;
  assigned_doctor?: number;
  assigned_doctor_details?: User;
  created_at: string;
  updated_at: string;
}

export interface Doctor {
  id: number;
  user: number;
  user_details: User;
  bio?: string;
  years_of_experience: number;
  consultation_fee: number;
  available_days: string;
  start_time: string;
  end_time: string;
  patient_count: number;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: number;
  patient: number;
  patient_name: string;
  patient_details?: Patient;
  doctor: number;
  doctor_name: string;
  doctor_details?: User;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  reason: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TreatmentCatalog {
  id: number;
  name: string;
  description: string;
  base_cost: number;
  duration_minutes: number;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TreatmentRecord {
  id: number;
  patient: number;
  patient_name: string;
  patient_details?: Patient;
  doctor: number;
  doctor_name: string;
  doctor_details?: User;
  appointment?: number;
  treatment: number;
  treatment_name: string;
  treatment_details?: TreatmentCatalog;
  date_performed: string;
  notes?: string;
  cost: number;
  created_at: string;
  updated_at: string;
}

export interface Bill {
  id: number;
  patient: number;
  patient_name: string;
  patient_details?: Patient;
  bill_number: string;
  bill_date: string;
  due_date: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  items?: BillItem[];
  created_at: string;
  updated_at: string;
}

export interface BillItem {
  id: number;
  treatment_record?: number;
  treatment_name?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface InventoryItem {
  id: number;
  name: string;
  description?: string;
  category: 'equipment' | 'supplies' | 'medication' | 'consumables';
  sku: string;
  current_stock: number;
  minimum_stock: number;
  is_low_stock: boolean;
  unit_cost: number;
  supplier?: string;
  created_at: string;
  updated_at: string;
}

export interface TreatmentInventoryUsage {
  id: number;
  treatment_record: number;
  inventory_item: number;
  inventory_item_name: string;
  inventory_item_details?: InventoryItem;
  quantity_used: number;
  cost_at_time: number;
  created_at: string;
}

// API Response interfaces
export interface ApiResponse<T> {
  count?: number;
  next?: string;
  previous?: string;
  results: T[];
}

export interface DashboardStats {
  total_patients: number;
  total_appointments: number;
  today_appointments: number;
  pending_bills: number;
  low_stock_items: number;
  recent_patients: Patient[];
  upcoming_appointments: Appointment[];
}
