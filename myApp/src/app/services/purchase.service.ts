import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Produit } from './produit.service';

export interface Purchase {
  _id: string;
  clientId: string;
  produitId: string;
  dateAchat: string;
  produit?: Produit;
}

export interface PurchaseListResponse {
  purchases: Purchase[];
}

@Injectable({ providedIn: 'root' })
export class PurchaseService {
  private readonly API_URL = 'http://127.0.0.1:5000/api/purchases';

  constructor(private http: HttpClient) {}

  createPurchase(produitId: string): Observable<{ message: string; _id: string }> {
    return this.http.post<{ message: string; _id: string }>(this.API_URL, { produitId }).pipe(catchError(this.handleError));
  }

  listByUser(userId: string): Observable<PurchaseListResponse> {
    return this.http.get<PurchaseListResponse>(`${this.API_URL}/by-user/${userId}`).pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unexpected error occurred. Please try again.';
    if (error.error instanceof ErrorEvent) {
      errorMessage = 'Network error. Please check your connection.';
    } else if (error.error?.error) {
      errorMessage = error.error.error;
    } else {
      switch (error.status) {
        case 400:
          errorMessage = 'Invalid request.';
          break;
        case 401:
          errorMessage = 'Please sign in.';
          break;
        case 403:
          errorMessage = 'You do not have permission.';
          break;
        case 404:
          errorMessage = 'Not found.';
          break;
        case 0:
          errorMessage = 'Cannot connect to server.';
          break;
        default:
          errorMessage = 'Server error (' + error.status + ').';
      }
    }
    return throwError(() => new Error(errorMessage));
  }
}
