import {Component,inject} from '@angular/core';
import {CommonModule,CurrencyPipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Router,RouterLink} from '@angular/router';
import {ApiService} from '../../core/api.service';
import {AuthService} from '../../core/auth.service';
import {CartService} from '../../core/cart.service';
import {Address} from '../../core/models';

declare const Razorpay:any;

@Component({
  standalone:true,
  imports:[CommonModule,FormsModule,CurrencyPipe,RouterLink],
  template:`
    <section class="section">
      <div class="eyebrow">CHECKOUT</div><h1>Almost yours.</h1>
      <div *ngIf="!auth.isLogged()" class="notice">Please <a routerLink="/login">login</a> before checkout.</div>
      <div *ngIf="auth.isLogged() && cart.ready && !cart.items.length" class="notice">Your bag is empty. <a routerLink="/products">Shop products</a>.</div>

      <div *ngIf="auth.isLogged() && cart.ready && cart.items.length" class="checkout">
        <div>
          <h2>Shipping address</h2>
          <div class="addresses" *ngIf="addresses.length; else noSavedAddress">
            <div class="address" *ngFor="let a of addresses">
              <label class="address-main">
                <input type="radio" name="address" [value]="a.id" [(ngModel)]="selectedAddress">
                <div><b>{{a.recipientName}}</b><p>{{a.addressLine1}}, {{a.city}}, {{a.state}} — {{a.pincode}}</p><small>{{a.phone}}</small></div>
              </label>
              <div class="address-actions-inline">
                <button type="button" class="text-btn" (click)="editAddress(a)">Edit</button>
                <button type="button" class="text-btn danger-text" (click)="deleteAddress(a)" [disabled]="addressDeletingId === a.id">{{addressDeletingId === a.id ? 'Deleting…' : 'Delete'}}</button>
              </div>
            </div>
          </div>
          <ng-template #noSavedAddress><div class="address-empty">No saved address yet. Add one below to continue.</div></ng-template>
          <div class="address-actions"><button class="btn light address-toggle" type="button" (click)="toggleAddressForm()">{{showForm ? 'Close form' : 'Add new address'}}</button><button *ngIf="addresses.length" class="btn text-btn" type="button" (click)="loadAddresses()">Refresh addresses</button></div>
          <div *ngIf="addressError" class="address-error">{{addressError}}</div><form *ngIf="showForm" (ngSubmit)="saveAddress()" class="address-form">
            <div class="address-form-title">{{editingAddressId ? 'Edit saved address' : 'Add a new address'}}</div>
            <input [(ngModel)]="newAddress.recipientName" name="recipientName" placeholder="Full name" required>
            <input [(ngModel)]="newAddress.phone" name="phone" placeholder="Phone" required>
            <input [(ngModel)]="newAddress.addressLine1" name="addressLine1" placeholder="Address line 1" required>
            <input [(ngModel)]="newAddress.addressLine2" name="addressLine2" placeholder="Address line 2">
            <input [(ngModel)]="newAddress.city" name="city" placeholder="City" required>
            <input [(ngModel)]="newAddress.state" name="state" placeholder="State" required>
            <input [(ngModel)]="newAddress.pincode" name="pincode" placeholder="Pincode" required>
            <div class="address-form-actions">
              <button class="btn dark" type="submit" [disabled]="addressSaving">{{addressSaving?(editingAddressId?'Updating…':'Saving…'):(editingAddressId?'Update address':'Save address')}}</button>
              <button class="btn light" type="button" (click)="cancelAddressEdit()" [disabled]="addressSaving">Cancel</button>
            </div>
          </form>
        </div>
        <aside>
          <h2>Order total</h2>
          <p class="sum"><span>Subtotal</span><b>{{summary?.subtotal ?? cart.subtotal | currency:'INR':'symbol':'1.0-0'}}</b></p>
          <p class="sum"><span>Discount</span><b>{{discountDisplay}}</b></p>
          <p class="sum"><span>Delivery</span><b>{{shippingDisplay}}</b></p>
          <hr><p class="sum total"><span>Pay</span><b>{{payTotal|currency:'INR':'symbol':'1.0-0'}}</b></p>
          <button class="btn dark full payment-button" type="button" [disabled]="!selectedAddress || placing" (click)="pay()">{{placing?'Opening payment…':'Pay securely with Razorpay'}}</button>
          <p class="tiny">V1 uses Razorpay Test Mode until you add live credentials.</p>
        </aside>
      </div>
    </section>
  `,
  styles:[`
    .section{padding:55px 7vw;min-height:650px;max-width:1400px;margin:0 auto}.section h1{font:600 48px 'Playfair Display'}.checkout{display:grid;grid-template-columns:1fr .65fr;gap:35px;margin-top:35px}.address{display:flex;justify-content:space-between;gap:16px;border:1px solid var(--line);padding:16px;margin-bottom:12px}.address-main{display:flex;gap:12px;flex:1;cursor:pointer}.address input{margin-top:5px}.address p{margin:6px 0;color:var(--muted)}.address-actions-inline{display:flex;align-items:center;gap:10px;flex:0 0 auto}.danger-text{color:#9a2d2d}.text-btn:disabled{opacity:.45;cursor:not-allowed}.address-form{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:20px 0;padding:18px;background:#faf7f2;border:1px solid #eee6dc}.address-form-title{grid-column:1/-1;font-weight:800;font-size:14px}.address-form input{padding:12px;border:1px solid var(--line);min-height:46px}.address-form-actions{grid-column:1/-1;display:flex;gap:10px;flex-wrap:wrap}.address-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.text-btn{background:none;color:#555;padding:0;text-decoration:underline}.address-error{margin:14px 0;padding:12px 14px;background:#fff4f4;border:1px solid #edc9c9;color:#8b2d2d;font-size:13px}.address-empty{padding:16px;background:#faf7f2;color:var(--muted);border:1px dashed #d9d1c6;margin-bottom:14px}.checkout aside{background:#faf7f2;padding:25px;height:max-content}.sum{display:flex;justify-content:space-between;gap:18px}.total{font-size:19px}.full{width:100%}.btn{border:0;border-radius:2px;min-height:48px;padding:0 18px;display:inline-flex;align-items:center;justify-content:center;font-weight:700;cursor:pointer}.payment-button{height:54px;width:100%;white-space:normal;text-align:center}.address-toggle{min-height:48px}.tiny,.notice{color:var(--muted);font-size:13px}.notice{background:#fff8e7;padding:15px}
    @media(max-width:900px){.section{padding:45px 5vw}.section h1{font-size:40px}.checkout{grid-template-columns:1fr;gap:22px}.checkout aside{padding:20px}}
    @media(max-width:560px){.section{padding:35px 4vw}.section h1{font-size:34px}.checkout{gap:18px}.addresses{display:grid;gap:10px}.address{padding:13px;align-items:flex-start}.address-form{grid-template-columns:1fr}.address-form-title,.address-form-actions{grid-column:auto}.address-actions-inline{width:100%;justify-content:flex-start}.address-form-actions{flex-wrap:wrap}.payment-button{height:auto;min-height:54px;width:100%;font-size:13px}.address-actions{width:100%;align-items:stretch}.address-toggle{width:auto;flex:1}.text-btn{padding:12px 8px}.checkout aside{padding:18px}.sum{font-size:14px}}
  `]
})
export class CheckoutComponent{
  api=inject(ApiService);auth=inject(AuthService);router=inject(Router);cart=inject(CartService);
  addresses:Address[]=[];selectedAddress=0;showForm=false;placing=false;addressSaving=false;addressDeletingId:number|null=null;editingAddressId:number|null=null;addressError='';newAddress:any={recipientName:'',phone:'',addressLine1:'',addressLine2:'',city:'',state:'',pincode:''};summary:any=null;
  constructor(){
    if (!this.auth.isLogged()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkout' } });
      return;
    }
    this.loadAddresses();
    this.loadCheckoutSummary();
  }
  get shipping(){return this.summary?.deliveryCharge ?? 0;}
  get payTotal(){return this.summary?.total ?? this.cart.subtotal;}
  get discountDisplay(){
    const amount = this.summary?.discountAmount ?? 0;
    return `-${this.currency(amount)}`;
  }
  get shippingDisplay(){
    return this.shipping === 0 ? 'FREE' : this.currency(this.shipping);
  }
  private currency(amount:number){
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  }
  loadCheckoutSummary(){
    this.api.checkoutSummary().subscribe({
      next: summary => this.summary = summary,
      error: () => this.summary = { subtotal: this.cart.subtotal, discountAmount: 0, deliveryCharge: 0, total: this.cart.subtotal }
    });
  }
  loadAddresses(){
    this.addressError='';
    this.api.addresses().subscribe({
      next:x=>{
        this.addresses = x ?? [];
        if (this.addresses.length && !this.addresses.some(a => Number(a.id) === Number(this.selectedAddress))) {
          this.selectedAddress = this.addresses[0].id;
        }
        if (!this.addresses.length) this.selectedAddress=0;
      },
      error:e=>{
        this.addresses=[];
        this.selectedAddress=0;
        this.addressError = e?.error?.message || e?.error || (e?.status===401 ? 'Your session has expired. Please log in again.' : 'Unable to load your saved addresses.');
      }
    });
  }
  toggleAddressForm(){
    if (this.showForm) {
      this.cancelAddressEdit();
      return;
    }
    this.editingAddressId = null;
    this.addressError = '';
    this.newAddress = {recipientName:'',phone:'',addressLine1:'',addressLine2:'',city:'',state:'',pincode:''};
    this.showForm = true;
  }

