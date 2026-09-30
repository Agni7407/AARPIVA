import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { CartService } from '../../core/cart.service';
import { Product, Category } from '../../core/models';
import { FormsModule } from '@angular/forms';

@Component({
  standalone:true,
  imports:[CommonModule,RouterLink,CurrencyPipe,FormsModule],
  template:`
    <section class="shop-page">
      <div class="shop-hero"><div><div class="eyebrow">THE COLLECTION</div><h1>Wear it your way.</h1><p>Indian silhouettes, edited for today.</p></div></div>
      <div class="shop-toolbar">

        <button
          class="filter-btn"
          type="button"
          (click)="filtersOpen=!filtersOpen">
          FILTER + SORT
        </button>

        <div class="style-count">
          <strong>{{displayProductsCount}}</strong> styles
        </div>

        <div
          class="shop-search"
          *ngIf="searchOpen">

          <input
            #searchInput
            type="search"
            [(ngModel)]="searchTerm"
            placeholder="Search products by name..."
            (keyup.enter)="applySearch()">

          <button
            type="button"
            (click)="applySearch()">
            SEARCH
          </button>

          <button
            type="button"
            class="search-close"
            (click)="clearSearch()">
            ×
          </button>

        </div>

        <button
          *ngIf="!searchOpen"
          type="button"
          class="search-trigger"
          (click)="enableSearch()">
          <span class="search-icon">⌕</span> Search
        </button>

        <select
          [value]="sort"
          (change)="changeSort($event)">

          <option value="featured">Featured</option>
          <option value="price-low">Price: Low to high</option>
          <option value="price-high">Price: High to low</option>

        </select>

      </div>
      <div class="shop-body">
        <aside class="filters" [class.open]="filtersOpen">
          <div class="filter-head"><strong>FILTER</strong><button type="button" (click)="filtersOpen=false">×</button></div>
          <div class="filter-block"><div class="filter-title">Category</div><a routerLink="/products" [class.selected]="!categoryId">All products</a><a *ngFor="let c of categories" href="/products" (click)="selectCategory(c.id,$event)" [class.selected]="categoryId===c.id">{{c.name}}</a></div>
          <div class="filter-block"><div class="filter-title">Price</div><button type="button" [class.selected]="priceFilter==='under1999'" (click)="setPriceFilter('under1999')">Under ₹1,999</button><button type="button" [class.selected]="priceFilter==='2000to2999'" (click)="setPriceFilter('2000to2999')">₹2,000 – ₹2,999</button><button type="button" [class.selected]="priceFilter==='3000plus'" (click)="setPriceFilter('3000plus')">₹3,000+</button><button type="button" class="clear-filter" *ngIf="priceFilter" (click)="clearPriceFilter()">Clear price filter</button></div>
        </aside>
        <div class="listing">
          <div class="grid" *ngIf="displayProducts.length">
            <article class="card" *ngFor="let p of displayProducts; let i=index">
              <a class="card-link" [routerLink]="productLink(p)">
                <div class="media">
                  <img [src]="image(p,i)" [alt]="p.name" (error)="imageError($event)">
                  <span class="tag" *ngIf="p.discountPrice">SALE</span>
                </div>
                <div class="meta"><div><h3>{{p.name}}</h3><small>{{p.categoryName || 'AARPIVA'}}</small></div><div><b>{{(p.discountPrice ?? p.price)|currency:'INR':'symbol':'1.0-0'}}</b><del *ngIf="p.discountPrice">{{p.price|currency:'INR':'symbol':'1.0-0'}}</del></div></div>
              </a>
              <button type="button" class="quick-heart" aria-label="Wishlist">♡</button>
              <button type="button" class="quick-add" [disabled]="!p.stock" (click)="addToCart(p,$event)">{{p.stock ? 'ADD TO BAG' : 'OUT OF STOCK'}}</button>
            </article>
          </div>
          <div class="empty" *ngIf="!displayProducts.length">
            No products found<span *ngIf="searchTerm"> for <strong>"{{searchTerm}}"</strong></span>.
          </div>
        </div>
      </div>
    </section>
  `,
  styles:[`
    .shop-page{background:#fff}.shop-hero{height:310px;background:linear-gradient(90deg,#ede6de,#f5f1eb);display:flex;align-items:end;padding:45px 5vw}.shop-hero h1{font-size:58px;letter-spacing:-.04em;margin:8px 0}.shop-hero p{color:#777;margin:0}.shop-toolbar{height:68px;border-bottom:1px solid #ddd;border-top:1px solid #ddd;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 5vw;position:sticky;top:78px;background:#fff;z-index:30}.style-count{white-space:nowrap}.shop-toolbar select,.filter-btn{border:1px solid #ccc;background:#fff;padding:10px 14px;font:inherit}.filter-btn{display:none}.search-trigger{border:1px solid #ccc;background:#fff;padding:10px 14px;font:inherit;cursor:pointer}.search-trigger:hover{background:#f7f7f7}.shop-search{display:flex;align-items:center;gap:0;border:1px solid #ccc;background:#fff}.shop-search input{width:260px;border:0;outline:0;padding:10px 12px;font:inherit}.shop-search button{height:100%;border:0;background:#111;color:#fff;padding:10px 14px;font-size:10px;font-weight:800;letter-spacing:.1em;cursor:pointer}.shop-search .search-close{background:#fff;color:#111;font-size:18px;padding:6px 10px}.shop-body{display:grid;grid-template-columns:235px 1fr;align-items:start}.filters{position:sticky;top:146px;align-self:start;border-right:1px solid #ddd;padding:28px 22px;min-height:650px;box-sizing:border-box}.filter-head{display:flex;justify-content:space-between}.filter-head button{display:none}.filter-block{padding:25px 0;border-bottom:1px solid #eee}.filter-title{text-transform:uppercase;font-size:10px;letter-spacing:.15em;font-weight:800;margin-bottom:16px}.filter-block a{display:block;padding:8px 0;color:#68635d;font-size:13px}.filter-block a.selected{color:#111;font-weight:800}.filter-block>button{display:block;width:100%;padding:8px 0;border:0;background:none;color:#68635d;font-size:13px;text-align:left;cursor:pointer}.filter-block>button.selected{color:#111;font-weight:800}.clear-filter{font-size:11px!important;text-decoration:underline;margin-top:6px}.listing{padding:32px 30px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:26px}.card{position:relative;display:block;color:inherit;text-decoration:none}.card-link{display:block;color:inherit;text-decoration:none}.media{position:relative;aspect-ratio:3/4;background:#eee;overflow:hidden}.media img{width:100%;height:100%;object-fit:cover;transition:transform .4s}.card:hover .media img{transform:scale(1.03)}.tag{position:absolute;left:10px;top:10px;background:#fff;padding:6px 8px;font-size:8px;letter-spacing:.12em}.quick-heart{position:absolute;right:10px;top:10px;width:34px;height:34px;border:0;border-radius:50%;background:#fff;font-size:18px;cursor:pointer}.quick-add{position:static;width:100%;min-height:44px;margin-top:0;background:#111;color:#fff;padding:0 13px;text-align:center;font-size:9px;font-weight:800;letter-spacing:.15em;border:1px solid #111;cursor:pointer;transition:background .2s,color .2s,opacity .2s}.quick-add:hover{background:#fff;color:#111}.quick-add:disabled{opacity:.5;cursor:not-allowed}.quick-add:disabled:hover{background:#111;color:#fff}.meta{display:flex;justify-content:space-between;gap:10px;padding:12px 0}.meta h3{margin:0 0 5px;font-size:14px}.meta small{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#777}.meta b,.meta del{font-size:12px;white-space:nowrap}.meta del{display:block;text-align:right;color:#aaa;margin-top:4px}.empty{padding:28px;margin-top:20px;background:#f7f4ef;color:#726d66;font-size:13px}@media(max-width:1000px){.shop-body{grid-template-columns:1fr}.filters{display:none;position:fixed;left:0;right:0;bottom:0;top:auto;background:#fff;z-index:120;min-height:auto;border-right:0;box-shadow:0 -15px 40px rgba(0,0,0,.16);padding:22px}.filters.open{display:block}.filter-head button{display:block;border:0;background:none;font-size:22px}.filter-btn{display:block}.shop-toolbar{top:66px}.grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:700px){.shop-search{flex:1}.shop-search input{width:100%;min-width:0}.search-trigger{padding:9px 10px;font-size:11px}}@media(max-width:600px){.shop-hero{height:245px;padding:30px 5vw}.shop-hero h1{font-size:42px}.shop-toolbar{padding:0 4vw}.listing{padding:20px 4vw}.grid{gap:14px}.meta{display:block}.meta>div:last-child{margin-top:6px}.meta del{text-align:left;display:inline;margin-left:7px}.shop-toolbar>div{font-size:11px}}@media(min-width:1001px) and (max-width:1250px){.shop-body{grid-template-columns:210px 1fr}.grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.listing{padding:28px 22px}.shop-toolbar{padding:0 3vw}}@media(max-width:780px){.shop-toolbar{height:auto;min-height:68px;flex-wrap:wrap;padding-top:10px;padding-bottom:10px}.shop-toolbar .style-count{order:1}.shop-toolbar .search-trigger,.shop-toolbar .shop-search{order:2;flex:1;min-width:160px}.shop-toolbar select{order:3}.shop-toolbar .filter-btn{order:0}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.quick-add{min-height:44px}.quick-heart{width:32px;height:32px}.meta h3{font-size:13px}.media{aspect-ratio:3/4}}@media(max-width:460px){.shop-body{width:100%}.filters{padding:18px 16px}.shop-hero{height:220px}.shop-hero h1{font-size:34px}.shop-toolbar{gap:8px}.shop-toolbar select,.search-trigger,.filter-btn{padding:9px 10px;font-size:11px}.shop-search{min-width:0!important}.shop-search input{width:100%;font-size:12px}.shop-search button{padding:9px 10px}.listing{padding:16px 4vw}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.card{min-width:0}.media{aspect-ratio:2/2.6}.meta{padding:9px 0}.meta h3{font-size:12px}.meta b{font-size:11px}.tag{left:7px;top:7px;padding:5px 6px}}
  `]
})
export class ProductsComponent {
  api = inject(ApiService);
  cart = inject(CartService);
  route = inject(ActivatedRoute);
  router = inject(Router);

