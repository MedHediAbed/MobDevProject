import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { CreateOfferPayload, Offer, OfferService } from '../../services/offer.service';

@Component({
  selector: 'app-offers',
  templateUrl: './offers.page.html',
  styleUrls: ['./offers.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule],
})
export class OffersPage implements OnInit {
  offers: Offer[] = [];
  loading = true;
  saving = false;
  deletingId: string | null = null;
  editingId: string | null = null;

  titre = '';
  description = '';
  budget: number | null = null;
  delai: number | null = null;

  constructor(
    public auth: AuthService,
    private offerService: OfferService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get isClient(): boolean {
    return this.auth.currentUser?.role === 'client';
  }

  load() {
    this.loading = true;
    this.offerService.listOffers().subscribe({
      next: (res) => {
        this.offers = res.offres || [];
        this.loading = false;
      },
      error: async (err) => {
        this.loading = false;
        await this.toast(err.message);
      },
    });
  }

  startEdit(offer: Offer) {
    this.editingId = offer._id;
    this.titre = offer.titre;
    this.description = offer.description;
    this.budget = offer.budget;
    this.delai = offer.delai;
  }

  clearForm() {
    this.editingId = null;
    this.titre = '';
    this.description = '';
    this.budget = null;
    this.delai = null;
  }

  submit() {
    if (!this.isClient) return;
    if (!this.titre.trim() || !this.description.trim() || this.budget === null || this.delai === null) {
      this.toast('Please fill all fields.');
      return;
    }
    const payload: CreateOfferPayload = {
      titre: this.titre.trim(),
      description: this.description.trim(),
      budget: Number(this.budget),
      delai: Number(this.delai),
    };

    this.saving = true;
    const req = this.editingId
      ? this.offerService.updateOffer(this.editingId, payload)
      : this.offerService.createOffer(payload);
    req.subscribe({
      next: async () => {
        this.saving = false;
        await this.toast(this.editingId ? 'Offer updated.' : 'Offer created.', 'success');
        this.clearForm();
        this.load();
      },
      error: async (err) => {
        this.saving = false;
        await this.toast(err.message);
      },
    });
  }

  canManage(offer: Offer): boolean {
    return this.isClient && this.auth.currentUser?.id === offer.clientId;
  }

  remove(offer: Offer) {
    if (!this.canManage(offer)) return;
    this.deletingId = offer._id;
    this.offerService.deleteOffer(offer._id).subscribe({
      next: async () => {
        this.deletingId = null;
        await this.toast('Offer deleted.', 'success');
        this.load();
      },
      error: async (err) => {
        this.deletingId = null;
        await this.toast(err.message);
      },
    });
  }

  private async toast(message: string, color: string = 'danger') {
    const t = await this.toastCtrl.create({ message, duration: 2200, color, position: 'top' });
    await t.present();
  }
}
