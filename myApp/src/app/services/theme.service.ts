import { Injectable } from '@angular/core';

const STORAGE_KEY = 'freelancehub_theme_dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  constructor() {
    this.apply(this.isDark());
  }

  isDark(): boolean {
    return localStorage.getItem(STORAGE_KEY) === '1';
  }

  setDark(value: boolean): void {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    this.apply(value);
  }

  toggle(): void {
    this.setDark(!this.isDark());
  }

  private apply(dark: boolean): void {
    document.documentElement.classList.toggle('ion-palette-dark', dark);
  }
}
