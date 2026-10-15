import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, catchError, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { CartItem, Product } from './models';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly guestKey = 'saree_guest_cart';

  private readonly subject = new BehaviorSubject<CartItem[]>([]);
  private readonly readySubject = new BehaviorSubject<boolean>(false);
  private readonly errorSubject = new BehaviorSubject<string>('');

  readonly items$ = this.subject.asObservable();
  readonly ready$ = this.readySubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();

  constructor() {
    // The old V1 key was shared across all users. It is intentionally discarded
    // so no previous customer's cart can leak into the new server-side model.
    localStorage.removeItem('saree_cart');

    this.auth.user$.pipe(
      map(user => user?.userId ? Number(user.userId) : null),
      distinctUntilChanged(),
      switchMap(userId => {
        this.readySubject.next(false);
        this.errorSubject.next('');

        if (!userId) {
          return of(this.loadGuestCart()).pipe(
            tap(() => this.readySubject.next(true))
          );
        }

        const guestLines = this.loadGuestCart().map(item => ({
          productId: item.productId,
          quantity: item.quantity, sizeCode: item.sizeCode || null
        }));

        const cart$ = guestLines.length
          ? this.api.syncCart(guestLines).pipe(switchMap(() => this.api.cart()))
          : this.api.cart();

        return cart$.pipe(
          tap(() => {
            if (guestLines.length) this.clearGuestCart();
            this.readySubject.next(true);
          }),
          catchError(error => {
            console.error('Unable to load the server cart.', error);
            this.errorSubject.next(this.messageFrom(error, 'Unable to load your bag. Please refresh and try again.'));
            this.readySubject.next(true);
            return of([] as CartItem[]);
          })
        );
      })
    ).subscribe(items => this.subject.next(items));
  }

  get items(): CartItem[] {
    return this.subject.value;
  }

  get count(): number {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  get subtotal(): number {
    return this.items.reduce((sum, item) => sum + this.price(item.product) * item.quantity, 0);
  }

  get ready(): boolean {
    return this.readySubject.value;
  }

  get errorMessage(): string {
    return this.errorSubject.value;
  }

  price(product: Product): number {
    return product.discountPrice ?? product.price;
  }

  add(product: Product, quantity = 1, sizeCode: string | null = null): void {
    if (quantity < 1 || (product.requiresSize ? !(product.sizeVariants||[]).some(v=>v.sizeCode===sizeCode&&v.isAvailable) : product.stock <= 0)) return;
    this.errorSubject.next('');

    if (!this.auth.isLogged()) {
      const items = this.loadGuestCart();
      const next = items.map(item => ({ ...item }));
      const existing = next.find(item => item.productId === product.id && (item.sizeCode||null) === sizeCode);
      const stock = product.requiresSize ? product.sizeVariants?.find(v=>v.sizeCode===sizeCode)?.stock||0 : product.stock;

      if (existing) {
        existing.quantity = Math.min(existing.quantity + quantity, stock);
        existing.product = product;
      } else {
        next.push({
          productId: product.id,
          sizeCode,
          quantity: Math.min(quantity, stock),
          product
        });
      }

      this.commitGuestCart(next);
      return;
    }

    this.api.addCartItem(product.id, quantity, sizeCode).subscribe({
      next: item => this.upsert(item),
      error: error => this.setError(error, 'Unable to add this item to your bag.')
    });
  }

  setQuantity(productId: number, quantity: number, sizeCode: string|null = null): void {
    if (quantity < 1) {
      this.remove(productId, sizeCode);
      return;
    }

    this.errorSubject.next('');

    if (!this.auth.isLogged()) {
      const next = this.items.map(item => item.productId === productId && (item.sizeCode||null)===sizeCode
        ? { ...item, quantity: Math.max(1, Math.min(quantity, item.product.requiresSize ? item.product.sizeVariants?.find(v=>v.sizeCode===sizeCode)?.stock||0 : item.product.stock)) }
        : item);
      this.commitGuestCart(next);
      return;
    }

    this.api.updateCartItem(productId, quantity, sizeCode).subscribe({
      next: item => this.upsert(item),
      error: error => this.setError(error, 'Unable to update the quantity.')
    });
  }

  remove(productId: number, sizeCode: string|null = null): void {
    this.errorSubject.next('');

    if (!this.auth.isLogged()) {
      this.commitGuestCart(this.items.filter(item => !(item.productId === productId && (item.sizeCode||null)===sizeCode)));
      return;
    }

    this.api.removeCartItem(productId, sizeCode).subscribe({
      next: () => this.subject.next(this.items.filter(item => !(item.productId === productId && (item.sizeCode||null)===sizeCode))),
      error: error => this.setError(error, 'Unable to remove this item.')
    });
  }

  clear(): void {
    this.errorSubject.next('');

    if (!this.auth.isLogged()) {
      this.commitGuestCart([]);
      return;
    }

    this.api.clearCart().subscribe({
      next: () => this.subject.next([]),
      error: error => this.setError(error, 'Unable to clear your bag.')
    });
  }

  refresh(): void {
    this.errorSubject.next('');

    if (!this.auth.isLogged()) {
      this.subject.next(this.loadGuestCart());
      this.readySubject.next(true);
      return;
    }

    this.readySubject.next(false);
    this.api.cart().subscribe({
      next: items => {
        this.subject.next(items);
        this.readySubject.next(true);
      },
      error: error => {
        this.setError(error, 'Unable to refresh your bag.');
        this.readySubject.next(true);
      }
    });
  }

  private upsert(item: CartItem): void {
    const items = this.items.filter(existing => !(existing.productId === item.productId && (existing.sizeCode||null)===(item.sizeCode||null)));
    items.push(item);
    this.subject.next(items.sort((a, b) => a.productId - b.productId));
  }

  private loadGuestCart(): CartItem[] {
    try {
      const raw = JSON.parse(localStorage.getItem(this.guestKey) || '[]');
      if (!Array.isArray(raw)) return [];

      return raw
        .filter((item: any) => !item?.product?.isDemo && !this.isLegacyDemoId(item?.productId))
        .map((item: any) => {
          if (item?.product) {
            return {
              productId: +item.productId,
              sizeCode: item.sizeCode || null,
              quantity: Math.max(1, +item.quantity || 1),
              product: item.product as Product
            } as CartItem;
          }

          if (item?.productId && item?.name) {
            if (item.isDemo || this.isLegacyDemoId(item.productId)) return null;
            const product: Product = {
              id: +item.productId,
              categoryId: 0,
              categoryName: item.categoryName || 'AARPIVA',
              name: item.name,
              slug: item.slug || '',
              description: item.description || '',
              price: +item.price || 0,
              discountPrice: item.discountPrice == null ? null : +item.discountPrice,
              stock: Math.max(1, +item.stock || 1),
              isActive: true,
              images: item.image ? [item.image] : []
            };
            return {
              productId: product.id,
              quantity: Math.max(1, +item.quantity || 1),
              product
            } as CartItem;
          }
          return null;
        })
        .filter(Boolean) as CartItem[];
    } catch {
      return [];
    }
  }

  private commitGuestCart(items: CartItem[]): void {
    this.subject.next(items);
    localStorage.setItem(this.guestKey, JSON.stringify(items));
  }

  private clearGuestCart(): void {
    localStorage.removeItem(this.guestKey);
  }

  private isLegacyDemoId(value: unknown): boolean {
    const id = Number(value);
    return id >= 900001 && id <= 900006;
  }

  private setError(error: any, fallback: string): void {
    console.error(fallback, error);
    this.errorSubject.next(this.messageFrom(error, fallback));
  }

  private messageFrom(error: any, fallback: string): string {
    return error?.error?.message || error?.error || fallback;
  }
}
