import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';
import { addIcons } from 'ionicons';
import {
  camera,
  cardOutline,
  chatbubblesOutline,
  chevronForwardOutline,
  createOutline,
  keyOutline,
  logOutOutline,
  moonOutline,
  person,
} from 'ionicons/icons';
import { AuthService, User } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { FreelancerProfile, FreelancerService, PortfolioItem } from '../../services/freelancer.service';

addIcons({
  camera,
  cardOutline,
  chatbubblesOutline,
  chevronForwardOutline,
  createOutline,
  keyOutline,
  logOutOutline,
  moonOutline,
  person,
});

const PROFILE_ID_KEY = 'freelancer_profile_id';

@Component({
  selector: 'app-edit-profile',
  templateUrl: './edit-profile.page.html',
  styleUrls: ['./edit-profile.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, RouterModule],
})
export class EditProfilePage implements OnInit {
  user: User | null = null;
  displayName = '';
  readonly apiOrigin = 'http://127.0.0.1:5000';

  darkMode = false;
  uploadingAvatar = false;

  nameModalOpen = false;
  editNameValue = '';

  pwdModalOpen = false;
  currentPwd = '';
  newPwd = '';
  confirmPwd = '';
  savingPwd = false;

  generalModalOpen = false;
  phoneInput = '';
  dobIso = '';
  savingGeneral = false;

  /** Freelancer-only extended profile */
  profileId: string | null = null;
  bio = '';
  skillsInput = '';
  portfolio: PortfolioItem[] = [{ title: '', url: '' }];
  loadingFreelancer = true;
  saving = false;
  uploading = false;
  needsUpload = false;

  constructor(
    private auth: AuthService,
    private theme: ThemeService,
    private freelancerService: FreelancerService,
    private storage: Storage,
    private router: Router,
    private toastCtrl: ToastController
  ) {}

  private freelancerDataLoaded = false;

  async ngOnInit() {
    await this.storage.create();
    this.darkMode = this.theme.isDark();
    const u0 = this.auth.currentUser;
    if (u0) this.applyUser(u0);

    this.auth.refreshProfile().subscribe({
      next: (u) => {
        this.applyUser(u);
        if (u.role === 'freelancer') void this.ensureFreelancerLoaded();
        else this.loadingFreelancer = false;
      },
      error: () => {
        const u = this.auth.currentUser;
        if (u) this.applyUser(u);
        if (u?.role === 'freelancer') void this.ensureFreelancerLoaded();
        else this.loadingFreelancer = false;
      },
    });

    if (!u0) this.loadingFreelancer = false;
    else if (u0.role === 'freelancer') void this.ensureFreelancerLoaded();
    else this.loadingFreelancer = false;
  }

  private async ensureFreelancerLoaded() {
    if (this.freelancerDataLoaded) return;
    this.freelancerDataLoaded = true;
    await this.loadFreelancer();
  }

  private applyUser(u: User) {
    this.user = u;
    this.displayName = u.nom || '';
    this.phoneInput = u.telephone || '';
    this.dobIso = u.dateNaissance || '';
  }

  /** Max date for DOB picker (today, yyyy-MM-dd). */
  get maxDob(): string {
    return new Date().toISOString().split('T')[0];
  }

  avatarSrc(): string | null {
    const u = this.user;
    if (!u?.avatarUrl) return null;
    const path = u.avatarUrl;
    if (path.startsWith('http')) return path;
    return `${this.apiOrigin}/${path.replace(/^\/+/, '')}`;
  }

  canChangePassword(): boolean {
    return (this.user?.provider || 'local') === 'local';
  }

  onDarkToggle(ev: CustomEvent) {
    const checked = !!(ev.detail as { checked?: boolean }).checked;
    this.theme.setDark(checked);
    this.darkMode = checked;
  }

  openNameModal() {
    this.editNameValue = this.displayName;
    this.nameModalOpen = true;
  }

  closeNameModal() {
    this.nameModalOpen = false;
  }

  saveName() {
    const nom = this.editNameValue.trim();
    if (!nom) {
      this.toast('Please enter a name.');
      return;
    }
    this.auth.updateProfile({ nom }).subscribe({
      next: (res) => {
        this.displayName = res.user.nom;
        this.nameModalOpen = false;
        this.toast('Name updated.', 'success');
      },
      error: async (err) => this.toast(err.message),
    });
  }

  openPwdModal() {
    if (!this.canChangePassword()) {
      this.toast('Password change is not available for social sign-in accounts.');
      return;
    }
    this.currentPwd = '';
    this.newPwd = '';
    this.confirmPwd = '';
    this.pwdModalOpen = true;
  }

  closePwdModal() {
    this.pwdModalOpen = false;
  }

  savePassword() {
    if (this.newPwd !== this.confirmPwd) {
      this.toast('New passwords do not match.');
      return;
    }
    this.savingPwd = true;
    this.auth.changePassword(this.currentPwd, this.newPwd).subscribe({
      next: async () => {
        this.savingPwd = false;
        this.pwdModalOpen = false;
        await this.toast('Password updated.', 'success');
      },
      error: async (err) => {
        this.savingPwd = false;
        await this.toast(err.message);
      },
    });
  }

  openGeneralModal() {
    this.phoneInput = this.user?.telephone || '';
    this.dobIso = this.user?.dateNaissance || '';
    this.generalModalOpen = true;
  }

  closeGeneralModal() {
    this.generalModalOpen = false;
  }

  saveGeneral() {
    this.savingGeneral = true;
    const dateNaissance = this.dobIso?.trim() || null;
    this.auth
      .updateProfile({
        telephone: this.phoneInput.trim(),
        dateNaissance,
      })
      .subscribe({
        next: (res) => {
          this.savingGeneral = false;
          this.applyUser(res.user);
          this.generalModalOpen = false;
          this.toast('Information saved.', 'success');
        },
        error: async (err) => {
          this.savingGeneral = false;
          await this.toast(err.message);
        },
      });
  }

  onAvatarPick(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !file.type.startsWith('image/')) {
      this.toast('Please choose an image file.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      this.toast('Image must be under 4 MB.');
      return;
    }
    this.uploadingAvatar = true;
    this.auth.uploadAvatar(file).subscribe({
      next: async (res) => {
        this.uploadingAvatar = false;
        this.applyUser(res.user);
        await this.toast('Profile photo updated.', 'success');
      },
      error: async (err) => {
        this.uploadingAvatar = false;
        await this.toast(err.message);
      },
    });
  }

  async logout() {
    await this.auth.logout();
  }

  // ── Freelancer workspace (same page, below main settings) ──

  private async loadFreelancer() {
    this.loadingFreelancer = true;
    this.profileId = (await this.storage.get(PROFILE_ID_KEY)) || null;
    if (!this.profileId) {
      this.needsUpload = true;
      this.loadingFreelancer = false;
      return;
    }
    this.freelancerService.getFreelancer(this.profileId).subscribe({
      next: (p: FreelancerProfile) => {
        this.applyFreelancerProfile(p);
        this.needsUpload = false;
        this.loadingFreelancer = false;
      },
      error: async () => {
        await this.storage.remove(PROFILE_ID_KEY);
        this.profileId = null;
        this.needsUpload = true;
        this.loadingFreelancer = false;
      },
    });
  }

  private applyFreelancerProfile(p: FreelancerProfile) {
    this.bio = p.bio || '';
    this.skillsInput = (p.skills || []).join(', ');
    if (p.portfolio?.length) {
      this.portfolio = p.portfolio.map((x) => ({ title: x.title, url: x.url }));
    } else {
      this.portfolio = [{ title: '', url: '' }];
    }
  }

  addPortfolioRow() {
    this.portfolio.push({ title: '', url: '' });
  }

  removePortfolioRow(i: number) {
    if (this.portfolio.length > 1) {
      this.portfolio.splice(i, 1);
    }
  }

  async onCvSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      await this.toast('Please choose a PDF file.');
      return;
    }
    this.uploading = true;
    this.freelancerService.uploadCv(file).subscribe({
      next: async (res) => {
        this.uploading = false;
        this.profileId = res.profileId;
        await this.storage.set(PROFILE_ID_KEY, res.profileId);
        this.needsUpload = false;
        await this.toast('CV uploaded.', 'success');
        await this.loadFreelancer();
      },
      error: async (err) => {
        this.uploading = false;
        await this.toast(err.message);
      },
    });
  }

  saveFreelancer() {
    if (!this.profileId) {
      this.toast('Upload your CV first to create a freelancer profile.');
      return;
    }
    const skills = this.skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const portfolio = this.portfolio
      .filter((x) => x.title.trim() && x.url.trim())
      .map((x) => ({ title: x.title.trim(), url: x.url.trim() }));

    this.saving = true;
    this.freelancerService
      .updateFreelancer(this.profileId, { bio: this.bio, skills, portfolio })
      .subscribe({
        next: async () => {
          this.saving = false;
          await this.toast('Freelancer profile saved.', 'success');
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
