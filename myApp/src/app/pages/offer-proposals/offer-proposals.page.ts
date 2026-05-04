import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IonicModule, ToastController, AlertController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { Offer, OfferService } from '../../services/offer.service';
import { Proposal, ProposalService } from '../../services/proposal.service';

@Component({
  selector: 'app-offer-proposals',
  templateUrl: './offer-proposals.page.html',
  styleUrls: ['./offer-proposals.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule],
})
export class OfferProposalsPage implements OnInit {
  offerId: string | null = null;
  offer: Offer | null = null;
  proposals: Proposal[] = [];
  loading = true;
  busyId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public auth: AuthService,
    private offerService: OfferService,
    private proposalService: ProposalService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit(): void {
    if (this.auth.currentUser?.role !== 'client') {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
      return;
    }
    this.offerId = this.route.snapshot.paramMap.get('offerId');
    if (!this.offerId) {
      this.router.navigate(['/offers']);
      return;
    }
    this.offerService.getOffer(this.offerId).subscribe({
      next: (o) => {
        if (this.auth.currentUser?.id !== o.clientId) {
          this.toast('You can only review proposals for your own offers.');
          this.router.navigate(['/offers']);
          return;
        }
        this.offer = o;
        this.loadProposals();
      },
      error: async (err) => {
        this.loading = false;
        await this.toast(err.message);
        this.router.navigate(['/offers']);
      },
    });
  }

  loadProposals() {
    if (!this.offerId) return;
    this.loading = true;
    this.proposalService.listByOffer(this.offerId).subscribe({
      next: (res) => {
        this.proposals = res.proposals || [];
        this.loading = false;
      },
      error: async (err) => {
        this.loading = false;
        await this.toast(err.message);
      },
    });
  }

  async confirm(status: 'accepted' | 'rejected', p: Proposal) {
    const title = status === 'accepted' ? 'Accept proposal?' : 'Reject proposal?';
    const message =
      status === 'accepted'
        ? 'Other proposals for this offer will be rejected. The freelancer will be notified and an anonymous chat will open.'
        : 'The freelancer will see this proposal as rejected.';

    const alert = await this.alertCtrl.create({
      header: title,
      message,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: status === 'accepted' ? 'Accept' : 'Reject',
          role: status === 'accepted' ? 'confirm' : 'destructive',
          handler: () => this.applyStatus(p._id, status),
        },
      ],
    });
    await alert.present();
  }

  applyStatus(proposalId: string, status: 'accepted' | 'rejected') {
    this.busyId = proposalId;
    this.proposalService.updateProposalStatus(proposalId, { status }).subscribe({
      next: async (res) => {
        this.busyId = null;
        await this.toast(status === 'accepted' ? 'Proposal accepted.' : 'Proposal rejected.', 'success');
        this.loadProposals();
        if (status === 'accepted' && res.conversationId) {
          const a = await this.alertCtrl.create({
            header: 'Open conversation?',
            message: 'Chat with your partner using anonymous names only.',
            buttons: [
              { text: 'Later', role: 'cancel' },
              {
                text: 'Open messages',
                handler: () => {
                  this.router.navigate(['/conversations', res.conversationId]);
                },
              },
            ],
          });
          await a.present();
        }
      },
      error: async (err) => {
        this.busyId = null;
        await this.toast(err.message);
      },
    });
  }

  goMessages() {
    this.router.navigate(['/conversations']);
  }

  private async toast(message: string, color: string = 'danger') {
    const t = await this.toastCtrl.create({ message, duration: 2600, color, position: 'top' });
    await t.present();
  }
}
