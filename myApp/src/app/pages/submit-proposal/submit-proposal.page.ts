import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { ProposalService } from '../../services/proposal.service';

@Component({
  selector: 'app-submit-proposal',
  templateUrl: './submit-proposal.page.html',
  styleUrls: ['./submit-proposal.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule],
})
export class SubmitProposalPage implements OnInit {
  offerId: string | null = null;
  amount: number | null = null;
  message = '';
  saving = false;

  constructor(
    private auth: AuthService,
    private proposalService: ProposalService,
    private route: ActivatedRoute,
    private router: Router,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    const user = this.auth.currentUser;
    if (!user || user.role !== 'freelancer') {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
      return;
    }
    this.offerId = this.route.snapshot.paramMap.get('offerId');
    if (!this.offerId) {
      this.router.navigate(['/dashboard']);
    }
  }

  submit() {
    if (!this.offerId || this.amount === null || !this.message.trim()) {
      this.toast('Amount and message are required.');
      return;
    }
    this.saving = true;
    this.proposalService
      .createProposal({
        offerId: this.offerId,
        amount: Number(this.amount),
        message: this.message.trim(),
      })
      .subscribe({
        next: async () => {
          this.saving = false;
          await this.toast('Proposal sent.', 'success');
          this.router.navigate(['/conversations']);
        },
        error: async (err) => {
          this.saving = false;
          await this.toast(err.message);
        },
      });
  }

  private async toast(message: string, color: string = 'danger') {
    const t = await this.toastCtrl.create({ message, duration: 2200, color, position: 'top' });
    await t.present();
  }
}
