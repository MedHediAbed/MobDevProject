import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, from } from 'rxjs';
import { catchError, concatMap, map, tap } from 'rxjs/operators';
import { Storage } from '@ionic/storage-angular';
import { Router } from '@angular/router';

export interface User {
  id: string;
  nom: string;
  email: string;
  role: 'freelancer' | 'client';
  statut?: string;
  dateCreation?: string;
  telephone?: string;
  dateNaissance?: string;
  avatarUrl?: string;
  /** local = email/password; google = OAuth (no password change) */
  provider?: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: 'freelancer' | 'client';
}

export interface LoginPayload {
  email: string;
  password: string;
}

declare const google: any;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API_URL = 'http://127.0.0.1:5000/api/auth';
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';
  private readonly GOOGLE_CLIENT_ID = '254891348608-slce0mq3p38b162bat56fu0susk2muth.apps.googleusercontent.com';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  /** Single shared promise so create() completes before any get/set/remove. */
  private storageReadyPromise: Promise<void> | null = null;

  constructor(
    private http: HttpClient,
    private storage: Storage,
    private router: Router,
    private ngZone: NgZone
  ) {
    this.initStorage();
  }

  private ensureStorageReady(): Promise<void> {
    if (!this.storageReadyPromise) {
      // create() resolves to Storage; we only need to wait for init side effects
      this.storageReadyPromise = this.storage.create().then(() => undefined);
    }
    return this.storageReadyPromise!;
  }

  private async initStorage() {
    await this.ensureStorageReady();
    await this.loadUserFromStorage();
  }

  private normalizeUser(raw: Record<string, unknown>): User {
    const nom = String(raw['nom'] ?? raw['name'] ?? '');
    const u: User = {
      id: String(raw['id']),
      nom,
      email: String(raw['email'] ?? ''),
      role: raw['role'] as User['role'],
      statut: raw['statut'] != null ? String(raw['statut']) : raw['status'] != null ? String(raw['status']) : undefined,
      dateCreation: raw['dateCreation'] != null ? String(raw['dateCreation']) : undefined,
    };
    if (raw['telephone'] != null) u.telephone = String(raw['telephone']);
    if (raw['dateNaissance'] != null) u.dateNaissance = String(raw['dateNaissance']);
    if (raw['avatarUrl'] != null) u.avatarUrl = String(raw['avatarUrl']);
    if (raw['provider'] != null) u.provider = String(raw['provider']);
    return u;
  }

  private async loadUserFromStorage() {
    await this.ensureStorageReady();
    const user = await this.storage.get(this.USER_KEY);
    if (user) this.currentUserSubject.next(this.normalizeUser(JSON.parse(user)));
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    const body = {
      nom: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      role: payload.role,
    };
    return this.http.post<AuthResponse>(`${this.API_URL}/register`, body).pipe(
      concatMap((res) => from(this.handleAuthSuccess(res)).pipe(map(() => res))),
      catchError(this.handleError)
    );
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    const body = {
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
    };
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, body).pipe(
      concatMap((res) => from(this.handleAuthSuccess(res)).pipe(map(() => res))),
      catchError(this.handleError)
    );
  }

  // Wait for Google SDK to be available
  private waitForGoogle(): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const check = () => {
        attempts++;
        if (typeof google !== 'undefined' && google?.accounts?.oauth2) {
          resolve();
        } else if (attempts > 20) {
          reject(new Error('Google SDK failed to load. Check your internet connection.'));
        } else {
          setTimeout(check, 200);
        }
      };
      check();
    });
  }

  loginWithGoogle(role: 'freelancer' | 'client' = 'freelancer'): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        await this.waitForGoogle();

        const client = google.accounts.oauth2.initTokenClient({
          client_id: this.GOOGLE_CLIENT_ID,
          scope: 'email profile',
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.error) {
              reject(new Error('Google sign-in cancelled or failed.'));
              return;
            }

            try {
              // Get user info from Google
              const userInfoRes = await fetch(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                { headers: { Authorization: 'Bearer ' + tokenResponse.access_token } }
              );
              const userInfo = await userInfoRes.json();

              // Send to Flask
              const res = await this.http.post<AuthResponse>(
                `${this.API_URL}/google`,
               { access_token: tokenResponse.access_token, nom: userInfo.name, email: userInfo.email, google_id: userInfo.sub, role: role }
              ).toPromise();

              if (res) {
                await this.handleAuthSuccess(res);
                this.ngZone.run(() => {
                  this.router.navigate(['/dashboard'], { replaceUrl: true });
                });
              }
              resolve();
            } catch (err: any) {
              console.error('Google login error:', err);
              reject(new Error(err?.message || 'Google sign-in failed.'));
            }
          },
          error_callback: (err: any) => {
            // User closed popup - not really an error
            if (err?.type !== 'popup_closed') {
              reject(new Error('Google sign-in failed.'));
            } else {
              resolve(); // just closed popup, no error
            }
          }
        });

        client.requestAccessToken();
      } catch (err: any) {
        reject(err);
      }
    });
  }

  getProfile(): Observable<User> {
    return this.http.get<Record<string, unknown>>(`${this.API_URL}/profile`).pipe(
      map((raw) => this.normalizeUser(raw)),
      catchError(this.handleError)
    );
  }

  updateProfile(body: { nom?: string; telephone?: string; dateNaissance?: string | null }): Observable<{ message: string; user: User }> {
    return this.http
      .put<{ message: string; user: Record<string, unknown> }>(`${this.API_URL}/profile`, body)
      .pipe(
        concatMap((res) => {
          const u = this.normalizeUser(res.user);
          return from(this.persistUser(u)).pipe(map(() => ({ message: res.message, user: u })));
        }),
        catchError(this.handleError)
      );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http
      .put<{ message: string }>(`${this.API_URL}/password`, { currentPassword, newPassword })
      .pipe(catchError(this.handleError));
  }

  uploadAvatar(file: File): Observable<{ message: string; user: User }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<{ message: string; user: Record<string, unknown> }>(`${this.API_URL}/avatar`, formData)
      .pipe(
        concatMap((res) => {
          const u = this.normalizeUser(res.user);
          return from(this.persistUser(u)).pipe(map(() => ({ message: res.message, user: u })));
        }),
        catchError(this.handleError)
      );
  }

  private async persistUser(user: User) {
    await this.ensureStorageReady();
    await this.storage.set(this.USER_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  /** Refresh current user from API and local storage */
  refreshProfile(): Observable<User> {
    return this.getProfile().pipe(
      concatMap((u) => from(this.persistUser(u)).pipe(map(() => u))),
      catchError(this.handleError)
    );
  }

  private async handleAuthSuccess(res: AuthResponse) {
    await this.ensureStorageReady();
    await this.storage.set(this.TOKEN_KEY, res.token);
    const u = this.normalizeUser(res.user as unknown as Record<string, unknown>);
    await this.storage.set(this.USER_KEY, JSON.stringify(u));
    this.currentUserSubject.next(u);
  }

  async logout() {
    await this.ensureStorageReady();
    await this.storage.remove(this.TOKEN_KEY);
    await this.storage.remove(this.USER_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  async getToken(): Promise<string | null> {
    await this.ensureStorageReady();
    return await this.storage.get(this.TOKEN_KEY);
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  private handleError(error: unknown) {
    if (error instanceof HttpErrorResponse) {
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error.error instanceof ErrorEvent) {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.error && typeof error.error === 'object' && 'error' in error.error) {
        errorMessage = (error.error as { error: string }).error;
      } else {
        switch (error.status) {
          case 400: errorMessage = 'Invalid request.'; break;
          case 401: errorMessage = 'Invalid email or password.'; break;
          case 403: errorMessage = 'Account is not active.'; break;
          case 409: errorMessage = 'Email already registered.'; break;
          case 0:   errorMessage = 'Cannot connect to server.'; break;
          default:  errorMessage = 'Server error (' + error.status + ').'; break;
        }
      }
      return throwError(() => new Error(errorMessage));
    }
    if (error instanceof Error) {
      return throwError(() => error);
    }
    return throwError(() => new Error('An unexpected error occurred. Please try again.'));
  }
}