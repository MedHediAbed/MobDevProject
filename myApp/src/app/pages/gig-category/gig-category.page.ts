import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { heart, heartOutline, star } from 'ionicons/icons';
import { Gig, GigService } from '../../services/gig.service';
import { GRAPHIC_DESIGN_PROPOSALS, type StaticProposal } from '../../data/graphic-design-demo';

addIcons({ heart, heartOutline, star });

const CATEGORY_MAP: Record<string, { title: string; defaultTag: string }> = {
  'graphic-design': { title: 'Graphic & Design', defaultTag: 'design' },
};

const FAVORITES_KEY = 'proposal_favorites_graphic_design';

@Component({
  selector: 'app-gig-category',
  templateUrl: './gig-category.page.html',
  styleUrls: ['./gig-category.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class GigCategoryPage implements OnInit {
  pageTitle = 'Gigs';
  gigs: Gig[] = [];
  staticProposals: StaticProposal[] = [];
  staticMode = false;
  tagFilter = '';
  loading = true;
  slug = '';
  private favoriteIds = new Set<string>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gigService: GigService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.slug = this.route.snapshot.paramMap.get('slug') || '';
    const meta = CATEGORY_MAP[this.slug];
    if (meta) {
      this.pageTitle = meta.title;
      this.tagFilter = meta.defaultTag;
    } else {
      this.pageTitle = this.slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    if (this.slug === 'graphic-design') {
      this.staticMode = true;
      this.staticProposals = GRAPHIC_DESIGN_PROPOSALS;
      this.loadFavorites();
      this.loading = false;
      return;
    }

    this.load();
  }

  private loadFavorites() {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      const arr: string[] = raw ? JSON.parse(raw) : [];
      this.favoriteIds = new Set(Array.isArray(arr) ? arr : []);
    } catch {
      this.favoriteIds = new Set();
    }
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

  openGig(id: string) {
    this.router.navigate(['/gigs', id]);
  }

  openProposal(id: string) {
    this.router.navigate(['/proposals', id]);
  }

  toggleFavorite(event: Event, id: string) {
    event.stopPropagation();
    if (this.favoriteIds.has(id)) {
      this.favoriteIds.delete(id);
    } else {
      this.favoriteIds.add(id);
    }
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...this.favoriteIds]));
  }

  isFavorite(id: string): boolean {
    return this.favoriteIds.has(id);
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2500, color: 'danger', position: 'top' });
    await t.present();
  }
}
