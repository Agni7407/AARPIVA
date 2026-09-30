import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Category, Product, Address, Order } from './models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl.replace(/\/$/, '');

  categories() {
    return this.http.get<Category[]>(`${this.base}/categories`);
  }

  adminCategories() {
    return this.http.get<Category[]>(`${this.base}/categories/admin`);
  }

  products(params = '') {
    return this.http.get<Product[]>(`${this.base}/products${params}`);
  }

  adminProducts() {
    return this.http.get<Product[]>(`${this.base}/products/admin`);
  }

  product(id: number) {
    return this.http.get<Product>(`${this.base}/products/${id}`);
  }

  register(body: unknown) {
    return this.http.post(`${this.base}/auth/register`, body);
  }

  login(body: unknown) {
    return this.http.post<any>(`${this.base}/auth/login`, body);
  }

  verifyEmail(token: string) {
    return this.http.post(`${this.base}/auth/verify-email`, { token });
  }

  verifyOtp(email: string, otp: string) {
    return this.http.post(`${this.base}/auth/verify-otp`, { email, otp });
  }

  resendOtp(email: string) {
    return this.http.post(`${this.base}/auth/resend-otp`, { email });
  }

  addresses() {
    return this.http.get<Address[]>(`${this.base}/account/addresses`);
  }

  addAddress(body: unknown) {
    return this.http.post<Address>(`${this.base}/account/addresses`, body);
  }

  updateAddress(id: number, body: unknown) {
    return this.http.put<Address>(`${this.base}/account/addresses/${id}`, body);
  }

  deleteAddress(id: number) {
    return this.http.delete(`${this.base}/account/addresses/${id}`);
  }

  createOrder(body: unknown) {
    return this.http.post<Order>(`${this.base}/orders`, body);
  }

  myOrders() {
    return this.http.get<Order[]>(`${this.base}/orders/mine`);
  }

  requestReturn(orderId: number, body: unknown) {
    return this.http.post<any>(`${this.base}/orders/${orderId}/returns`, body);
  }

  createPaymentOrder(orderId: number) {
    return this.http.post<any>(`${this.base}/payments/create-order`, { orderId });
  }

  verifyPayment(body: unknown) {
    return this.http.post(`${this.base}/payments/verify`, body);
  }

  adminDashboard() {
    return this.http.get<any>(`${this.base}/admin/dashboard`);
  }

  adminOrders() {
    return this.http.get<any[]>(`${this.base}/admin/orders`);
  }

  adminCustomers() {
    return this.http.get<any[]>(`${this.base}/admin/customers`);
  }

  adminReturns() {
    return this.http.get<any[]>(`${this.base}/admin/returns`);
  }

  updateReturnStatus(id: number, status: string, adminNote = '') {
    return this.http.put(`${this.base}/admin/returns/${id}/status`, { status, adminNote });
  }

  addCategory(body: unknown) {
    return this.http.post<Category>(`${this.base}/categories`, body);
  }

  updateCategory(id: number, body: unknown) {
    return this.http.put<Category>(`${this.base}/categories/${id}`, body);
  }

  deleteCategory(id: number) {
    return this.http.delete(`${this.base}/categories/${id}`);
  }

  addProduct(body: unknown) {
    return this.http.post<Product>(`${this.base}/products`, body);
  }

  updateProduct(id: number, body: unknown) {
    return this.http.put<Product>(`${this.base}/products/${id}`, body);
  }

  deleteProduct(id: number) {
    return this.http.delete(`${this.base}/products/${id}`);
  }

  updateOrderStatus(id: number, status: string) {
    return this.http.put(`${this.base}/admin/orders/${id}/status`, { status });
  }
}
