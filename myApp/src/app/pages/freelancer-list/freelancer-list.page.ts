import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { FreelancerProfile, FreelancerService } from '../../services/freelancer.service';

@Component({
  selector: 'app-freelancer-list',
  templateUrl: './freelancer-list.page.html',
  styleUrls: ['./freelancer-list.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule],
})
export class FreelancerListPage implements OnInit {
  freelancers: FreelancerProfile[] = [];
  loading = true;

  constructor(
    private freelancerService: FreelancerService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.freelancerService.listFreelancers().subscribe({
      next: (res) => {
        this.freelancers = res.freelancers || [];
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
