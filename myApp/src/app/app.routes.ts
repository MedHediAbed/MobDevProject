import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.page').then(m => m.RegisterPage)
  },
  {
    path: 'dashboard',
    canActivate: [AuthGuard],
    loadComponent: () => import('./pages/dashboard/dashboard.page').then(m => m.DashboardPage)
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