  editAddress(address: Address){
    this.addressError = '';
    this.editingAddressId = address.id;
    this.newAddress = {
      recipientName: address.recipientName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      city: address.city,
      state: address.state,
      pincode: address.pincode
    };
    this.showForm = true;
    window.scrollTo({top: document.body.scrollHeight, behavior: 'smooth'});
  }

  cancelAddressEdit(){
    this.showForm = false;
    this.editingAddressId = null;
    this.addressSaving = false;
    this.addressError = '';
    this.newAddress={recipientName:'',phone:'',addressLine1:'',addressLine2:'',city:'',state:'',pincode:''};
  }

  saveAddress(){
    this.addressError='';
    this.addressSaving=true;
    const body={
      recipientName:String(this.newAddress.recipientName||'').trim(),
      phone:String(this.newAddress.phone||'').trim(),
      addressLine1:String(this.newAddress.addressLine1||'').trim(),
      addressLine2:String(this.newAddress.addressLine2||'').trim(),
      city:String(this.newAddress.city||'').trim(),
      state:String(this.newAddress.state||'').trim(),
      pincode:String(this.newAddress.pincode||'').trim()
    };

    const request = this.editingAddressId
      ? this.api.updateAddress(this.editingAddressId, body)
      : this.api.addAddress(body);

    request.subscribe({
      next: address => {
        if (this.editingAddressId) {
          this.addresses = this.addresses.map(a => a.id === address.id ? address : a);
        } else {
          this.addresses = [...this.addresses, address];
        }

        this.selectedAddress = address.id;
        this.addressSaving=false;
        this.cancelAddressEdit();
        this.selectedAddress = address.id;
      },
      error:e=>{
        this.addressSaving=false;
        this.addressError=e?.error?.message || e?.error || (e?.status===401 ? 'Your session has expired. Please log in again.' : 'Unable to save the address. Please check the details and try again.');
      }
    });
  }

