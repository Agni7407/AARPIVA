import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Router, RouterLink } from '@angular/router';
import { Order } from '../../core/models';

@Component({
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterLink, FormsModule],
  template: `
    <section class="section">
      <div class="account-head">
        <div>
          <div class="eyebrow">ACCOUNT</div>
          <h1>My orders</h1>
          <p class="subtitle">Track deliveries, review what you bought and request a return when eligible.</p>
        </div>
        <button type="button" class="refresh-btn" (click)="loadOrders()" [disabled]="loading">
          {{ loading ? 'Refreshing…' : 'Refresh orders' }}
        </button>
      </div>

      <div *ngIf="error" class="notice error">{{ error }}</div>
      <div *ngIf="success" class="notice success">{{ success }}</div>

      <div *ngIf="loading && !orders.length" class="loading-state">Loading your orders…</div>

      <div class="orders" *ngIf="orders.length">
        <article *ngFor="let o of orders" class="order-card">
          <div class="order-header">
            <div>
              <div class="order-id">Order #{{o.id}}</div>
              <div class="order-date">Placed {{o.createdAt | date:'mediumDate'}}</div>
            </div>
            <div class="header-badges">
              <span class="badge" [class.paid]="o.paymentStatus==='Paid'">{{o.paymentStatus}}</span>
              <span class="badge status-badge" [class.cancelled]="o.status==='Cancelled'">{{o.status}}</span>
            </div>
          </div>

          <div class="tracking" [class.cancelled-track]="o.status==='Cancelled'">
            <div class="tracking-title-row">
              <div>
                <strong>{{o.status==='Cancelled' ? 'Order cancelled' : 'Order tracking'}}</strong>
                <small>{{trackingCaption(o.status)}}</small>
              </div>
              <span class="eta" *ngIf="o.status!=='Cancelled' && o.status!=='Delivered'">We'll keep this updated here.</span>
            </div>

            <div class="timeline" *ngIf="o.status!=='Cancelled'">
              <div class="timeline-step" *ngFor="let step of trackingSteps; let i=index" [class.done]="statusIndex(o.status)>=i" [class.current]="statusIndex(o.status)===i">
                <div class="dot">{{statusIndex(o.status)>i ? '✓' : (i+1)}}</div>
                <span>{{step}}</span>
              </div>
            </div>
            <div class="cancelled-note" *ngIf="o.status==='Cancelled'">This order has been cancelled. Please contact support if you need help.</div>
          </div>

          <div class="order-body">
            <div class="items-block">
              <div class="section-label">Items ordered</div>
              <div class="item" *ngFor="let item of o.items">
                <div class="item-main">
                  <div class="item-image">
                    <span>{{item.productName.charAt(0)}}</span>
                  </div>
                  <div class="item-copy">
                    <strong>{{item.productName}}</strong>
                    <small>Qty {{item.quantity}} · {{item.unitPrice | currency:'INR':'symbol':'1.0-0'}} each</small>

                    <ng-container *ngIf="returnForItem(o,item.id) as rr">
                      <span class="return-status">Return {{rr.status}}</span>
                    </ng-container>

                    <ng-container *ngIf="item.id as itemId">
                      <button
                        *ngIf="canRequestReturn(o,item)"
                        type="button"
                        class="return-link"
                        (click)="toggleReturnForm(itemId)">
                        {{returnForms[itemId]?.open ? 'Close return form' : 'Request return'}}
                      </button>

                      <div *ngIf="returnForms[itemId]?.open" class="return-form">
                        <label>
                          Quantity
                          <select [(ngModel)]="returnForms[itemId].quantity" [name]="'returnQty'+itemId">
                            <option *ngFor="let q of quantityOptions(o,item)" [ngValue]="q">{{q}}</option>
                          </select>
                        </label>
                        <label>
                          Reason
                          <textarea [(ngModel)]="returnForms[itemId].reason" [name]="'returnReason'+itemId" rows="3" placeholder="Tell us why you want to return this item"></textarea>
                        </label>
                        <button type="button" class="return-submit" (click)="submitReturn(o,item)" [disabled]="returnForms[itemId].saving">
                          {{returnForms[itemId].saving ? 'Submitting…' : 'Submit return request'}}
                        </button>
                      </div>
                    </ng-container>
                  </div>
                </div>
                <strong class="line-total">{{item.unitPrice * item.quantity | currency:'INR':'symbol':'1.0-0'}}</strong>
              </div>
            </div>

            <div class="side-block">
              <div class="section-label">Delivery address</div>
              <div class="address-card">
                <strong>{{o.address.recipientName}}</strong>
                <span>{{o.address.phone}}</span>
                <span>{{o.address.addressLine1}}</span>
                <span *ngIf="o.address.addressLine2">{{o.address.addressLine2}}</span>
                <span>{{o.address.city}}, {{o.address.state}} - {{o.address.pincode}}</span>
              </div>

              <div class="order-total">
                <span>Total paid</span>
                <strong>{{o.totalAmount | currency:'INR':'symbol':'1.0-0'}}</strong>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div *ngIf="!loading && !orders.length && !error" class="empty">
        <h2>No orders yet.</h2>
        <p>Your completed purchases will appear here with live order tracking.</p>
        <a routerLink="/products" class="btn dark">Start shopping</a>
      </div>
    </section>
  `,
  styles: [`
    .section{padding:58px 5vw 100px;min-height:650px;max-width:1400px;margin:0 auto}
    .account-head{display:flex;justify-content:space-between;gap:25px;align-items:end}
    .section h1{font:600 48px 'Playfair Display';margin:8px 0 8px}
    .subtitle{max-width:650px;color:var(--muted);line-height:1.6;margin:0}
    .refresh-btn{border:1px solid #111;background:#fff;padding:13px 16px;font-weight:700}
    .refresh-btn:disabled{opacity:.5;cursor:not-allowed}
    .orders{display:grid;gap:18px;margin-top:32px}
    .order-card{border:1px solid var(--line);background:#fff}
    .order-header{display:flex;justify-content:space-between;gap:18px;padding:20px 22px;border-bottom:1px solid var(--line)}
    .order-id{font-weight:800;font-size:17px}.order-date{font-size:12px;color:var(--muted);margin-top:5px}
    .header-badges{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;align-items:flex-start}
    .badge{padding:6px 8px;border:1px solid #ddd;background:#fafafa;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.badge.paid{border-color:#cde3d0;background:#eff8f0;color:#315d39}.badge.cancelled{border-color:#ecc7c7;background:#fff3f3;color:#8d2d2d}
    .tracking{padding:18px 22px;background:#faf8f4;border-bottom:1px solid var(--line)}
    .tracking-title-row{display:flex;justify-content:space-between;gap:15px;align-items:end}.tracking-title-row strong{display:block}.tracking-title-row small{display:block;color:var(--muted);margin-top:4px}.eta{font-size:11px;color:var(--muted)}
    .timeline{display:grid;grid-template-columns:repeat(5,1fr);gap:0;margin-top:18px}.timeline-step{position:relative;text-align:center;color:#9a958d;font-size:10px}.timeline-step:not(:last-child)::after{content:'';position:absolute;top:11px;left:50%;right:-50%;height:1px;background:#ddd;z-index:0}.timeline-step.done:not(:last-child)::after{background:#111}.timeline-step .dot{width:24px;height:24px;border-radius:50%;background:#fff;border:1px solid #ccc;display:grid;place-items:center;margin:0 auto 8px;position:relative;z-index:1;font-size:9px}.timeline-step.done{color:#111;font-weight:700}.timeline-step.done .dot{background:#111;color:#fff;border-color:#111}.timeline-step.current .dot{box-shadow:0 0 0 4px #e9e4dd}.cancelled-track{background:#fff4f4}.cancelled-note{margin-top:12px;color:#8d2d2d;font-size:13px}
    .order-body{display:grid;grid-template-columns:1.55fr .8fr;gap:26px;padding:22px}.section-label{text-transform:uppercase;letter-spacing:.14em;font-size:9px;font-weight:800;color:#676159;margin-bottom:13px}.item{display:flex;justify-content:space-between;gap:20px;padding:14px 0;border-bottom:1px solid #eee}.item:first-of-type{padding-top:0}.item-main{display:flex;gap:13px;min-width:0}.item-image{width:60px;height:74px;flex:0 0 auto;background:#ebe2da;display:grid;place-items:center;font-family:Georgia,serif;font-size:24px}.item-copy{min-width:0}.item-copy strong{display:block}.item-copy small{display:block;color:var(--muted);margin-top:4px}.line-total{white-space:nowrap}.return-status{display:inline-block;margin-top:7px;font-size:10px;color:#815d2e;text-transform:uppercase;letter-spacing:.08em}.return-link{display:block;margin-top:7px;padding:0;border:0;background:none;text-decoration:underline;font:inherit;font-size:11px;text-align:left}.return-form{margin-top:12px;padding:12px;background:#faf7f2;border:1px solid #e5ddd2;display:grid;gap:10px}.return-form label{display:grid;gap:5px;font-size:11px;font-weight:700}.return-form select,.return-form textarea{border:1px solid #ddd;background:#fff;padding:9px;font:inherit;font-weight:400}.return-form textarea{resize:vertical}.return-submit{background:#111;color:#fff;border:0;padding:11px 12px;font-size:10px;letter-spacing:.08em;font-weight:800}.return-submit:disabled{opacity:.5;cursor:not-allowed}
    .side-block{border-left:1px solid #eee;padding-left:24px}.address-card{display:grid;gap:4px;font-size:12px;color:#666;line-height:1.4}.address-card strong{color:#111}.order-total{border-top:1px solid #eee;margin-top:20px;padding-top:16px;display:flex;justify-content:space-between;align-items:center}.order-total strong{font-size:18px}.notice{margin-top:20px;padding:13px 15px;font-size:13px}.notice.error{background:#fff2f2;border:1px solid #eccdcd;color:#8d2d2d}.notice.success{background:#eef8f0;border:1px solid #cee5d2;color:#315d39}.loading-state{text-align:center;padding:80px;color:var(--muted)}.empty{text-align:center;padding:90px 20px;background:#faf7f2;margin-top:30px}.empty h2{font:400 32px Georgia,serif;margin-bottom:10px}.empty p{color:var(--muted);margin-bottom:22px}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 18px;border:0;font-weight:800}
    @media(max-width:900px){.section{padding:45px 4vw 90px}.section h1{font-size:40px}.account-head{align-items:flex-start;flex-direction:column}.refresh-btn{width:100%}.order-body{grid-template-columns:1fr}.side-block{border-left:0;border-top:1px solid #eee;padding-left:0;padding-top:20px}}
    @media(max-width:640px){.section{padding:32px 4vw 88px}.section h1{font-size:34px}.subtitle{font-size:13px}.order-header{padding:16px}.tracking{padding:16px}.order-body{padding:16px}.tracking-title-row{align-items:flex-start;flex-direction:column}.eta{display:none}.timeline{grid-template-columns:1fr;gap:10px}.timeline-step{text-align:left;display:grid;grid-template-columns:28px 1fr;align-items:center;column-gap:8px}.timeline-step .dot{margin:0}.timeline-step:not(:last-child)::after{left:12px;top:24px;right:auto;width:1px;height:24px}.item{align-items:flex-start}.item-main{gap:10px}.item-image{width:52px;height:66px}.line-total{font-size:12px}.header-badges{justify-content:flex-start;margin-top:8px}.order-header{display:block}.return-form{margin-left:-64px;margin-right:0}.order-total{font-size:13px}}
    @media(max-width:420px){.section h1{font-size:30px}.order-id{font-size:15px}.item-copy strong{font-size:13px}.item-copy small{font-size:11px}.return-form{margin-left:-62px}.empty{padding:65px 15px}}
  `]
})
export class OrdersComponent implements OnDestroy {
  api=inject(ApiService);
  auth=inject(AuthService);
  router=inject(Router);
  orders:Order[]=[];
  loading=false;
  error='';
  success='';
  trackingSteps=['Pending','Confirmed','Packed','Shipped','Delivered'];
  returnForms: Record<number,{open:boolean;quantity:number;reason:string;saving:boolean}> = {};
  private refreshTimer?: ReturnType<typeof setInterval>;

