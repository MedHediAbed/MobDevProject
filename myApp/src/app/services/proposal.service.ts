import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface AnonymousFreelancerProfile {
  displayName: string;
  jobSuccessRate: number;
  onTimeDeliveryRate: number;
  avgRating: number;
  completedProjects: number;
  memberSince?: string | null;
}

export interface Proposal {
  _id: string;
  offerId: string;
  freelancerId?: string;
  amount: number;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt?: string;
  freelancerNom?: string;
  anonymousFreelancer?: AnonymousFreelancerProfile;
  conversationId?: string;
  jobStatus?: string;
  deliverableText?: string;
  deliverableZipUrl?: string | null;
  deliverableZipOriginalName?: string | null;
  submittedAt?: string;
  adminValidated?: boolean;
  adminValidatedAt?: string;
  offerTitle?: string;
}

export interface ProposalListResponse {
  proposals: Proposal[];
}

export interface CreateProposalPayload {
  offerId: string;
  amount: number;
  message: string;
}

export interface CreateProposalResponse {
  message: string;
  proposal: Proposal;
}

export interface UpdateProposalStatusPayload {
  status: 'accepted' | 'rejected';
}

export interface UpdateProposalStatusResponse {
  message: string;
  proposal: Proposal;
  conversationId?: string;
}

export interface AdminDeliverableRow {
  proposal: Proposal;
  offerTitle: string;
}

@Injectable({ providedIn: 'root' })
export class ProposalService {
  private readonly API_URL = 'http://127.0.0.1:5000/api/proposals';
  private readonly API_BASE = 'http://127.0.0.1:5000/api';

  constructor(private http: HttpClient) {}

  createProposal(body: CreateProposalPayload): Observable<CreateProposalResponse> {
    return this.http.post<CreateProposalResponse>(`${this.API_URL}`, body).pipe(catchError(this.handleError));
  }

  listByOffer(offerId: string): Observable<ProposalListResponse> {
    return this.http
      .get<ProposalListResponse>(`${this.API_URL}/by-offer/${offerId}`)
      .pipe(catchError(this.handleError));
  }

  listByFreelancer(freelancerId: string): Observable<ProposalListResponse> {
    return this.http
      .get<ProposalListResponse>(`${this.API_URL}/by-freelancer/${freelancerId}`)
      .pipe(catchError(this.handleError));
  }

  updateProposalStatus(id: string, body: UpdateProposalStatusPayload): Observable<UpdateProposalStatusResponse> {
    return this.http
      .put<UpdateProposalStatusResponse>(`${this.API_URL}/${id}/status`, body)
      .pipe(catchError(this.handleError));
  }

  getProposal(id: string): Observable<Proposal> {
    return this.http.get<Proposal>(`${this.API_URL}/${id}`).pipe(catchError(this.handleError));
  }

  submitWork(
    proposalId: string,
    deliverableText: string,
    zipFile?: File | null
  ): Observable<{ message: string; proposal: Proposal }> {
    if (zipFile) {
      const fd = new FormData();
      fd.append('deliverableText', deliverableText || '');
      fd.append('file', zipFile, zipFile.name);
      return this.http
        .post<{ message: string; proposal: Proposal }>(`${this.API_URL}/${proposalId}/submit-work`, fd)
        .pipe(catchError(this.handleError));
    }
    return this.http
      .post<{ message: string; proposal: Proposal }>(`${this.API_URL}/${proposalId}/submit-work`, {
        deliverableText,
      })
      .pipe(catchError(this.handleError));
  }

  ackMvpPayment(proposalId: string): Observable<{ message: string }> {
    return this.http
      .post<{ message: string }>(`${this.API_URL}/${proposalId}/ack-mvp-payment`, {})
      .pipe(catchError(this.handleError));
  }

  adminListDeliverables(): Observable<{ items: AdminDeliverableRow[] }> {
    return this.http
      .get<{ items: AdminDeliverableRow[] }>(`${this.API_BASE}/admin/deliverables`)
      .pipe(catchError(this.handleError));
  }

  adminValidateProposal(proposalId: string): Observable<{ message: string; proposal: Proposal }> {
    return this.http
      .post<{ message: string; proposal: Proposal }>(`${this.API_URL}/${proposalId}/admin-validate`, {})
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
