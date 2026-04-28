import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface Offer {
  _id: string;
  titre: string;
  description: string;
  budget: number;
  delai: number;
  datePublication?: string;
  clientId?: string | null;
}

export interface OfferListResponse {
  offres: Offer[];
}

export interface OfferMutationResponse {
  message: string;
  offre: Offer;
}

export interface CreateOfferPayload {
  titre: string;
  description: string;
  budget: number;
  delai: number;
}

@Injectable({ providedIn: 'root' })
export class OfferService {
  private readonly API_URL = 'http://127.0.0.1:5000/api/offers';

  constructor(private http: HttpClient) {}

  listOffers(): Observable<OfferListResponse> {
    return this.http.get<OfferListResponse>(this.API_URL).pipe(catchError(this.handleError));
  }

  getOffer(id: string): Observable<Offer> {
    return this.http.get<Offer>(`${this.API_URL}/${id}`).pipe(catchError(this.handleError));
  }

  createOffer(body: CreateOfferPayload): Observable<OfferMutationResponse> {
    return this.http.post<OfferMutationResponse>(this.API_URL, body).pipe(catchError(this.handleError));
  }

  updateOffer(id: string, body: Partial<CreateOfferPayload>): Observable<OfferMutationResponse> {
    return this.http.put<OfferMutationResponse>(`${this.API_URL}/${id}`, body).pipe(catchError(this.handleError));
  }

  deleteOffer(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_URL}/${id}`).pipe(catchError(this.handleError));
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
