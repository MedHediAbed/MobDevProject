import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { Proposal, ProposalService } from '../../services/proposal.service';

@Component({
  selector: 'app-proposal-list',
  templateUrl: './proposal-list.page.html',
  styleUrls: ['./proposal-list.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule],
})
export class ProposalListPage implements OnInit {
  proposals: Proposal[] = [];
  loading = true;

  constructor(
    private auth: AuthService,
    private proposalService: ProposalService,
    private router: Router,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    const user = this.auth.currentUser;
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    if (user.role !== 'freelancer') {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
      return;
    }
    this.load(user.id);
  }

  load(freelancerId: string) {
    this.loading = true;
    this.proposalService.listByFreelancer(freelancerId).subscribe({
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

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2500, color: 'danger', position: 'top' });
    await t.present();
  }
}
