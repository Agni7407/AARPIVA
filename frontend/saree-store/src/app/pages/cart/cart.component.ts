import { Component, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/cart.service';
import { ApiService } from '../../core/api.service';


@Component({
  standalone:true,
  imports:[CommonModule,CurrencyPipe,RouterLink],
  template:`
    <section class="section">
      <div class="eyebrow">YOUR BAG</div>
      <h1>Ready when you are.</h1>

      <div *ngIf="cart.errorMessage" class="cart-error">{{cart.errorMessage}}</div>

      <div *ngIf="cart.ready && cart.items.length" class="cart">
        <div class="lines">
          <div class="line" *ngFor="let item of cart.items">
            <a class="image-link" [routerLink]="['/products', item.productId]">
              <img [src]="image(item.product)" [alt]="item.product.name" (error)="imageError($event)">
            </a>
            <div class="grow">
              <a class="product-link" [routerLink]="['/products', item.productId]">
                <h3>{{item.product.name}}</h3>
              </a>
              <p>{{cart.price(item.product)|currency:'INR':'symbol':'1.0-0'}}</p>
            </div>
            <div class="qty">
              <button type="button" (click)="cart.setQuantity(item.productId,item.quantity-1)">−</button>
              <span>{{item.quantity}}</span>
              <button type="button" [disabled]="item.quantity>=item.product.stock" (click)="cart.setQuantity(item.productId,item.quantity+1)">+</button>
            </div>
            <b>{{cart.price(item.product)*item.quantity|currency:'INR':'symbol':'1.0-0'}}</b>
            <button class="remove" type="button" (click)="cart.remove(item.productId)">×</button>
          </div>
        </div>

        <aside>
          <h2>Summary</h2>
          <p class="sum"><span>Subtotal</span><b>{{cart.subtotal|currency:'INR':'symbol':'1.0-0'}}</b></p>
          <p class="sum"><span>Shipping</span><b>{{shipping===0?'Free':(shipping|currency:'INR':'symbol':'1.0-0')}}</b></p>
          <hr>
          <p class="sum total"><span>Total</span><b>{{total|currency:'INR':'symbol':'1.0-0'}}</b></p>
          <button type="button" class="btn dark full" (click)="proceedToCheckout()">Proceed to Checkout</button>
        </aside>
      </div>

      <div *ngIf="cart.ready && !cart.items.length" class="empty">
        <p>Your bag is empty.</p>
        <a class="btn dark" routerLink="/products">Start shopping</a>
      </div>
    </section>
  `,
  styles:[`
    .section{padding:55px 7vw;min-height:650px}.section h1{font:600 48px 'Playfair Display'}.cart-error{margin:20px 0;padding:12px 14px;background:#fff4f4;border:1px solid #edc9c9;color:#8b2d2d;font-size:13px}.cart{display:grid;grid-template-columns:1.5fr .7fr;gap:30px;margin-top:35px}.line{display:flex;align-items:center;gap:18px;border-bottom:1px solid var(--line);padding:15px 0}.image-link{width:90px;height:90px;flex:0 0 auto}.line img{width:90px;height:90px;object-fit:cover;background:#f2e6de}.grow{flex:1}.product-link{color:inherit}.grow h3{margin:0}.grow p{margin:5px 0;color:var(--muted)}.qty{display:flex;border:1px solid var(--line)}.qty button,.qty span{border:0;background:#fff;width:34px;height:34px;display:grid;place-items:center}.qty button{cursor:pointer}.qty button:disabled{opacity:.3;cursor:not-allowed}.remove{border:0;background:none;font-size:22px;cursor:pointer}.cart aside{background:#faf7f2;padding:25px;height:max-content}.sum{display:flex;justify-content:space-between}.total{font-size:19px}.full{width:100%;display:block;text-align:center}.empty{padding:70px;text-align:center;color:var(--muted)}@media(max-width:800px){.cart{grid-template-columns:1fr}.line{flex-wrap:wrap}.grow{min-width:calc(100% - 110px)}.qty{margin-left:108px}}
  .section{max-width:1400px;margin:0 auto}.full{width:100%;display:flex;align-items:center;justify-content:center;min-height:52px;padding:0 18px}.btn{border:0;border-radius:2px;font-weight:700;cursor:pointer}@media(max-width:900px){.section{padding:45px 5vw}.cart{grid-template-columns:1fr}.cart aside{padding:20px}}@media(max-width:600px){.section{padding:35px 4vw}.section h1{font-size:34px}.line{display:grid;grid-template-columns:76px 1fr;gap:12px;align-items:start;position:relative;padding-right:30px}.image-link,.line img{width:76px;height:92px}.grow{min-width:0}.line>b{grid-column:2}.qty{grid-column:2;justify-self:start;margin:0}.remove{position:absolute;right:0;top:14px}.full{min-height:52px}}`]
})
export class CartComponent {
  cart=inject(CartService);
  api=inject(ApiService);
  router=inject(Router);
  deliveryCharge=99;
  freeDeliveryThreshold=1499;
  constructor(){
    this.api.deliverySettings().subscribe({next:s=>{this.deliveryCharge=s.deliveryCharge;this.freeDeliveryThreshold=s.freeDeliveryThreshold;}});
  }
  get shipping() {
    return this.cart.subtotal === 0 || this.cart.subtotal >= this.freeDeliveryThreshold ? 0 : this.deliveryCharge;
  }
  get total() {
    return this.cart.subtotal + this.shipping;
  }
  proceedToCheckout() {
    this.router.navigate(['/checkout']);
  }
  image(product:any){const src=product.images?.[0]||'/assets/demo/ivory-silk.jpg';return /^(https?:)?\/\//i.test(src)?src:(src.startsWith('/')?src:`/${src}`);}
  imageError(event:Event){const img=event.target as HTMLImageElement;if(!img.src.endsWith('/assets/demo/ivory-silk.jpg'))img.src='/assets/demo/ivory-silk.jpg';}
}
