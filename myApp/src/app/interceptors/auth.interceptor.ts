import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Do not wait on Ionic Storage for unauthenticated auth calls — getToken() can block
    // until storage is ready, which would freeze login/register/google forever.
    const url = request.url;
    const isPublicAuth =
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/register') ||
      url.includes('/api/auth/google');

    if (isPublicAuth) {
      return next.handle(request).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) {
            this.authService.logout();
          }
          return throwError(() => error);
        })
      );
    }

    return from(this.authService.getToken()).pipe(
      switchMap(token => {
        if (token) {
          request = request.clone({
            setHeaders: { Authorization: `Bearer ${token}` }
          });
        }
        return next.handle(request);
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.authService.logout();
        }
        return throwError(() => error);
      })
    );
  }
}
