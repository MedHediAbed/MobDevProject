import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface Produit {
  _id: string;
  nom: string;
  description: string;
  version?: string;
  license?: string;
  prix: number;
  fichierUrl?: string;
  statut: 'pending' | 'approved' | 'rejected';
  freelancerId: string;
  freelancerNom?: string;
}

export interface ProduitListResponse {
  produits: Produit[];
}

@Injectable({ providedIn: 'root' })
export class ProduitService {
  private readonly API_URL = 'http://127.0.0.1:5000/api/produits';

  constructor(private http: HttpClient) {}

  listProduits(statut = 'approved'): Observable<ProduitListResponse> {
    const params = new HttpParams().set('statut', statut);
    return this.http.get<ProduitListResponse>(this.API_URL, { params }).pipe(catchError(this.handleError));
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
