import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface PortfolioItem {
  title: string;
  url: string;
}

export interface FreelancerProfile {
  _id: string;
  userId: string | null;
  name?: string;
  email?: string;
  bio: string;
  skills: string[];
  portfolio: PortfolioItem[];
  cvUrl: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  createdAt?: string;
}

export interface FreelancerListResponse {
  freelancers: FreelancerProfile[];
}

export interface UpdateFreelancerPayload {
  bio?: string;
  skills?: string[];
  portfolio?: PortfolioItem[];
}

export interface UpdateFreelancerResponse {
  message: string;
  profile: FreelancerProfile;
}

export interface UploadCvResponse {
  message: string;
  cvUrl: string;
  profileId: string;
}

@Injectable({ providedIn: 'root' })
export class FreelancerService {
  private readonly API_URL = 'http://127.0.0.1:5000/api/freelancers';

  constructor(private http: HttpClient) {}

  listFreelancers(): Observable<FreelancerListResponse> {
    return this.http.get<FreelancerListResponse>(`${this.API_URL}`).pipe(catchError(this.handleError));
  }

  getFreelancer(id: string): Observable<FreelancerProfile> {
    return this.http.get<FreelancerProfile>(`${this.API_URL}/${id}`).pipe(catchError(this.handleError));
  }

  updateFreelancer(id: string, body: UpdateFreelancerPayload): Observable<UpdateFreelancerResponse> {
    return this.http
      .put<UpdateFreelancerResponse>(`${this.API_URL}/${id}`, body)
      .pipe(catchError(this.handleError));
  }

  uploadCv(file: File): Observable<UploadCvResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<UploadCvResponse>(`${this.API_URL}/upload-cv`, formData).pipe(catchError(this.handleError));
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
