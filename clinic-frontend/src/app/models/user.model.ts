export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: 'admin' | 'doctor';
  phone?: string;
  specialization?: string;
  license_number?: string;
  is_active: boolean;
  date_joined: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'doctor';
  phone?: string;
  specialization?: string;
  license_number?: string;
}