  products: Product[] = [];
  categories: Category[] = [];

  categoryId?: number;

  sort = 'featured';

  filtersOpen = false;

  searchOpen = false;
  searchTerm = '';
  priceFilter = '';
  minPrice?: number;
  maxPrice?: number;

  @ViewChild('searchInput')
  searchInput?: ElementRef<HTMLInputElement>;

  get displayProducts(): Product[] {
    return this.applySort([...this.products]);
  }

  get displayProductsCount() {
    return this.displayProducts.length;
  }

  private readonly fallbacks=['/assets/demo/ivory-silk.jpg','/assets/demo/maroon-banarasi.jpg','/assets/demo/sage-linen.jpg','/assets/demo/blush-organza.jpg','/assets/demo/royal-blue.jpg','/assets/demo/mustard-weave.jpg'];

  constructor(){
    this.api.categories().subscribe({ next: x => this.categories = x, error: () => this.categories = [] });
    this.route.queryParams.subscribe(q => {

      this.categoryId =
        q['categoryId']
          ? +q['categoryId']
          : undefined;

      this.sort =
        q['sort'] || 'featured';

      this.searchTerm = q['search'] || '';
      this.priceFilter = q['price'] || '';
      this.minPrice = undefined;
      this.maxPrice = undefined;
      if (this.priceFilter === 'under1999') { this.maxPrice = 1999; }
      else if (this.priceFilter === '2000to2999') { this.minPrice = 2000; this.maxPrice = 2999; }
      else if (this.priceFilter === '3000plus') { this.minPrice = 3000; }

      this.searchOpen =
        q['searchMode'] === '1';

      this.load(this.searchTerm);

      if (this.searchOpen) {
        setTimeout(() => {
          this.searchInput?.nativeElement.focus();
        }, 0);
      }

    });
  }

