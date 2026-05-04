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
    path: 'freelancers',
    loadComponent: () => import('./pages/freelancer-list/freelancer-list.page').then(m => m.FreelancerListPage)
  },
  {
    path: 'freelancers/:id',
    loadComponent: () => import('./pages/freelancer-profile/freelancer-profile.page').then(m => m.FreelancerProfilePage)
  },
  {
    path: 'edit-profile',
    canActivate: [AuthGuard],
    loadComponent: () => import('./pages/edit-profile/edit-profile.page').then(m => m.EditProfilePage)
  },
  {
    path: 'faq',
    canActivate: [AuthGuard],
    loadComponent: () => import('./pages/faq/faq.page').then(m => m.FaqPage)
  },
  {
    path: 'gigs/category/:slug',
    loadComponent: () => import('./pages/gig-category/gig-category.page').then(m => m.GigCategoryPage)
  },
  {
    path: 'proposals/:id',
    loadComponent: () => import('./pages/proposal-detail/proposal-detail.page').then(m => m.ProposalDetailPage)
  },
  {
    path: 'marketplace',
    loadComponent: () => import('./pages/marketplace/marketplace.page').then(m => m.MarketplacePage)
  },
  {
    path: 'gigs',
    loadComponent: () => import('./pages/gig-list/gig-list.page').then(m => m.GigListPage)
  },
  {
    path: 'gigs/:id',
    loadComponent: () => import('./pages/gig-detail/gig-detail.page').then(m => m.GigDetailPage)
  },
  {
    path: 'create-gig',
    canActivate: [AuthGuard],
    loadComponent: () => import('./pages/create-gig/create-gig.page').then(m => m.CreateGigPage)
  },
  {
    path: 'my-proposals',
    redirectTo: 'conversations',
    pathMatch: 'full'
  },
  {
    path: 'submit-proposal/:offerId',
    canActivate: [AuthGuard],
    loadComponent: () => import('./pages/submit-proposal/submit-proposal.page').then(m => m.SubmitProposalPage)
  },
  {
    path: 'offers',
    canActivate: [AuthGuard],
    loadComponent: () => import('./pages/offers/offers.page').then(m => m.OffersPage)
  },
  {
    path: 'offers/:id',
    canActivate: [AuthGuard],
    loadComponent: () => import('./pages/offer-detail/offer-detail.page').then(m => m.OfferDetailPage)
  },
  {
    path: 'offers/:offerId/proposals',
    canActivate: [AuthGuard],
    loadComponent: () => import('./pages/offer-proposals/offer-proposals.page').then(m => m.OfferProposalsPage)
  },
  {
    path: 'conversations',
    canActivate: [AuthGuard],
    loadComponent: () => import('./pages/conversations/conversations.page').then(m => m.ConversationsPage)
  },
  {
    path: 'conversations/:id',
    canActivate: [AuthGuard],
    loadComponent: () => import('./pages/conversation-detail/conversation-detail.page').then(m => m.ConversationDetailPage)
  },
  {
    path: 'purchases',
    canActivate: [AuthGuard],
    loadComponent: () => import('./pages/purchases/purchases.page').then(m => m.PurchasesPage)
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
