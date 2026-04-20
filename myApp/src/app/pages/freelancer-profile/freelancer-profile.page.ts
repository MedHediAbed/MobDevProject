import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  checkmarkCircle,
  chatbubbleOutline,
  documentTextOutline,
  openOutline,
  personCircleOutline,
  star,
} from 'ionicons/icons';
import { DemoFreelancerProfile, getDemoFreelancer, isDemoFreelancerId } from '../../data/graphic-design-demo';
import { FreelancerProfile, FreelancerService } from '../../services/freelancer.service';

addIcons({ checkmarkCircle, chatbubbleOutline, documentTextOutline, openOutline, personCircleOutline, star });

@Component({
  selector: 'app-freelancer-profile',
  templateUrl: './freelancer-profile.page.html',
  styleUrls: ['./freelancer-profile.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule],
})
export class FreelancerProfilePage implements OnInit {
  profile: FreelancerProfile | DemoFreelancerProfile | null = null;
  loading = true;
  isDemo = false;
  selectedTab: 'services' | 'products' | 'reviews' = 'services';
  readonly apiOrigin = 'http://127.0.0.1:5000';

  constructor(
    private route: ActivatedRoute,
    private freelancerService: FreelancerService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading = false;
      return;
    }
    if (isDemoFreelancerId(id)) {
      const d = getDemoFreelancer(id)!;
      this.profile = d;
      this.isDemo = true;
      this.selectedTab = d.products?.length ? 'products' : 'services';
      this.loading = false;
      return;
    }
    this.freelancerService.getFreelancer(id).subscribe({
      next: (p) => {
        this.profile = p;
        this.loading = false;
      },
      error: async (err) => {
        this.loading = false;
        await this.toast(err.message);
      },
    });
  }

  demoExtra(): DemoFreelancerProfile | null {
    return this.isDemo && this.profile ? (this.profile as DemoFreelancerProfile) : null;
  }

  initials(name?: string): string {
    if (!name?.trim()) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  cvHref(cvUrl: string): string {
    if (!cvUrl) return '#';
    if (cvUrl.startsWith('http')) return cvUrl;
    return `${this.apiOrigin}/${cvUrl.replace(/^\/+/, '')}`;
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2500, color: 'danger', position: 'top' });
    await t.present();
  }
}
