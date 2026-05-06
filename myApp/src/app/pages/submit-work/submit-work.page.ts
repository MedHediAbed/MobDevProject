import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { cloudUploadOutline } from 'ionicons/icons';

addIcons({ cloudUploadOutline });
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { ProposalService } from '../../services/proposal.service';

@Component({
  selector: 'app-submit-work',
  templateUrl: './submit-work.page.html',
  styleUrls: ['./submit-work.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule],
})
export class SubmitWorkPage implements OnInit {
  proposalId: string | null = null;
  deliverableText = '';
  saving = false;
  loading = true;
  offerTitle = '';
  errorMessage: string | null = null;
  zipFile: File | null = null;
  zipName: string | null = null;
  dragActive = false;

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
    this.proposalId = this.route.snapshot.paramMap.get('proposalId');
    if (!this.proposalId) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.proposalService.getProposal(this.proposalId).subscribe({
      next: (p) => {
        this.loading = false;
        if (p.status !== 'accepted') {
          this.errorMessage = 'This proposal is not active.';
          return;
        }
        if (p.adminValidated) {
          this.errorMessage = 'This project has already been validated.';
          return;
        }
        this.offerTitle = p.offerTitle || '';
        if (p.deliverableText) {
          this.deliverableText = p.deliverableText;
        }
        if (p.deliverableZipOriginalName) {
          this.zipName = p.deliverableZipOriginalName;
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.message || 'Could not load proposal.';
      },
    });
  }

  onDragOver(ev: DragEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    this.dragActive = true;
  }

  onDragLeave(ev: DragEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    this.dragActive = false;
  }

  onDrop(ev: DragEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    this.dragActive = false;
    const f = ev.dataTransfer?.files?.[0];
    this.applyZipFile(f ?? null);
  }

  onFilePick(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    this.applyZipFile(f);
    input.value = '';
  }

  clearZip() {
    this.zipFile = null;
    this.zipName = null;
  }

  private applyZipFile(f: File | null) {
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (!lower.endsWith('.zip') && f.type !== 'application/zip' && f.type !== 'application/x-zip-compressed') {
      void this.toast('Please drop a .zip file.');
      return;
    }
    this.zipFile = f;
    this.zipName = f.name;
  }

  submit() {
    if (!this.proposalId) return;
    const text = this.deliverableText.trim();
    if (!text && !this.zipFile) {
      this.toast('Add a short description and/or attach a ZIP of your deliverables.');
      return;
    }
    this.saving = true;
    this.proposalService.submitWork(this.proposalId, text, this.zipFile).subscribe({
      next: async () => {
        this.saving = false;
        await this.toast('Work submitted for admin review.', 'success');
        this.router.navigate(['/dashboard'], { replaceUrl: true });
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