  load(search = '') {
    const query = new URLSearchParams();
    if (this.categoryId) query.set('categoryId', String(this.categoryId));
    if (search.trim()) query.set('search', search.trim());
    if (this.minPrice !== undefined) query.set('minPrice', String(this.minPrice));
    if (this.maxPrice !== undefined) query.set('maxPrice', String(this.maxPrice));
    const params = query.toString() ? `?${query.toString()}` : '';

    this.api.products(params).subscribe({
      next: x => {
        this.products = x ?? [];
      },
      error: () => {
        this.products = [];
      }
    });
  }
  enableSearch(){
    this.searchOpen = true;

    setTimeout(() => {
      this.searchInput?.nativeElement.focus();
    }, 0);
  }

  applySearch(){
    const term =
      this.searchTerm.trim();

    this.router.navigate(
      [],
      {
        relativeTo: this.route,
        queryParams: {
          searchMode: '1',
          search: term || null
        },
        queryParamsHandling: 'merge'
      }
    );
  }

  clearSearch(){
    this.searchTerm = '';

    this.router.navigate(
      [],
      {
        relativeTo: this.route,
        queryParams: {
          searchMode: null,
          search: null
        },
        queryParamsHandling: 'merge'
      }
    );
  }
  search(v:string){this.load(v)}
  selectCategory(id:number,event?:Event){
    event?.preventDefault();
    this.router.navigate(['/products'], { queryParams: { categoryId:id, search:null, price:null, searchMode:null, sort:this.sort } });
    this.filtersOpen=false;
  }

  setPriceFilter(filter:string){
    this.priceFilter=filter;
    this.filtersOpen=false;
    this.router.navigate([], { relativeTo:this.route, queryParams:{price:filter || null}, queryParamsHandling:'merge' });
  }

  clearPriceFilter(){
    this.priceFilter='';
    this.minPrice=undefined;
    this.maxPrice=undefined;
    this.router.navigate([], { relativeTo:this.route, queryParams:{price:null}, queryParamsHandling:'merge' });
  }

  changeSort(e:any){
    this.sort=e.target.value;
    this.router.navigate([], { relativeTo:this.route, queryParams:{sort:this.sort}, queryParamsHandling:'merge' });
  }
  applySort(items:Product[]){const x=[...items];if(this.sort==='price-low')return x.sort((a,b)=>(a.discountPrice??a.price)-(b.discountPrice??b.price));if(this.sort==='price-high')return x.sort((a,b)=>(b.discountPrice??b.price)-(a.discountPrice??a.price));return x}
  image(p:Product,i:number){return this.resolveImage(p.images?.[0] || this.fallbacks[i%6]);}
  resolveImage(src:string){if(/^(https?:)?\/\//i.test(src))return src;return src.startsWith('/')?src:`/${src}`;}
  addToCart(p:Product,event:Event){event.preventDefault();event.stopPropagation();this.cart.add(p,1)}
  imageError(event:Event){const img=event.target as HTMLImageElement;if(!img.src.endsWith('/assets/demo/ivory-silk.jpg'))img.src='/assets/demo/ivory-silk.jpg';}
}