  deleteAddress(address: Address){
    if (!confirm(`Delete the saved address for ${address.recipientName}?`)) return;
    this.addressError='';
    this.addressDeletingId=address.id;
    this.api.deleteAddress(address.id).subscribe({
      next:()=>{
        this.addresses=this.addresses.filter(a=>a.id!==address.id);
        if (this.selectedAddress===address.id) {
          this.selectedAddress=this.addresses[0]?.id ?? 0;
        }
        this.addressDeletingId=null;
      },
      error:e=>{
        this.addressDeletingId=null;
        this.addressError=e?.error?.message || e?.error || 'Unable to delete this address.';
      }
    });
  }

  pay(){
    if(!this.selectedAddress||!this.cart.ready||!this.cart.items.length||this.placing)return;

    this.placing=true;
    let paymentCompleted=false;

    let oId:number|null=null;

    const cancelDraft = (message='Payment cancelled. Your items are still in your bag.') => {
      if (!oId) {
        this.placing=false;
        alert(message);
        return;
      }

      this.api.cancelPayment(oId).subscribe({
        next:()=>{
          this.placing=false;
          this.cart.refresh();
          alert(message);
        },
        error:()=>{
          // Even if cancellation reconciliation fails, never clear the cart.
          this.placing=false;
          this.cart.refresh();
          alert(message);
        }
      });
    };

    this.api.createOrder({addressId:this.selectedAddress}).subscribe({
      next:o=>{
        oId=o.id;

        this.api.createPaymentOrder(o.id).subscribe({
          next:r=>{
            if(typeof Razorpay==='undefined'){
              cancelDraft('Payment could not be opened because Razorpay was not loaded. Your items are still in your bag.');
              return;
            }

            const options={
              key:r.keyId,
              amount:r.amount,
              currency:r.currency,
              name:'AARPIVA',
              description:`Order #${o.id}`,
              order_id:r.razorpayOrderId,
              handler:(response:any)=>{
                paymentCompleted=true;
                this.api.verifyPayment({
                  orderId:o.id,
                  razorpayOrderId:response.razorpay_order_id,
                  razorpayPaymentId:response.razorpay_payment_id,
                  razorpaySignature:response.razorpay_signature
                }).subscribe({
                  next:()=>{
                    this.placing=false;
                    this.cart.refresh();
                    this.router.navigateByUrl('/orders');
                  },
                  error:e=>{
                    this.placing=false;
                    alert(e.error?.message||e.error||'Payment verification failed. Please contact support before retrying.');
                  }
                });
              },
              modal:{
                ondismiss:()=>{
                  if(!paymentCompleted) cancelDraft();
                }
              },
              prefill:{
                name:this.auth.get()?.name,
                email:this.auth.get()?.email
              },
              theme:{color:'#111'}
            };

            const razorpay = new Razorpay(options);
            razorpay.on?.('payment.failed', (response:any)=>{
              if(paymentCompleted) return;
              const description = response?.error?.description || 'Payment failed. Your items are still in your bag.';
              cancelDraft(description);
            });
            razorpay.open();
          },
          error:e=>cancelDraft(e.error?.message||e.error||'Unable to start payment. Your items are still in your bag.')
        });
      },
      error:e=>{
        this.placing=false;
        alert(e.error?.message||e.error||'Unable to create order.');
      }
    });
  }
}
