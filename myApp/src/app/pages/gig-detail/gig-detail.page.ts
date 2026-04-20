import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { Gig, GigService } from '../../services/gig.service';

@Component({
  selector: 'app-gig-detail',
  templateUrl: './gig-detail.page.html',
  styleUrls: ['./gig-detail.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule],
})
export class GigDetailPage implements OnInit {
  gig: Gig | null = null;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private gigService: GigService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading = false;
      return;
    }
    this.gigService.getGig(id).subscribe({
      next: (g) => {
        this.gig = g;
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
