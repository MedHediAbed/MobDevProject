import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { Offer, OfferService } from '../../services/offer.service';

@Component({
  selector: 'app-offer-detail',
  templateUrl: './offer-detail.page.html',
  styleUrls: ['./offer-detail.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule],
})
export class OfferDetailPage implements OnInit {
  offer: Offer | null = null;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public auth: AuthService,
    private offerService: OfferService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/offers']);
      return;
    }
    this.offerService.getOffer(id).subscribe({
      next: (res) => {
        this.offer = res;
        this.loading = false;
      },
      error: async (err) => {
        this.loading = false;
        await this.toast(err.message);
        this.router.navigate(['/offers']);
      },
    });
  }

  get canSubmitProposal(): boolean {
    return !!this.offer && this.auth.currentUser?.role === 'freelancer';
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2200, color: 'danger', position: 'top' });
    await t.present();
  }
}
