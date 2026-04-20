import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { star } from 'ionicons/icons';
import { getDemoFreelancer, getGraphicDesignProposal, type StaticProposal } from '../../data/graphic-design-demo';

addIcons({ star });

@Component({
  selector: 'app-proposal-detail',
  templateUrl: './proposal-detail.page.html',
  styleUrls: ['./proposal-detail.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterLink],
})
export class ProposalDetailPage implements OnInit {
  proposal: StaticProposal | null = null;
  ownerName = '';
  ownerAvatarInitials = '';
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') || '';
    const p = getGraphicDesignProposal(id);
    if (!p) {
      this.loading = false;
      this.toastInvalid();
      return;
    }
    this.proposal = p;
    const owner = getDemoFreelancer(p.freelancerId);
    this.ownerName = owner?.name || 'Freelancer';
    this.ownerAvatarInitials = this.initials(owner?.name || 'F');
    this.loading = false;
  }

  private initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  private async toastInvalid() {
    const t = await this.toastCtrl.create({
      message: 'Proposal not found.',
      duration: 2200,
      color: 'danger',
      position: 'top',
    });
    await t.present();
    this.router.navigate(['/gigs/category/graphic-design']);
  }
}
