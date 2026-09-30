import { Routes } from '@angular/router';

import { HomeComponent } from './pages/home/home.component';
import { ProductsComponent } from './pages/products/products.component';
import { ProductDetailComponent } from './pages/product-detail/product-detail.component';
import { AuthComponent } from './pages/auth/auth.component';
import { CartComponent } from './pages/cart/cart.component';
import { CheckoutComponent } from './pages/checkout/checkout.component';
import { OrdersComponent } from './pages/orders/orders.component';
import { AdminComponent } from './pages/admin/admin.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },

  { path: 'products', component: ProductsComponent },
  { path: 'products/:id', component: ProductDetailComponent },

  { path: 'login', component: AuthComponent },
  { path: 'register', component: AuthComponent },
  { path: 'verify-email', component: AuthComponent },

  { path: 'cart', component: CartComponent },
  { path: 'checkout', component: CheckoutComponent },
  { path: 'orders', component: OrdersComponent },

  { path: 'admin', component: AdminComponent },

  { path: '**', redirectTo: '' }
];