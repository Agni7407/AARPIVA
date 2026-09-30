import { Component, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { CartService } from '../../core/cart.service';
import { Product } from '../../core/models';

@Component({
  standalone: true,
  imports: [CommonModule, CurrencyPipe, RouterLink],
  template: `
    <ng-container *ngIf="loading">
      <section class="state"><div class="loader"></div><p>Loading product…</p></section>
    </ng-container>

    <ng-container *ngIf="!loading && product as p">
      <section class="crumb">
        <a routerLink="/products">Shop</a><span>/</span>
        <a [routerLink]="['/products']" [queryParams]="p.categoryId ? {categoryId:p.categoryId} : null">{{p.categoryName}}</a>
        <span>/</span><strong>{{p.name}}</strong>
      </section>

      <section class="detail">
        <div class="gallery">
          <div class="main-img">
            <img [src]="mainImage(p)" [alt]="p.name" (error)="imageError($event)">
          </div>
          <div class="thumbs">
            <button *ngFor="let src of gallery(p);let i=index" [class.selected]="selectedImage===i" type="button" (click)="selectedImage=i">
              <img [src]="resolveImage(src)" [alt]="p.name" (error)="imageError($event)">
            </button>
          </div>
        </div>

        <div class="info">
          <div class="eyebrow">{{p.categoryName || 'AARPIVA Collection'}}</div>
          <h1>{{p.name}}</h1>
          <div class="price-line">
            <b>{{(p.discountPrice ?? p.price) | currency:'INR':'symbol':'1.0-0'}}</b>
            <del *ngIf="p.discountPrice">{{p.price | currency:'INR':'symbol':'1.0-0'}}</del>
            <span *ngIf="p.discountPrice" class="save">SALE</span>
          </div>

          <div class="copy"><p>{{p.description}}</p></div>
          <div class="availability"><span class="dot"></span>{{p.stock>0 ? 'In stock · '+p.stock+' pieces available' : 'Currently out of stock'}}</div>

          <div class="selector">
            <label>Quantity</label>
            <div class="qty">
              <button type="button" (click)="qty=Math.max(1,qty-1)">−</button>
              <span>{{qty}}</span>
              <button type="button" [disabled]="qty>=p.stock" (click)="qty=Math.min(p.stock,qty+1)">+</button>
            </div>
          </div>

          <div *ngIf="message" class="cart-message">{{message}}</div>
          <button class="buy" [disabled]="p.stock<1" type="button" (click)="add(p)">
            {{p.stock>0 ? 'ADD TO BAG' : 'OUT OF STOCK'}} <span>→</span>
          </button>

          <div class="accordions">
            <details open><summary>Product details</summary><p>Designed for easy elegance. Product care and fabric details can be maintained from the admin panel.</p></details>
            <details><summary>Shipping & returns</summary><p>Free shipping is currently available on orders above ₹1,499. Orders below that value have a ₹99 shipping charge.</p></details>
            <details><summary>Secure payments</summary><p>Razorpay supports UPI, cards and other available checkout methods.</p></details>
          </div>
        </div>
      </section>
    </ng-container>

    <section *ngIf="!loading && !product" class="state error-state">
      <h1>We couldn't find that product.</h1>
      <p>{{errorMessage}}</p>
      <a routerLink="/products" class="btn-dark">Back to shop</a>
    </section>
  `,
  styles: [`
    .state{min-height:500px;display:grid;place-items:center;align-content:center;gap:12px;padding:50px;text-align:center}.state p{color:#777;max-width:520px;line-height:1.6}.error-state h1{font:400 42px Georgia,serif;margin:0 0 8px}.btn-dark{display:inline-block;margin-top:10px;background:#111;color:#fff;padding:13px 18px;text-transform:uppercase;font-size:10px;letter-spacing:.12em;font-weight:800}.loader{width:30px;height:30px;border:2px solid #ddd;border-top-color:#111;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
    .crumb{padding:22px 5vw;border-bottom:1px solid #eee;color:#777;font-size:10px;letter-spacing:.08em;text-transform:uppercase}.crumb span{margin:0 8px}.crumb strong{color:#111}.detail{padding:45px 5vw 90px;display:grid;grid-template-columns:1.1fr .9fr;gap:65px}.main-img{aspect-ratio:3/4;background:#eee;overflow:hidden}.main-img img{width:100%;height:100%;object-fit:cover}.thumbs{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:10px}.thumbs button{padding:0;border:1px solid transparent;background:#eee;cursor:pointer;aspect-ratio:1/1.15;overflow:hidden}.thumbs button.selected{border-color:#111}.thumbs button:disabled{opacity:.5}.thumbs img{width:100%;height:100%;object-fit:cover}.info{padding:20px 0}.info h1{font:400 48px Georgia,serif;line-height:1.05;margin:15px 0}.price-line{display:flex;align-items:center;gap:10px}.price-line b{font-size:19px}.price-line del{color:#999}.save{background:#111;color:#fff;padding:5px 7px;font-size:8px;letter-spacing:.1em}.copy{border-top:1px solid #ddd;border-bottom:1px solid #ddd;margin:28px 0;padding:23px 0;color:#666;line-height:1.7}.availability{font-size:11px;text-transform:uppercase;letter-spacing:.12em;margin-bottom:25px}.dot{display:inline-block;width:7px;height:7px;background:#4f7a53;border-radius:50%;margin-right:8px}.selector{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #ddd;padding-bottom:20px}.selector label{font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:800}.qty{display:flex;border:1px solid #ccc}.qty button,.qty span{width:42px;height:40px;border:0;background:#fff;display:grid;place-items:center}.qty button{cursor:pointer;font-size:18px}.qty button:disabled{opacity:.3;cursor:not-allowed}.buy{margin-top:20px;width:100%;height:54px;background:#111;color:#fff;border:0;font-weight:800;letter-spacing:.13em;cursor:pointer}.buy span{float:right;margin-right:15px;font-size:18px}.buy:disabled{opacity:.5;cursor:not-allowed}.cart-message{margin-top:18px;padding:12px 14px;background:#edf7ef;border:1px solid #cfe5d3;color:#34543b;font-size:13px}.demo-note{margin-top:16px;padding:12px 14px;background:#faf7f2;color:#766f65;font-size:12px;line-height:1.55}.accordions{margin-top:20px}.accordions details{border-top:1px solid #ddd;padding:17px 0}.accordions details:last-child{border-bottom:1px solid #ddd}.accordions summary{cursor:pointer;font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:800}.accordions p{color:#666;line-height:1.6;font-size:13px;padding-right:30px}@media(max-width:900px){.detail{grid-template-columns:1fr;gap:25px;padding:25px 4vw 80px}.info{padding-top:0}.info h1{font-size:38px}.crumb{padding:15px 4vw}}
  @media(max-width:600px){.crumb{font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.detail{padding:16px 4vw 70px}.gallery{width:100%}.main-img{aspect-ratio:4/5}.thumbs{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.info h1{font-size:31px}.price-line{flex-wrap:wrap}.buy{height:auto;min-height:54px;padding:14px 16px}.selector{gap:16px}.accordions summary{font-size:10px}.accordions p{font-size:12px}.qty button,.qty span{width:38px;height:38px}}`]
})
export class ProductDetailComponent {
  Math = Math;
  api = inject(ApiService);
  route = inject(ActivatedRoute);
  router = inject(Router);
  cart = inject(CartService);
  product?: Product;
  qty = 1;
  selectedImage = 0;
  loading = true;
  errorMessage = 'The product may have been removed or the API may be unavailable.';
  message = '';

  constructor() {
    this.route.paramMap.subscribe(params => this.load(params.get('id')));
  }

  private load(id: string | null): void {
    this.loading = true;
    this.product = undefined;
    this.selectedImage = 0;
    this.message = '';

    const numericId = Number(id);
    if (!numericId) {
      this.errorMessage = 'The product link is invalid.';
      this.loading = false;
      return;
    }

    this.api.product(numericId).subscribe({
      next: product => {
        this.product = product;
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.errorMessage = err?.status === 404
          ? 'This product no longer exists.'
          : 'We could not load this product right now. Please try again.';
      }
    });
  }

  gallery(p: Product): string[] {
    const urls = p.images?.filter(Boolean) ?? [];
    if (urls.length) return urls;
    return ['/assets/demo/ivory-silk.jpg', '/assets/demo/maroon-banarasi.jpg', '/assets/demo/royal-blue.jpg'];
  }

  resolveImage(src: string): string {
    if (!src) return '/assets/demo/ivory-silk.jpg';
    if (/^(https?:)?\/\//i.test(src)) return src;
    return src.startsWith('/') ? src : `/${src}`;
  }

  mainImage(p: Product): string {
    const images = this.gallery(p);
    return this.resolveImage(images[Math.min(this.selectedImage, images.length - 1)] || '/assets/demo/ivory-silk.jpg');
  }

  add(p: Product): void {
    this.cart.add(p, this.qty);
    this.message = `${this.qty} ${this.qty === 1 ? 'item' : 'items'} added to your bag.`;
    setTimeout(() => this.message = '', 2200);
  }

  imageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img.src.endsWith('/assets/demo/ivory-silk.jpg')) return;
    img.src = '/assets/demo/ivory-silk.jpg';
  }
}
