import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, ToastController } from '@ionic/angular';
import { ConversationService, ConversationDetail, ConversationMessage } from '../../services/conversation.service';

@Component({
  selector: 'app-conversation-detail',
  templateUrl: './conversation-detail.page.html',
  styleUrls: ['./conversation-detail.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
})
export class ConversationDetailPage implements OnInit {
  id: string | null = null;
  detail: ConversationDetail | null = null;
  messages: ConversationMessage[] = [];
  draft = '';
  loading = true;
  sending = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private conv: ConversationService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id');
    if (!this.id) {
      this.router.navigate(['/conversations']);
      return;
    }
    this.conv.getConversation(this.id).subscribe({
      next: (d) => {
        this.detail = d;
        this.loadMessages();
      },
      error: async (err) => {
        this.loading = false;
        await this.toast(err.message);
        this.router.navigate(['/conversations']);
      },
    });
  }

  loadMessages() {
    if (!this.id) return;
    this.conv.listMessages(this.id).subscribe({
      next: (res) => {
        this.messages = res.messages || [];
        this.loading = false;
      },
      error: async (err) => {
        this.loading = false;
        await this.toast(err.message);
      },
    });
  }

  send() {
    const text = this.draft.trim();
    if (!text || !this.id || this.sending) return;
    this.sending = true;
    this.conv.sendMessage(this.id, text).subscribe({
      next: (res) => {
        this.messages = [...this.messages, res.msg];
        this.draft = '';
        this.sending = false;
      },
      error: async (err) => {
        this.sending = false;
        await this.toast(err.message);
      },
    });
  }

  labelFor(m: ConversationMessage): string {
    if (m.isMine && this.detail?.yourAlias) return this.detail.yourAlias;
    if (!m.isMine && this.detail?.otherPartyAlias) return this.detail.otherPartyAlias;
    return m.isMine ? 'You' : 'Partner';
  }

  private async toast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2200, color: 'danger', position: 'top' });
    await t.present();
  }
}
