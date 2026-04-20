import { Component } from '@angular/core';
import { ThemeService } from './services/theme.service';
import { NgIf } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';
import { IonApp, IonRouterOutlet, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  home,
  storefrontOutline,
  chatbubbleOutline,
  personCircle,
} from 'ionicons/icons';

addIcons({ home, storefrontOutline, chatbubbleOutline, personCircle });

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonApp, IonRouterOutlet, IonIcon, NgIf, RouterLink],
})
export class AppComponent {
  showBottomNav = false;

  constructor(
    private router: Router,
    _theme: ThemeService
  ) {
    const syncNav = () => {
      const path = this.router.url.split('?')[0];
      this.showBottomNav = path !== '/login' && path !== '/register';
    };
    syncNav();
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe(syncNav);
  }

  isNavActive(tab: 'home' | 'gigs' | 'chat' | 'profile'): boolean {
    const u = this.router.url.split('?')[0];
    switch (tab) {
      case 'home':
        return u === '/dashboard';
      case 'gigs':
        return u.startsWith('/gigs') || u.startsWith('/create-gig') || u.startsWith('/proposals');
      case 'chat':
        return u.startsWith('/my-proposals') || u.startsWith('/submit-proposal');
      case 'profile':
        return u.startsWith('/edit-profile') || u.startsWith('/freelancers') || u.startsWith('/faq');
      default:
        return false;
    }
  }
}
