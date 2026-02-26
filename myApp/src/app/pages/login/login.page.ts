import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IonicModule]
})
export class LoginPage implements OnInit {

  loginForm!: FormGroup;
  showPassword = false;
  isLoading = false;
  isGoogleLoading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  get email() { return this.loginForm.get('email')!; }
  get password() { return this.loginForm.get('password')!; }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;

    this.authService.login(this.loginForm.value).subscribe({
      next: async (res) => {
        this.isLoading = false;
        await this.showToast('Welcome ' + res.user.name, 'success');
        this.router.navigate(['/dashboard'], { replaceUrl: true });
      },
      error: async (err) => {
        this.isLoading = false;
        await this.showToast(err.message, 'danger');
      }
    });
  }

  async loginWithGoogle() {
    this.isGoogleLoading = true;
    try {
      await this.authService.loginWithGoogle();
    } catch (err: any) {
      await this.showToast(err.message || 'Google login failed', 'danger');
    } finally {
      this.isGoogleLoading = false;
    }
  }

  // TEMP placeholders
  async loginWithApple() {
    await this.showToast('Apple login not implemented yet', 'medium');
  }

  async loginWithFacebook() {
    await this.showToast('Facebook login not implemented yet', 'medium');
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'top'
    });
    await toast.present();
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
  goToRegister() {
    this.router.navigate(['/register']);
  }
}