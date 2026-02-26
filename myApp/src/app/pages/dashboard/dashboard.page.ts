import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
    <ion-header>
      <ion-toolbar color="dark">
        <ion-title>FreelanceHub</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="logout()">
            <ion-icon name="log-out-outline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding" style="--background:#0d0f14; color:#eef0f6;">
      <div style="text-align:center; padding-top: 60px;">
        <div style="font-size:48px;">🎉</div>
        <h2 style="color:#f5a623; font-family:Georgia,serif; margin-top:16px;">You're in!</h2>
        <p style="color:#6b7280;" *ngIf="user">
          Welcome, <strong style="color:#eef0f6;">{{ user.name }}</strong><br/>
          Role: <span style="color:#f5a623; text-transform:capitalize;">{{ user.role }}</span>
        </p>
      </div>
    </ion-content>
  `
})
export class DashboardPage implements OnInit {
  user: User | null = null;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.user = this.authService.currentUser;
  }

  async logout() {
    await this.authService.logout();
  }
}
