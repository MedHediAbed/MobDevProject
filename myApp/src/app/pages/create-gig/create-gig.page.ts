import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { GigService } from '../../services/gig.service';

@Component({
  selector: 'app-create-gig',
  templateUrl: './create-gig.page.html',
  styleUrls: ['./create-gig.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule],
})
export class CreateGigPage implements OnInit {
  title = '';
  description = '';
  price: number | null = null;
  tagsInput = '';
  saving = false;
  loading = false;
  editId: string | null = null;

  constructor(
    private auth: AuthService,
    private gigService: GigService,
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
    this.editId = this.route.snapshot.queryParamMap.get('id');
    if (this.editId) {
      this.loading = true;
      this.gigService.getGig(this.editId).subscribe({
        next: (g) => {
          if (g.freelancerId !== user.id) {
            this.router.navigate(['/dashboard'], { replaceUrl: true });
            return;
          }
          this.title = g.title;
          this.description = g.description;
          this.price = g.price;
          this.tagsInput = (g.tags || []).join(', ');
          this.loading = false;
        },
        error: async () => {
          this.loading = false;
          await this.toast('Could not load gig.');
          this.router.navigate(['/gigs']);
        },
      });
    }
  }

  submit() {
    const user = this.auth.currentUser;
    if (!user) return;
    const tags = this.tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (!this.title.trim() || !this.description.trim() || this.price === null || !tags.length) {
      this.toast('Fill title, description, price, and at least one tag.');
      return;
    }

    this.saving = true;
    const payload = {
      title: this.title.trim(),
      description: this.description.trim(),
      price: Number(this.price),
      tags,
    };

    const req = this.editId
      ? this.gigService.updateGig(this.editId, payload)
      : this.gigService.createGig(payload);

    req.subscribe({
      next: async () => {
        this.saving = false;
        await this.toast(this.editId ? 'Gig updated.' : 'Gig created.', 'success');
        this.router.navigate(['/gigs']);
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
