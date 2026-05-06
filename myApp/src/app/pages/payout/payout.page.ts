import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { checkmarkCircle } from 'ionicons/icons';

addIcons({ checkmarkCircle });
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { ProposalService } from '../../services/proposal.service';

@Component({
  selector: 'app-payout',
  templateUrl: './payout.page.html',
  styleUrls: ['./payout.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule],
})
export class PayoutPage implements OnInit {
  proposalId: string | null = null;
  loading = true;
  errorMessage: string | null = null;
  offerTitle = '';
  amount = 0;
  cardName = '';
  cardNumber = '';
  expiry = '';
  cvc = '';
  paying = false;
  showSuccess = false;

  constructor(
    private auth: AuthService,
    private proposalService: ProposalService,
    private route: ActivatedRoute,
    private router: Router,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    const user = this.auth.currentUser;
    if (!user || user.role !== 'client') {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
      return;
    }
    this.proposalId = this.route.snapshot.paramMap.get('proposalId');
    if (!this.proposalId) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.proposalService.getProposal(this.proposalId).subscribe({
      next: (p) => {
        this.loading = false;
        if (!p.adminValidated) {
          this.errorMessage = 'This project is not ready for payment yet.';
          return;
        }
        this.offerTitle = p.offerTitle || '';
        this.amount = Number(p.amount) || 0;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.message || 'Could not load payment details.';
      },
    });
  }

  pay() {
    if (!this.proposalId) return;
    if (!this.cardName.trim() || !this.cardNumber.trim() || !this.expiry.trim() || !this.cvc.trim()) {
      this.toast('Fill in all card fields (demo only).');
      return;
    }
    this.paying = true;
    setTimeout(() => {
      this.proposalService.ackMvpPayment(this.proposalId!).subscribe({
        next: async () => {
          this.paying = false;
          this.showSuccess = true;
          await this.toast('Payment completed successfully.', 'success');
          setTimeout(() => {
            this.router.navigate(['/dashboard'], { replaceUrl: true });
          }, 2200);
        },
        error: async (err) => {
          this.paying = false;
          await this.toast(err.message);
        },
      });
    }, 600);
  }

  private async toast(message: string, color: string = 'danger') {
    const t = await this.toastCtrl.create({ message, duration: 2800, color, position: 'top' });
    await t.present();
  }
}