  constructor(){
    if(!this.auth.isLogged()){
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/orders' } });
      return;
    }
    this.loadOrders();
    this.refreshTimer = setInterval(() => this.loadOrders(true), 20000);
  }

  ngOnDestroy(){
    if(this.refreshTimer) clearInterval(this.refreshTimer);
  }

  loadOrders(silent=false){
    if(!silent) this.loading=true;
    this.error='';
    this.api.myOrders().subscribe({
      next:x=>{this.orders=x||[];this.loading=false;},
      error:e=>{this.loading=false;this.error=e?.error?.message||e?.error||'Unable to load your orders. Please try again.';}
    });
  }

  statusIndex(status:string){
    switch(status){
      case 'Pending': return 0;
      case 'Confirmed': return 1;
      case 'Packed': return 2;
      case 'Shipped': return 3;
      case 'Delivered': return 4;
      default: return -1;
    }
  }

  trackingCaption(status:string){
    switch(status){
      case 'Pending': return 'Your order has been received and is waiting for confirmation.';
      case 'Confirmed': return 'Your order is confirmed and being prepared.';
      case 'Packed': return 'Your order has been packed and is ready to leave us.';
      case 'Shipped': return 'Your parcel is on the way.';
      case 'Delivered': return 'Your order has been delivered.';
      default: return 'We are keeping you updated here.';
    }
  }

