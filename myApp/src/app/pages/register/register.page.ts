import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';

function strongPasswordValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value || '';
  const errors: any = {};
  if (value.length < 8)           errors['minlength'] = true;
  if (!/[A-Z]/.test(value))       errors['uppercase'] = true;
  if (!/[a-z]/.test(value))       errors['lowercase'] = true;
  if (!/[0-9]/.test(value))       errors['number']    = true;
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) errors['symbol'] = true;
  return Object.keys(errors).length ? errors : null;
}

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IonicModule]
})
export class RegisterPage implements OnInit {
  registerForm!: FormGroup;
  showPassword = false;
  isLoading = false;
  isGoogleLoading = false;
  showRolePicker = false;
  googleRole: 'freelancer' | 'client' = 'freelancer';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() { this.buildForm(); }

  ionViewWillEnter() {
    this.buildForm();
    this.showPassword = false;
    this.showRolePicker = false;
    this.googleRole = 'freelancer';
  }

  private buildForm() {
    this.registerForm = this.fb.group({
      name:     ['', [Validators.required, Validators.minLength(2)]],
      email:    ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, strongPasswordValidator]],
      role:     ['freelancer', Validators.required]
    });
  }

  get name()     { return this.registerForm.get('name')!; }
  get email()    { return this.registerForm.get('email')!; }
  get password() { return this.registerForm.get('password')!; }
  get role()     { return this.registerForm.get('role')!; }

  get pwValue()     { return this.password.value || ''; }
  get pwHasLength() { return this.pwValue.length >= 8; }
  get pwHasUpper()  { return /[A-Z]/.test(this.pwValue); }
  get pwHasLower()  { return /[a-z]/.test(this.pwValue); }
  get pwHasNumber() { return /[0-9]/.test(this.pwValue); }
  get pwHasSymbol() { return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(this.pwValue); }

  get pwStrength(): number {
    return [this.pwHasLength, this.pwHasUpper, this.pwHasLower, this.pwHasNumber, this.pwHasSymbol].filter(Boolean).length;
  }
  get pwStrengthLabel(): string {
    if (this.pwStrength <= 2) return 'Weak';
    if (this.pwStrength <= 4) return 'Fair';
    return 'Strong';
  }
  get pwStrengthColor(): string {
    if (this.pwStrength <= 2) return '#e53e3e';
    if (this.pwStrength <= 4) return '#f59e0b';
    return '#22c55e';
  }

  togglePassword() { this.showPassword = !this.showPassword; }
  selectRole(r: 'freelancer' | 'client') { this.registerForm.patchValue({ role: r }); }

  async onSubmit() {
    if (this.registerForm.invalid) { this.registerForm.markAllAsTouched(); return; }
    this.isLoading = true;
    this.authService.register(this.registerForm.value).subscribe({
      next: async () => {
        this.isLoading = false;
        await this.authService.logout();
        await this.showToast('Account created! Please sign in.', 'success');
        this.router.navigate(['/login'], { replaceUrl: true });
      },
      error: async (err) => {
        this.isLoading = false;
        await this.showToast(err.message, 'danger');
      }
    });
  }

  // Step 1 — show role picker
  openRolePicker() {
    this.showRolePicker = true;
    this.googleRole = 'freelancer';
  }

  // Step 2 — user picked role, now launch Google
  async confirmGoogleLogin() {
    this.isGoogleLoading = true;
    try {
      await this.authService.loginWithGoogle(this.googleRole);
    } catch (err: any) {
      await this.showToast(err.message || 'Google sign-in failed.', 'danger');
    } finally {
      this.isGoogleLoading = false;
      this.showRolePicker = false;
    }
  }

  async loginWithApple() {
    await this.showToast('Apple login coming soon', 'medium');
  }

  async loginWithFacebook() {
    await this.showToast('Facebook login coming soon', 'medium');
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message, duration: 2500, color, position: 'top'
    });
    await toast.present();
  }

  goToLogin() { this.router.navigate(['/login']); }
}