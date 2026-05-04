import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { ConversationService, ConversationSummary } from '../../services/conversation.service';

@Component({
  selector: 'app-conversations',
  templateUrl: './conversations.page.html',
  styleUrls: ['./conversations.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule],
})
export class ConversationsPage implements OnInit {
  items: ConversationSummary[] = [];
  loading = true;

  constructor(
    private conv: ConversationService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.conv.listConversations().subscribe({
      next: (res) => {
        this.items = res.conversations || [];
        this.loading = false;
      },
      error: async (err) => {
        this.loading = false;
        await this.toast(err.message);
      },
    });
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2200, color: 'danger', position: 'top' });
    await t.present();
  }
}