  returnForItem(order:Order,itemId:number|undefined){
    if(itemId===undefined) return undefined;
    return (order.returns||[]).find(r=>r.orderItemId===itemId);
  }

  requestedReturnQuantity(order:Order,itemId:number){
    const active = ['Requested','Approved','Received','Refunded'];
    return (order.returns||[]).filter(r=>r.orderItemId===itemId && active.includes(r.status)).reduce((sum,r)=>sum+r.quantity,0);
  }

  canRequestReturn(order:Order,item:{id?:number;quantity:number}){
    if(!item.id || order.status!=='Delivered' || order.paymentStatus!=='Paid') return false;
    return this.requestedReturnQuantity(order,item.id) < item.quantity;
  }

  quantityOptions(order:Order,item:{id?:number;quantity:number}){
    const remaining = item.id ? item.quantity - this.requestedReturnQuantity(order,item.id) : 0;
    return Array.from({length:Math.max(0,remaining)},(_,i)=>i+1);
  }

  toggleReturnForm(itemId:number){
    const current=this.returnForms[itemId];
    this.returnForms[itemId]={open:!current?.open,quantity:current?.quantity||1,reason:current?.reason||'',saving:false};
  }

  submitReturn(order:Order,item:{id?:number;productName:string;quantity:number}){
    if(!item.id) return;
    const form=this.returnForms[item.id];
    if(!form || !form.reason.trim()){
      this.error='Please enter a reason for the return request.';
      return;
    }
    form.saving=true;
    this.error='';
    this.success='';
    this.api.requestReturn(order.id,{orderItemId:item.id,quantity:Number(form.quantity),reason:form.reason.trim()}).subscribe({
      next:()=>{
        form.saving=false;
        form.open=false;
        form.reason='';
        this.success=`Return request submitted for ${item.productName}.`;
        this.loadOrders(true);
      },
      error:e=>{
        form.saving=false;
        this.error=e?.error?.message||e?.error||'Unable to submit the return request.';
      }
    });
  }
}
