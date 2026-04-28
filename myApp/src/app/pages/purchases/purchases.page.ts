import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { Produit, ProduitService } from '../../services/produit.service';
import { Purchase, PurchaseService } from '../../services/purchase.service';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-purchases',
  templateUrl: './purchases.page.html',
  styleUrls: ['./purchases.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule],
})
export class PurchasesPage implements OnInit {
  produits: Produit[] = [];
  purchases: Purchase[] = [];
  loadingProducts = true;
  loadingPurchases = true;
  buyingProductId: string | null = null;

  constructor(
    private auth: AuthService,
    private produitService: ProduitService,
    private purchaseService: PurchaseService,
    private router: Router,
    private toastCtrl: ToastController
  ) {}

  ngOnInit(): void {
    const user = this.auth.currentUser;
    if (!user || user.role !== 'client') {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
      return;
    }
    this.loadProducts();
    this.loadPurchases(user.id);
  }

  loadProducts() {
    this.loadingProducts = true;
    this.produitService.listProduits('approved').subscribe({
      next: (res) => {
        this.produits = res.produits || [];
        this.loadingProducts = false;
      },
      error: async (err) => {
        this.loadingProducts = false;
        await this.toast(err.message);
      },
    });
  }

  loadPurchases(userId: string) {
    this.loadingPurchases = true;
    this.purchaseService.listByUser(userId).subscribe({
      next: (res) => {
        this.purchases = res.purchases || [];
        this.loadingPurchases = false;
      },
      error: async (err) => {
        this.loadingPurchases = false;
        await this.toast(err.message);
      },
    });
  }

  buy(produitId: string) {
    const user = this.auth.currentUser;
    if (!user) return;
    this.buyingProductId = produitId;
    this.purchaseService.createPurchase(produitId).subscribe({
      next: async () => {
        this.buyingProductId = null;
        await this.toast('Purchase completed.', 'success');
        this.loadPurchases(user.id);
      },
      error: async (err) => {
        this.buyingProductId = null;
        await this.toast(err.message);
      },
    });
  }

  private async toast(message: string, color: string = 'danger') {
    const t = await this.toastCtrl.create({ message, duration: 2200, color, position: 'top' });
    await t.present();
  }
}
