import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Storage } from '@ionic/storage-angular';
import { Router } from '@angular/router';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'freelancer' | 'client';
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

  constructor(
    private http: HttpClient,
    private storage: Storage,
    private router: Router,
    private ngZone: NgZone
  ) {
    this.initStorage();
  }

  private async initStorage() {
    await this.storage.create();
    await this.loadUserFromStorage();
  }

  private async loadUserFromStorage() {
    const user = await this.storage.get(this.USER_KEY);
    if (user) this.currentUserSubject.next(JSON.parse(user));
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/register`, payload).pipe(
      tap(async (res) => await this.handleAuthSuccess(res)),
      catchError(this.handleError)
    );
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, payload).pipe(
      tap(async (res) => await this.handleAuthSuccess(res)),
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
               { access_token: tokenResponse.access_token, name: userInfo.name, email: userInfo.email, google_id: userInfo.sub, role: role }
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
    return this.http.get<User>(`${this.API_URL}/profile`).pipe(
      catchError(this.handleError)
    );
  }

  private async handleAuthSuccess(res: AuthResponse) {
    await this.storage.set(this.TOKEN_KEY, res.token);
    await this.storage.set(this.USER_KEY, JSON.stringify(res.user));
    this.currentUserSubject.next(res.user);
  }

  async logout() {
    await this.storage.remove(this.TOKEN_KEY);
    await this.storage.remove(this.USER_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  async getToken(): Promise<string | null> {
    return await this.storage.get(this.TOKEN_KEY);
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unexpected error occurred. Please try again.';
    if (error.error instanceof ErrorEvent) {
      errorMessage = 'Network error. Please check your connection.';
    } else if (error.error?.error) {
      errorMessage = error.error.error;
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
}