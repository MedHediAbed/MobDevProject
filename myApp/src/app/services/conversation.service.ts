import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface ConversationSummary {
  _id: string;
  offerTitle: string;
  otherPartyAlias: string;
  proposalId?: string;
  offerId?: string;
  createdAt?: string;
}

export interface ConversationDetail {
  _id: string;
  offerTitle: string;
  offerId?: string;
  proposalId?: string;
  youAre: 'client' | 'freelancer';
  yourAlias?: string;
  otherPartyAlias?: string;
  createdAt?: string;
}

export interface ConversationMessage {
  _id: string;
  senderRole: string;
  isMine: boolean;
  body: string;
  createdAt?: string;
}

export interface NotificationItem {
  _id: string;
  type?: string;
  title?: string;
  body?: string;
  read: boolean;
  proposalId?: string;
  offerId?: string;
  conversationId?: string;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class ConversationService {
  private readonly BASE = 'http://127.0.0.1:5000/api';

  constructor(private http: HttpClient) {}

  listConversations(): Observable<{ conversations: ConversationSummary[] }> {
    return this.http
      .get<{ conversations: ConversationSummary[] }>(`${this.BASE}/conversations`)
      .pipe(catchError(this.handleError));
  }

  getConversation(id: string): Observable<ConversationDetail> {
    return this.http.get<ConversationDetail>(`${this.BASE}/conversations/${id}`).pipe(catchError(this.handleError));
  }

  listMessages(conversationId: string): Observable<{ messages: ConversationMessage[] }> {
    return this.http
      .get<{ messages: ConversationMessage[] }>(`${this.BASE}/conversations/${conversationId}/messages`)
      .pipe(catchError(this.handleError));
  }

  sendMessage(conversationId: string, body: string): Observable<{ message: string; msg: ConversationMessage }> {
    return this.http
      .post<{ message: string; msg: ConversationMessage }>(`${this.BASE}/conversations/${conversationId}/messages`, {
        body,
      })
      .pipe(catchError(this.handleError));
  }

  listNotifications(): Observable<{ notifications: NotificationItem[] }> {
    return this.http
      .get<{ notifications: NotificationItem[] }>(`${this.BASE}/notifications`)
      .pipe(catchError(this.handleError));
  }

  markNotificationRead(id: string): Observable<{ message: string }> {
    return this.http
      .put<{ message: string }>(`${this.BASE}/notifications/${id}/read`, {})
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    let msg = 'Request failed.';
    if (error.error?.error) msg = error.error.error;
    else if (error.status === 401) msg = 'Please sign in.';
    else if (error.status === 403) msg = 'Not allowed.';
    return throwError(() => new Error(msg));
  }
}
