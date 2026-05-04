import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { Offer, OfferService } from '../../services/offer.service';
import { ConversationService, NotificationItem } from '../../services/conversation.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule]
})
export class DashboardPage implements OnInit {

  popularServices: Array<{ title: string; image: string; categorySlug?: string }> = [
    {
      title: 'Graphic & Design',
      image: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=300&q=80',
      categorySlug: 'graphic-design',
    },
    {
      title: 'Video & Animation',
      image: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=300&q=80',
    },
    {
      title: 'Programming & Tech',
      image: 'https://images.unsplash.com/photo-1555099962-4199c345e5dd?w=300&q=80'
    },
    {
      title: 'Writing & Translation',
      image: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=300&q=80'
    },
    {
      title: 'Digital Marketing',
      image: 'https://images.unsplash.com/photo-1557838923-2985c318be48?w=300&q=80'
    }
  ];

  newestServices: Array<{ title: string; image: string; useAiArtistsBg?: boolean }> = [
    {
      title: 'AI Artists',
      image: 'https://images.unsplash.com/photo-1686191128892-3b37add4c844?w=400&q=80',
      useAiArtistsBg: true,
    },
    {
      title: 'Virtual Assistance',
      image: 'https://images.unsplash.com/photo-1587560699334-cc4ff634909a?w=400&q=80'
    },
    {
      title: 'Voice Over',
      image: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400&q=80'
    },
    {
      title: 'Social Media',
      image: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400&q=80'
    }
  ];

  myOffers: Offer[] = [];
  offersLoading = false;
  notifications: NotificationItem[] = [];
  notifLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private offerService: OfferService,
    private conversationService: ConversationService
  ) {}

  ngOnInit() {
    if (this.role === 'client') {
      this.loadMyOffers();
    }
    if (this.role === 'freelancer') {
      this.loadNotifications();
    }
  }

  loadMyOffers() {
    const uid = this.authService.currentUser?.id;
    if (!uid) return;
    this.offersLoading = true;
    this.offerService.listOffers().subscribe({
      next: (res) => {
        const all = res.offres || [];
        this.myOffers = all.filter((o) => o.clientId === uid);
        this.offersLoading = false;
      },
      error: () => {
        this.offersLoading = false;
      },
    });
  }

  loadNotifications() {
    this.notifLoading = true;
    this.conversationService.listNotifications().subscribe({
      next: (res) => {
        this.notifications = (res.notifications || []).slice(0, 8);
        this.notifLoading = false;
      },
      error: () => {
        this.notifLoading = false;
      },
    });
  }

  openNotification(n: NotificationItem) {
    if (!n.read) {
      this.conversationService.markNotificationRead(n._id).subscribe({ error: () => undefined });
    }
    if (n.conversationId) {
      this.router.navigate(['/conversations', n.conversationId]);
    } else {
      this.router.navigate(['/conversations']);
    }
  }

  get role() {
    return this.authService.currentUser?.role;
  }

  async logout() {
    await this.authService.logout();
  }

  goToProfile() {
    this.router.navigate(['/edit-profile']);
  }

  openPopularCategory(slug?: string) {
    if (!slug) {
      return;
    }
    this.router.navigate(['/gigs/category', slug]);
  }

  goToOffers() {
    this.router.navigate(['/offers']);
  }

  goToPurchases() {
    this.router.navigate(['/purchases']);
  }
}