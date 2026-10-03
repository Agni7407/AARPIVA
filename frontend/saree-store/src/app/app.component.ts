import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { AuthService } from './core/auth.service';
import { ApiService } from './core/api.service';
import { CartService } from './core/cart.service';
import { Category } from './core/models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="topbar">FREE SHIPPING ON ORDERS ABOVE ₹1,499 <span>•</span> EASY RETURNS <span>•</span> SECURE UPI CHECKOUT</div>
    <header class="site-header">
      <button class="menu-toggle" type="button" (click)="mobileOpen=!mobileOpen" aria-label="Open menu">☰</button>
      <a routerLink="/" class="logo">AARPIVA<span>®</span></a>
      <nav class="main-nav">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">Home</a>
        <a routerLink="/products" routerLinkActive="active">Shop</a>
        <button *ngFor="let c of categories.slice(0,4)" type="button" class="nav-link" (click)="navigateToCategory(c.id)">{{c.name}}</button>
        <button type="button" class="nav-link" (click)="navigateToProducts({sort:'new'})">New In</button>
      </nav>
      <div class="header-actions">
        <button
          type="button"
          class="icon-action search-action"
          title="Search"
          (click)="openSearch()">
          <span class="search-icon">⌕</span>
          <span>Search</span>
        </button>
        <a routerLink="/cart" class="icon-action bag-action" title="Bag">
          <svg class="bag-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 8.5h13l-1 11h-11l-1-11Z"/><path d="M9 8.5V6a3 3 0 0 1 6 0v2.5"/></svg>
          <span>Bag {{cartCount ? '('+cartCount+')' : ''}}</span>
        </a>
        <a *ngIf="!auth.isLogged()" routerLink="/login" class="icon-action">◎<span>Login</span></a>
        <a *ngIf="auth.isLogged()" routerLink="/orders" class="icon-action">◎<span>Orders</span></a>
        <a *ngIf="auth.isAdmin()" routerLink="/admin" class="admin-link">Admin</a>
      </div>
    </header>

    <div class="mobile-menu" *ngIf="mobileOpen">
      <div class="mobile-menu-head"><strong>Shop AARPIVA</strong><button type="button" (click)="mobileOpen=false">×</button></div>
      <a routerLink="/" (click)="mobileOpen=false">Home</a>
      <a routerLink="/products" (click)="mobileOpen=false">Shop all</a>
      <button *ngFor="let c of categories" type="button" class="mobile-menu-link" (click)="navigateToCategory(c.id)">{{c.name}}</button>
      <a routerLink="/cart" (click)="mobileOpen=false">Bag ({{cartCount}})</a>
      <a *ngIf="auth.isLogged()" routerLink="/change-password" (click)="mobileOpen=false">Change password</a>
      <button *ngIf="auth.isLogged()" class="mobile-logout" type="button" (click)="logout()">Logout</button>
    </div>

    <main><router-outlet/></main>

    <footer class="site-footer">
      <div class="footer-top">
        <div class="footer-brand-block">
          <div class="footer-logo">AARPIVA</div>
          <p>Contemporary Indian wear for the moments that deserve a little more.</p>
        </div>

        <div class="footer-column">
          <h4>Help &amp; Support</h4>
          <a *ngIf="auth.isLogged()" routerLink="/orders">Track Order</a><a *ngIf="!auth.isLogged()" [routerLink]="['/login']" [queryParams]="{returnUrl:'/orders'}">Track Order</a>
          <a routerLink="/contact">Contact Us</a>
          <a href="mailto:aarpiva1801@gmail.com">Customer Support</a>
          <a href="tel:+917605805775">+91 76058 05775</a>
        </div>

        <div class="footer-column">
          <h4>Our Info</h4>
          <a routerLink="/">About AARPIVA</a>
          <a routerLink="/">Our Story</a>
          <a routerLink="/privacy-policy">Privacy Policy</a>
          <a routerLink="/terms-conditions">Terms &amp; Conditions</a>
        </div>

        <div class="footer-column">
          <h4>Account</h4>
          <a *ngIf="!auth.isLogged()" routerLink="/login">Login</a>
          <a *ngIf="auth.isLogged()" routerLink="/orders">My Orders</a>
          <a *ngIf="auth.isLogged()" routerLink="/change-password">Change Password</a>
          <button *ngIf="auth.isLogged()" type="button" class="footer-logout" (click)="logout()">Logout</button>
        </div>
      </div>
      <div class="footer-bottom"><span>© 2026 AARPIVA. Made for modern Indian wardrobes.</span><span>Razorpay • UPI • Cards</span></div>
    </footer>

    <nav class="mobile-bottom-nav">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">⌂<span>Home</span></a>
      <a routerLink="/products" routerLinkActive="active">⌕<span>Shop</span></a>
      <a routerLink="/cart" routerLinkActive="active" aria-label="Bag"><svg class="mobile-bag-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 8.5h13l-1 11h-11l-1-11Z"/><path d="M9 8.5V6a3 3 0 0 1 6 0v2.5"/></svg><span>Bag</span></a>
      <a *ngIf="auth.isLogged()" routerLink="/orders">◎<span>Account</span></a><a *ngIf="!auth.isLogged()" [routerLink]="['/login']" [queryParams]="{returnUrl:'/orders'}">◎<span>Account</span></a>
    </nav>
  `,
  styles: [`
    :host{display:block}.topbar{background:#111;color:#fff;text-align:center;padding:9px 12px;font-size:10px;letter-spacing:.18em}.topbar span{opacity:.5;margin:0 8px}.site-header{height:78px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:30px;padding:0 4vw;border-bottom:1px solid #ebe7e2;background:#fff;position:sticky;top:0;z-index:100}.logo{font-size:24px;font-weight:800;letter-spacing:.2em;white-space:nowrap}.logo span{font-size:8px;vertical-align:top;letter-spacing:0;margin-left:3px}.main-nav{display:flex;justify-content:center;gap:26px;font-size:13px;text-transform:uppercase;letter-spacing:.08em}.main-nav a,.main-nav .nav-link{padding:30px 0 26px;position:relative}.main-nav .nav-link{border:0;background:none;font:inherit;text-transform:uppercase;letter-spacing:.08em;color:inherit;cursor:pointer}.main-nav a.active:after,.main-nav a:hover:after,.main-nav .nav-link:hover:after{content:'';position:absolute;left:0;right:0;bottom:18px;height:1px;background:#111;pointer-events:none}.header-actions{display:flex;align-items:center;gap:18px;font-size:12px}.icon-action{display:flex;align-items:center;gap:5px;border:0;background:none;padding:0;font:inherit;color:inherit;cursor:pointer;text-decoration:none}.search-action:hover{opacity:.65}.search-icon{font-size:20px;line-height:1}.bag-icon{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.mobile-bag-icon{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.icon-action:first-letter{font-size:20px}.admin-link{padding:8px 10px;border:1px solid #111}.menu-toggle{display:none;border:0;background:none;font-size:24px}.mobile-menu{position:fixed;inset:0 0 auto 0;background:#fff;z-index:200;padding:22px 6vw;box-shadow:0 10px 30px rgba(0,0,0,.12)}.mobile-menu-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}.mobile-menu-head button{border:0;background:none;font-size:28px}.mobile-menu a,.mobile-menu-link,.mobile-logout{display:block;padding:15px 0;border-top:1px solid #eee;text-align:left;background:none;border-right:0;border-left:0;border-bottom:0;width:100%;font:inherit;cursor:pointer;color:inherit}.site-footer{background:#121212;color:#fff;padding:70px 5vw 25px}.footer-top{display:grid;grid-template-columns:2.3fr repeat(3,1fr);gap:55px}.footer-brand-block{max-width:520px}.footer-logo{font-size:28px;font-weight:800;letter-spacing:.18em}.footer-top p{color:#aaa;line-height:1.6;max-width:430px}.footer-top h4{font-size:11px;text-transform:uppercase;letter-spacing:.16em;margin:0 0 17px}.footer-top a{display:block;color:#c1c1c1;margin:12px 0;font-size:13px}.footer-logout{display:block;padding:0;margin:12px 0;border:0;background:none;color:#c1c1c1;font:inherit;font-size:13px;cursor:pointer;text-align:left}.footer-logout:hover{color:#fff}footer-bottom{border-top:1px solid #303030;margin-top:45px;padding-top:18px;color:#777;font-size:11px;display:flex;justify-content:space-between;gap:15px}.mobile-bottom-nav{display:none}
    @media(max-width:900px){.site-header{grid-template-columns:auto 1fr auto;height:66px;gap:12px;padding:0 4vw}.menu-toggle{display:block}.main-nav{display:none}.header-actions .icon-action span{display:none}.header-actions .icon-action{min-width:28px;min-height:28px;justify-content:center}.logo{font-size:20px;margin:auto}.site-footer{padding-bottom:90px}.footer-top{grid-template-columns:1fr 1fr;gap:35px}.footer-brand-block{grid-column:1/-1}.mobile-bottom-nav{display:flex;position:fixed;left:0;right:0;bottom:0;height:62px;background:#fff;border-top:1px solid #ddd;z-index:150;justify-content:space-around;padding-bottom:env(safe-area-inset-bottom)}.mobile-bottom-nav a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:20px;width:25%}.mobile-bottom-nav span{font-size:9px;text-transform:uppercase;letter-spacing:.1em}.mobile-bottom-nav .active{font-weight:700}}
    @media(max-width:550px){.topbar{font-size:8px;letter-spacing:.11em}.topbar span{margin:0 4px}.footer-top{grid-template-columns:1fr}.footer-bottom{flex-direction:column}.footer-top .footer-brand-block{grid-column:auto}}
  
    @media(max-width:700px){.site-header{padding:0 3vw}.header-actions{gap:10px}.admin-link{display:none}.logo{font-size:18px}.header-actions .icon-action{font-size:11px}.mobile-menu{padding:20px 5vw}}
    @media(max-width:420px){.topbar{font-size:7px}.site-header{gap:4px;padding:0 3vw}.menu-toggle{font-size:20px}.logo{font-size:15px;letter-spacing:.12em}.header-actions{gap:4px}.header-actions .icon-action{min-width:24px}.header-actions .search-action .search-icon{font-size:18px}.bag-icon{width:17px;height:17px}.mobile-bottom-nav{height:60px}}`]
})
export class AppComponent {
  auth = inject(AuthService);
  api = inject(ApiService);
  cart = inject(CartService);
  router = inject(Router);
  categories: Category[] = [];
  mobileOpen = false;
  get cartCount() { return this.cart.count; }
  constructor(){ this.api.categories().subscribe({next:x=>this.categories=x,error:()=>this.categories=[]}); }
  logout(){ this.auth.clear(); this.mobileOpen=false; this.router.navigateByUrl('/'); }
  navigateToProducts(queryParams?: Record<string, unknown>){
    this.mobileOpen=false;
    this.router.navigate(['/products'], { queryParams: queryParams ?? {} });
  }
  navigateToCategory(categoryId:number){
    this.navigateToProducts({ categoryId });
  }
  openSearch(){
    this.router.navigate(
      ['/products'],
      {
        queryParams: {
          searchMode: '1'
        }
      }
    );
  }
}
