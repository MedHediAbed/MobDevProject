import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface Gig {
  _id: string;
  freelancerId: string;
  title: string;
  description: string;
  price: number;
  tags: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
  freelancerNom?: string;
}

export interface GigListResponse {
  services: Gig[];
}

export interface CreateGigPayload {
  title: string;
  description: string;
  price: number;
  tags: string[];
}

export interface GigMutationResponse {
  message: string;
  service: Gig;
}

export interface ValidateGigPayload {
  status: 'approved' | 'rejected';
}

@Injectable({ providedIn: 'root' })
export class GigService {
  private readonly API_URL = 'http://127.0.0.1:5000/api/services';

  constructor(private http: HttpClient) {}

  listGigs(tag?: string): Observable<GigListResponse> {
    let params = new HttpParams();
    if (tag?.trim()) {
      params = params.set('tag', tag.trim());
    }
    return this.http.get<GigListResponse>(`${this.API_URL}`, { params }).pipe(catchError(this.handleError));
  }

  getGig(id: string): Observable<Gig> {
    return this.http.get<Gig>(`${this.API_URL}/${id}`).pipe(catchError(this.handleError));
  }

  createGig(body: CreateGigPayload): Observable<GigMutationResponse> {
    return this.http.post<GigMutationResponse>(`${this.API_URL}`, body).pipe(catchError(this.handleError));
  }

  updateGig(id: string, body: Partial<CreateGigPayload>): Observable<GigMutationResponse> {
    return this.http.put<GigMutationResponse>(`${this.API_URL}/${id}`, body).pipe(catchError(this.handleError));
  }

  deleteGig(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_URL}/${id}`).pipe(catchError(this.handleError));
  }

  validateGig(id: string, body: ValidateGigPayload): Observable<{ message: string; status: string }> {
    return this.http
      .put<{ message: string; status: string }>(`${this.API_URL}/${id}/validate`, body)
      .pipe(catchError(this.handleError));
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
