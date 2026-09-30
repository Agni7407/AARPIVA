import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CartItem, Product } from './models';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly key = 'saree_cart';
  private readonly subject = new BehaviorSubject<CartItem[]>(this.load());
  readonly items$ = this.subject.asObservable();

  get items(): CartItem[] {
    return this.subject.value;
  }

  get count(): number {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  get subtotal(): number {
    return this.items.reduce((sum, item) => sum + this.price(item.product) * item.quantity, 0);
  }

  price(product: Product): number {
    return product.discountPrice ?? product.price;
  }

  add(product: Product, quantity = 1): void {
    if (product.stock <= 0) return;

    const next = this.items.map(item => ({ ...item }));
    const existing = next.find(item => item.productId === product.id);
    const max = product.stock;

    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, max);
      existing.product = product;
    } else {
      next.push({ productId: product.id, quantity: Math.min(quantity, max), product });
    }

    this.commit(next);
  }

  setQuantity(productId: number, quantity: number): void {
    const next = this.items
      .map(item => item.productId === productId
        ? { ...item, quantity: Math.max(1, Math.min(quantity, item.product.stock)) }
        : item);
    this.commit(next);
  }

  remove(productId: number): void {
    this.commit(this.items.filter(item => item.productId !== productId));
  }

  clear(): void {
    this.commit([]);
  }

  private load(): CartItem[] {
    try {
      const raw = JSON.parse(localStorage.getItem(this.key) || '[]');
      if (!Array.isArray(raw)) return [];

      // Migrate the older V1 cart format, which stored product fields beside productId.
      return raw
        .filter((item: any) => !item?.product?.isDemo && !this.isLegacyDemoId(item?.productId))
        .map((item: any) => {
          if (item?.product) {
            return { productId: +item.productId, quantity: Math.max(1, +item.quantity || 1), product: item.product as Product } as CartItem;
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
            return { productId: product.id, quantity: Math.max(1, +item.quantity || 1), product } as CartItem;
          }
          return null;
        })
        .filter(Boolean) as CartItem[];
    } catch {
      return [];
    }
  }

  private isLegacyDemoId(value: unknown): boolean {
    const id = Number(value);
    return id >= 900001 && id <= 900006;
  }

  private commit(items: CartItem[]): void {
    this.subject.next(items);
    localStorage.setItem(this.key, JSON.stringify(items));
  }
}
