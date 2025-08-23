import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { User, LoginRequest, LoginResponse, RegisterRequest } from '../models/user.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = environment.apiUrl;
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;

  constructor(private http: HttpClient) {
    this.currentUserSubject = new BehaviorSubject<User | null>(
      this.getUserFromStorage()
    );
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public get isLoggedIn(): boolean {
    return !!this.getToken();
  }

  public get isAdmin(): boolean {
    const user = this.currentUserValue;
    return user?.role === 'admin';
  }

  public get isDoctor(): boolean {
    const user = this.currentUserValue;
    return user?.role === 'doctor';
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/auth/login/`, credentials)
      .pipe(
        map(response => {
          if (response.access && response.user) {
            this.setToken(response.access);
            this.setRefreshToken(response.refresh);
            this.setUser(response.user);
            this.currentUserSubject.next(response.user);
          }
          return response;
        }),
        catchError(this.handleError)
      );
  }

  register(userData: RegisterRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/auth/register/`, userData)
      .pipe(
        map(response => {
          if (response.access && response.user) {
            this.setToken(response.access);
            this.setRefreshToken(response.refresh);
            this.setUser(response.user);
            this.currentUserSubject.next(response.user);
          }
          return response;
        }),
        catchError(this.handleError)
      );
  }

  logout(): void {
    const refreshToken = this.getRefreshToken();
    
    // Clear tokens immediately
    this.clearTokens();
    this.currentUserSubject.next(null);
    
    // Attempt to logout on server (don't block user if it fails)
    if (refreshToken) {
      this.http.post(`${this.API_URL}/auth/logout/`, { refresh: refreshToken })
        .pipe(
          catchError(() => {
            // Ignore server errors on logout
            return throwError('Logout failed on server');
          })
        ).subscribe();
    }
  }

  refreshToken(): Observable<any> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.logout();
      return throwError('No refresh token available');
    }

    return this.http.post<{ access: string }>(`${this.API_URL}/auth/token/refresh/`, {
      refresh: refreshToken
    }).pipe(
      map(response => {
        if (response.access) {
          this.setToken(response.access);
        }
        return response;
      }),
      catchError(error => {
        this.logout();
        return throwError(error);
      })
    );
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.API_URL}/auth/user/`)
      .pipe(
        map(user => {
          this.setUser(user);
          this.currentUserSubject.next(user);
          return user;
        }),
        catchError(this.handleError)
      );
  }

  updateProfile(userData: Partial<User>): Observable<User> {
    return this.http.patch<User>(`${this.API_URL}/auth/profile/`, userData)
      .pipe(
        map(user => {
          this.setUser(user);
          this.currentUserSubject.next(user);
          return user;
        }),
        catchError(this.handleError)
      );
  }

  // Token management
  private setToken(token: string): void {
    localStorage.setItem('access_token', token);
  }

  private setRefreshToken(token: string): void {
    localStorage.setItem('refresh_token', token);
  }

  private setUser(user: User): void {
    localStorage.setItem('current_user', JSON.stringify(user));
  }

  public getToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('access_token');
  }

  private getRefreshToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('refresh_token');
  }

  private getUserFromStorage(): User | null {
    if (typeof localStorage === 'undefined') return null;
    const userStr = localStorage.getItem('current_user');
    return userStr ? JSON.parse(userStr) : null;
  }

  private clearTokens(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_user');
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
      if (error.status === 401) {
        errorMessage = 'Invalid credentials';
      } else if (error.status === 403) {
        errorMessage = 'Access denied';
      } else if (error.error && error.error.message) {
        errorMessage = error.error.message;
      } else if (error.error && typeof error.error === 'string') {
        errorMessage = error.error;
      }
    }
    
    return throwError(errorMessage);
  }
}
