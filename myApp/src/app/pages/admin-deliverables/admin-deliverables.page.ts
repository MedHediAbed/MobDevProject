import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { AdminDeliverableRow, ProposalService } from '../../services/proposal.service';

@Component({
  selector: 'app-admin-deliverables',
  templateUrl: './admin-deliverables.page.html',
  styleUrls: ['./admin-deliverables.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule],
})
export class AdminDeliverablesPage implements OnInit {
  readonly apiOrigin = 'http://127.0.0.1:5000';
  items: AdminDeliverableRow[] = [];
  loading = true;
  busyId: string | null = null;

  constructor(
    private proposalService: ProposalService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.proposalService.adminListDeliverables().subscribe({
      next: (res) => {
        this.items = res.items || [];
        this.loading = false;
      },
      error: async (err) => {
        this.loading = false;
        await this.toast(err.message);
      },
    });
  }

  validate(row: AdminDeliverableRow) {
    const id = row.proposal._id;
    this.busyId = id;
    this.proposalService.adminValidateProposal(id).subscribe({
      next: async () => {
        this.busyId = null;
        await this.toast('Validated — client notified to pay.', 'success');
        this.load();
      },
      error: async (err) => {
        this.busyId = null;
        await this.toast(err.message);
      },
    });
  }

  private async toast(message: string, color: string = 'danger') {
    const t = await this.toastCtrl.create({ message, duration: 2400, color, position: 'top' });
    await t.present();
  }
}
