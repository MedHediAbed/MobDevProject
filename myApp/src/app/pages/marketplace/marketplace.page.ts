import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

/** Static marketplace (kits, AI subscriptions, IT articles) — replace with live catalog later. */
@Component({
  selector: 'app-marketplace',
  templateUrl: './marketplace.page.html',
  styleUrls: ['./marketplace.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule],
})
export class MarketplacePage {
  readonly kits = [
    { title: 'ESP32 IoT lab kit', blurb: 'MCU board, sensors, breadboard, USB cable — starter build pack.', price: '189 DT' },
    { title: 'Raspberry Pi 5 desktop bundle', blurb: 'Board, case, active cooler, 32GB card, official PSU.', price: '649 DT' },
    { title: 'Soldering & bench bundle', blurb: 'Iron, tips, fume sponge, multimeter, jumper wires.', price: '265 DT' },
  ];

  readonly aiSubs = [
    { title: 'Vision API — dev tier', blurb: 'Monthly token pool for image tagging & OCR pipelines.', price: '99 DT / mo' },
    { title: 'LLM inference pack', blurb: 'Reserved throughput for chat + embeddings in your app.', price: '149 DT / mo' },
    { title: 'Speech kit add-on', blurb: 'STT + TTS minutes bundled for assistants & IVR.', price: '79 DT / mo' },
  ];

  readonly articles = [
    { title: 'Zero-trust checklist for small teams', blurb: 'PDF · 42 pages · identity, devices, logging.', price: '29 DT' },
    { title: 'MongoDB patterns for mobile backends', blurb: 'E-book · schemas, indexes, pagination.', price: '39 DT' },
    { title: 'Shipping Ionic + Capacitor to stores', blurb: 'Guide · pipelines, signing, crash basics.', price: '35 DT' },
  ];
}
