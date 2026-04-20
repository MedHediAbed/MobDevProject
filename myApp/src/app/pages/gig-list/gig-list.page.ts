import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { Gig, GigService } from '../../services/gig.service';

@Component({
  selector: 'app-gig-list',
  templateUrl: './gig-list.page.html',
  styleUrls: ['./gig-list.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule],
})
export class GigListPage implements OnInit {
  gigs: Gig[] = [];
  tagFilter = '';
  loading = true;

  constructor(
    private gigService: GigService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    const tag = this.tagFilter.trim() || undefined;
    this.gigService.listGigs(tag).subscribe({
      next: (res) => {
        this.gigs = res.services || [];
        this.loading = false;
      },
      error: async (err) => {
        this.loading = false;
        await this.toast(err.message);
      },
    });
  }

  applyFilter() {
    this.load();
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2500, color: 'danger', position: 'top' });
    await t.present();
  }
}
