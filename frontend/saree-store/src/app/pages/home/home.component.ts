import { Component, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Product, Category } from '../../core/models';
import { CartService } from '../../core/cart.service';

@Component({
  standalone:true,
  imports:[CommonModule,RouterLink,CurrencyPipe],
  template:`
    <section class="hero-shell">
      <div class="hero-copy">
        <div class="eyebrow">THE FESTIVE EDIT · 2026</div>
        <h1>Indian craft,<br><span>reimagined.</span></h1>
        <p>Statement sarees, elevated kurties and timeless details—curated for celebrations, gifting and everything in between.</p>
        <div class="hero-actions"><a class="btn-black" routerLink="/products">SHOP NEW IN</a><a class="text-link" routerLink="/products">EXPLORE COLLECTION →</a></div>
      </div>
      <div class="hero-visual">
        <img src="/assets/demo/ivory-silk.jpg" alt="Ivory silk saree" class="hero-main-image">
        <div class="hero-stamp">CRAFTED<br>IN INDIA</div>
        <div class="hero-mini"><img src="/assets/demo/maroon-banarasi.jpg" alt="Maroon Banarasi saree"><span>Hand-finished textures</span></div>
      </div>
    </section>

    <section class="ticker"><span>NEW DROP EVERY FRIDAY</span><span>DESIGNED FOR THE MODERN INDIAN WARDROBE</span><span>UPI · CARDS · SECURE CHECKOUT</span></section>

    <section class="section category-section">
      <div class="section-head"><div><div class="eyebrow">SHOP THE MOOD</div><h2>Categories</h2></div><a routerLink="/products">VIEW ALL →</a></div>
      <div class="category-grid">
        <a *ngFor="let c of categories.slice(0,4); let i=index" href="/products" (click)="openCategory(c.id,$event)" class="category-card">
          <img *ngIf="c.imageUrl; else categoryPlaceholder" [src]="c.imageUrl" [alt]="c.name" (error)="categoryImageError(c)"><div class="category-overlay"><span>{{('0'+(i+1)).slice(-2)}}</span><h3>{{c.name}}</h3><b>SHOP NOW →</b></div>
          <ng-template #categoryPlaceholder><div class="category-image-placeholder" aria-hidden="true"></div></ng-template>
        </a>
      </div>
    </section>

    <section class="full-bleed-banner"><img src="/assets/demo/sage-linen.jpg" alt="Sage linen saree"><div><div class="eyebrow">EVERYDAY ELEGANCE</div><h2>Quietly bold.<br>Beautifully Indian.</h2><a class="btn-white" routerLink="/products">DISCOVER THE EDIT</a></div></section>

    <section class="section products-section">
      <div class="section-head"><div><div class="eyebrow">JUST LANDED</div><h2>New arrivals</h2><p>Fresh silhouettes and colours, ready for your next occasion.</p></div><a routerLink="/products">SHOP ALL →</a></div>
      <div class="product-grid" *ngIf="products.length">
        <article class="product-card" *ngFor="let p of products.slice(0,6); let i=index">
          <a class="product-card-link" [routerLink]="['/products',p.id]">
            <div class="image-wrap"><img [src]="productImage(p,i)" [alt]="p.name" (error)="imageError($event)"><span class="badge" *ngIf="p.discountPrice">SALE</span></div>
            <div class="product-info"><div><h3>{{p.name}}</h3><small>{{p.categoryName || 'AARPIVA'}}</small></div><div class="price"><b>{{p.discountPrice ?? p.price | currency:'INR':'symbol':'1.0-0'}}</b><del *ngIf="p.discountPrice">{{p.price | currency:'INR':'symbol':'1.0-0'}}</del></div></div>
          </a>
          <button type="button" class="heart" aria-label="Wishlist">♡</button>
          <button type="button" class="mini-add" [disabled]="!p.stock" (click)="addToBag(p,$event)">{{p.stock?'ADD TO BAG':'OUT OF STOCK'}}</button>
        </article>
      </div>
      <div class="empty-products" *ngIf="!products.length">
        <p>Our next collection is being prepared.</p>
        <a class="text-link" routerLink="/products">VIEW THE SHOP →</a>
      </div>
    </section>

    <section class="editorial-section"><div class="editorial-copy"><div class="eyebrow">FROM LOOM TO LOOK</div><h2>The details are the story.</h2><p>We pair familiar Indian textures with clean, modern compositions. Think rich borders, softened palettes and pieces that feel special without feeling precious.</p><a class="text-link" routerLink="/products">MEET THE COLLECTION →</a></div><div class="editorial-images"><img src="/assets/demo/royal-blue.jpg" alt="Royal blue saree"><img src="/assets/demo/mustard-weave.jpg" alt="Mustard saree"></div></section>

    <section class="promise-strip"><div><strong>Thoughtful materials</strong><span>Curated fabrics and finish</span></div><div><strong>Fast dispatch</strong><span>Ready-to-ship pieces marked clearly</span></div><div><strong>Secure checkout</strong><span>Razorpay · UPI · Cards</span></div><div><strong>Human support</strong><span>Mon–Sat, 10 AM–6 PM</span></div></section>
  `,
  styles:[`
    .category-image-placeholder{position:absolute;inset:0;background:#e7e3de}
    .hero-shell{display:grid;grid-template-columns:1fr 1.05fr;min-height:690px;background:#f1eee8}.hero-copy{padding:110px 7vw 90px;display:flex;flex-direction:column;justify-content:center}.eyebrow{font-size:10px;letter-spacing:.2em;font-weight:800;text-transform:uppercase;color:#6c675e}.hero-copy h1{font-size:76px;line-height:.95;letter-spacing:-.04em;margin:20px 0}.hero-copy h1 span{font-family:Georgia,serif;font-weight:400;font-style:italic}.hero-copy p{max-width:520px;color:#5f5a54;font-size:17px;line-height:1.7}.hero-actions{display:flex;gap:24px;align-items:center;margin-top:30px}.btn-black,.btn-white{display:inline-block;padding:15px 20px;font-size:11px;letter-spacing:.12em;font-weight:800}.btn-black{background:#111;color:#fff}.btn-white{background:#fff;color:#111}.text-link{font-size:11px;letter-spacing:.14em;font-weight:800}.hero-visual{position:relative;overflow:hidden}.hero-main-image{position:absolute;inset:30px 7vw 0 4vw;width:calc(100% - 11vw);height:calc(100% - 30px);object-fit:cover}.hero-stamp{position:absolute;right:5%;top:11%;width:98px;height:98px;border:1px solid rgba(255,255,255,.8);color:#fff;border-radius:50%;display:grid;place-items:center;text-align:center;font-size:9px;letter-spacing:.18em;backdrop-filter:blur(2px)}.hero-mini{position:absolute;right:9%;bottom:7%;width:145px;background:#fff;padding:7px 7px 11px;box-shadow:0 14px 40px rgba(0,0,0,.15)}.hero-mini img{width:100%;height:132px;object-fit:cover;display:block}.hero-mini span{display:block;font-size:9px;letter-spacing:.1em;text-transform:uppercase;margin-top:9px}.ticker{display:flex;justify-content:space-around;gap:18px;flex-wrap:wrap;padding:14px 5vw;border-bottom:1px solid #ddd;border-top:1px solid #ddd;font-size:9px;letter-spacing:.18em}.section{padding:80px 5vw}.section-head{display:flex;justify-content:space-between;align-items:end;margin-bottom:28px}.section-head h2{font-size:46px;letter-spacing:-.04em;margin:10px 0 0}.section-head p{color:#777;margin:8px 0 0}.category-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;width:100%}.category-card{position:relative;display:block;min-width:0;aspect-ratio:3/4;overflow:hidden;background:#eee}.category-card img{width:100%;height:100%;object-fit:cover;transition:transform .5s}.category-card:hover img{transform:scale(1.04)}.category-overlay{position:absolute;inset:auto 0 0;padding:30px 22px 22px;color:#fff;background:linear-gradient(transparent,rgba(0,0,0,.72));display:flex;flex-direction:column;gap:6px}.category-overlay span{font-size:9px;letter-spacing:.14em}.category-overlay h3{font-size:27px;margin:0;font-family:Georgia,serif;font-weight:400}.category-overlay b{font-size:9px;letter-spacing:.14em}.full-bleed-banner{min-height:520px;position:relative;display:flex;align-items:center;overflow:hidden;background:#111;color:#fff}.full-bleed-banner img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(.66);object-position:center 32%}.full-bleed-banner>div{position:relative;z-index:1;padding:80px 9vw}.full-bleed-banner h2{font-size:64px;line-height:.98;letter-spacing:-.04em;margin:12px 0 28px}.products-section{background:#faf8f4}.product-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}.empty-products{padding:35px 20px;background:#fff;border:1px solid #e5e1db;color:#777;display:grid;gap:10px;justify-items:start}.product-card{position:relative;display:block;cursor:pointer}.product-card-link{display:block;color:inherit;text-decoration:none}.image-wrap{position:relative;aspect-ratio:3/4;overflow:hidden;background:#eee}.image-wrap img{width:100%;height:100%;object-fit:cover;transition:transform .5s}.product-card:hover .image-wrap img{transform:scale(1.03)}.badge{position:absolute;left:12px;top:12px;padding:6px 8px;background:#fff;font-size:8px;letter-spacing:.14em}.heart{position:absolute;right:10px;top:10px;z-index:3;border:0;background:#fff;width:34px;height:34px;border-radius:50%;font-size:18px;cursor:pointer}.mini-add{position:static;width:100%;display:flex;align-items:center;justify-content:center;margin-top:0;min-height:46px;border:1px solid #111;background:#111;color:#fff;padding:0 12px;font-size:9px;letter-spacing:.12em;font-weight:800;cursor:pointer;transition:background .2s,color .2s,opacity .2s}.mini-add:hover{background:#fff;color:#111}.mini-add:disabled{opacity:.5;cursor:not-allowed}.mini-add:disabled:hover{background:#111;color:#fff}.category-fallback{border:0;padding:0;text-align:left;font:inherit;color:inherit;cursor:pointer}.product-info{padding:13px 2px;display:flex;justify-content:space-between;gap:12px}.product-info h3{font-size:15px;margin:0 0 5px}.product-info small{color:#777;text-transform:uppercase;font-size:9px;letter-spacing:.1em}.price{display:flex;gap:7px;align-items:baseline;white-space:nowrap;font-size:13px}.price del{color:#999;font-size:11px}.editorial-section{padding:95px 7vw;display:grid;grid-template-columns:1fr 1.2fr;gap:70px;align-items:center}.editorial-copy h2{font:400 52px Georgia,serif;line-height:1.05;margin:14px 0 20px}.editorial-copy p{color:#6c665f;line-height:1.8;max-width:520px;margin-bottom:28px}.editorial-images{display:grid;grid-template-columns:1.15fr .85fr;gap:12px;align-items:end}.editorial-images img{width:100%;height:470px;object-fit:cover}.editorial-images img:last-child{height:350px}.promise-strip{border-top:1px solid #ddd;border-bottom:1px solid #ddd;display:grid;grid-template-columns:repeat(4,1fr)}.promise-strip div{padding:28px 24px;border-right:1px solid #ddd}.promise-strip div:last-child{border-right:0}.promise-strip strong{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.promise-strip span{display:block;color:#7b766f;font-size:11px;margin-top:7px}.demo-card{cursor:default}
    @media(max-width:1000px){.category-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.category-card{aspect-ratio:3/4}}@media(max-width:900px){.hero-shell{grid-template-columns:1fr;min-height:auto}.hero-copy{padding:65px 7vw 45px}.hero-copy h1{font-size:56px}.hero-visual{height:560px}.hero-main-image{inset:0 8vw 0 8vw;width:84%;height:100%}.product-grid{grid-template-columns:repeat(2,1fr)}.editorial-section{grid-template-columns:1fr;gap:30px}.promise-strip{grid-template-columns:1fr 1fr}.promise-strip div:nth-child(2){border-right:0}.promise-strip div:nth-child(-n+2){border-bottom:1px solid #ddd}.full-bleed-banner h2{font-size:48px}}
    @media(max-width:600px){.section{padding:55px 5vw}.section-head h2{font-size:34px}.section-head>a{font-size:9px}.hero-actions{flex-wrap:wrap}.hero-visual{height:470px}.hero-mini{right:6%;bottom:6%;width:125px}.hero-mini img{height:110px}.ticker{justify-content:center;text-align:center}.category-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.category-card{aspect-ratio:3/4}.category-overlay{padding:22px 14px 15px}.category-overlay h3{font-size:19px}.category-overlay b{font-size:8px}.product-grid{gap:15px}.product-info{display:block}.price{margin-top:5px}.full-bleed-banner{min-height:430px}.full-bleed-banner>div{padding:50px 7vw}.editorial-copy h2{font-size:40px}.editorial-images img{height:340px}.editorial-images img:last-child{height:250px}.promise-strip{grid-template-columns:1fr}.promise-strip div{border-right:0!important;border-bottom:1px solid #ddd!important}.promise-strip div:last-child{border-bottom:0!important}}
  @media(max-width:460px){.hero-shell{width:100%;overflow:hidden}.hero-copy h1{font-size:42px}.hero-copy p{font-size:14px}.hero-actions{gap:14px}.btn-black,.btn-white{padding:13px 15px;font-size:10px}.hero-visual{height:420px}.hero-stamp{width:76px;height:76px;font-size:7px}.section-head{align-items:flex-start;gap:20px}.section-head h2{font-size:30px}.category-overlay h3{font-size:17px}.product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.product-card{min-width:0}.image-wrap{aspect-ratio:2/2.55}.product-info h3{font-size:13px}.mini-add{min-height:44px;padding:0 10px}.editorial-section{padding:65px 5vw}.editorial-images{gap:8px}.editorial-images img{height:290px}.editorial-images img:last-child{height:220px}}`]
})
export class HomeComponent{
  api=inject(ApiService); cart=inject(CartService); router=inject(Router); categories:Category[]=[]; products:Product[]=[];
  constructor(){this.api.categories().subscribe({next:x=>this.categories=x,error:()=>this.categories=[]});this.api.products().subscribe({next:x=>this.products=x,error:()=>this.products=[]});}

  openCategory(categoryId:number, event?:Event){
    event?.preventDefault();
    this.router.navigate(['/products'], { queryParams: { categoryId } });
  }

  categoryImageError(category:Category){category.imageUrl=null;}
  productImage(p:Product,i:number){const src=p.images?.[0] || ['/assets/demo/ivory-silk.jpg','/assets/demo/maroon-banarasi.jpg','/assets/demo/sage-linen.jpg','/assets/demo/blush-organza.jpg','/assets/demo/royal-blue.jpg','/assets/demo/mustard-weave.jpg'][i%6];return this.resolveImage(src);}
  resolveImage(src:string){if(/^(https?:)?\/\//i.test(src))return src;return src.startsWith('/')?src:`/${src}`;}
  addToBag(p:Product,event:Event){event.preventDefault();event.stopPropagation();this.cart.add(p,1);}
  imageError(event:Event){const img=event.target as HTMLImageElement;if(!img.src.endsWith('/assets/demo/ivory-silk.jpg'))img.src='/assets/demo/ivory-silk.jpg';}
}
