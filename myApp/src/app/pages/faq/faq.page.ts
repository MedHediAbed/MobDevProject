import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { FAQ_ITEMS } from '../../data/faq-content';

@Component({
  selector: 'app-faq',
  templateUrl: './faq.page.html',
  styleUrls: ['./faq.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule],
})
export class FaqPage {
  readonly items = FAQ_ITEMS;
}
