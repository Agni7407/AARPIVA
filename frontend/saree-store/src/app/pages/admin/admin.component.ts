import { Component, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  template: `
    <section class="admin" *ngIf="auth.isAdmin(); else denied">
      <div class="admin-top">
        <div>
          <div class="eyebrow">STORE ADMIN</div>
          <h1>Good evening.</h1>
        </div>
        <button class="btn light" type="button" (click)="selectTab('dashboard')">Refresh dashboard</button>
      </div>

      <div class="tabs">
        <button [class.sel]="tab==='dashboard'" (click)="selectTab('dashboard')">Overview</button>
        <button [class.sel]="tab==='products'" (click)="selectTab('products')">Products</button>
        <button [class.sel]="tab==='categories'" (click)="selectTab('categories')">Categories</button>
        <button [class.sel]="tab==='orders'" (click)="selectTab('orders')">Orders</button>
        <button [class.sel]="tab==='customers'" (click)="selectTab('customers')">Customers</button>
        <button [class.sel]="tab==='returns'" (click)="selectTab('returns')">Returns <span *ngIf="returns.length" class="tab-count">{{returns.length}}</span></button>
      </div>

      <div *ngIf="tab==='dashboard'" class="dashboard-grid">
        <div class="stats">
          <div><small>Customers</small><b>{{dash.customers ?? 0}}</b><button type="button" class="stat-link" (click)="selectTab('customers')">View customers →</button></div>
          <div><small>Products</small><b>{{dash.products ?? 0}}</b><button type="button" class="stat-link" (click)="selectTab('products')">Manage products →</button></div>
          <div><small>Categories</small><b>{{dash.categories ?? 0}}</b><button type="button" class="stat-link" (click)="selectTab('categories')">Manage categories →</button></div>
          <div><small>Paid revenue</small><b>{{(dash.paidRevenue || 0)|currency:'INR':'symbol':'1.0-0'}}</b><button type="button" class="stat-link" (click)="selectTab('orders')">View orders →</button></div>
        </div>
        <div class="dashboard-panel">
          <div class="dashboard-panel-head"><div><h2>Recent orders</h2><p class="panel-subtitle">Latest orders from your customers.</p></div><button type="button" class="btn light" (click)="selectTab('orders')">View all orders</button></div>
          <div *ngIf="dashboardOrders.length; else noRecentOrders" class="recent-orders">
            <div class="recent-order" *ngFor="let o of dashboardOrders"><span><strong>#{{o.id}}</strong> {{o.customer}}<small>{{o.email}}</small></span><span>{{o.totalAmount|currency:'INR':'symbol':'1.0-0'}}<small>{{o.paymentStatus}} · {{o.status}}</small></span></div>
          </div>
          <ng-template #noRecentOrders><div class="dashboard-empty">No orders yet. When customers place orders, the latest ones will appear here.</div></ng-template>
        </div>
      </div>
      <div *ngIf="adminLoadError" class="alert error">{{adminLoadError}} <button type="button" class="retry" (click)="load()">Retry</button></div>

      <div *ngIf="tab==='categories'" class="panel">
        <div class="panel-head">
          <div>
            <h2>Categories</h2>
            <p class="panel-subtitle">Create the groups your products belong to, such as Sarees or Kurties.</p>
          </div>
          <button class="btn dark" type="button" (click)="editingCat={name:'',isActive:true}">Add category</button>
        </div>

        <form *ngIf="editingCat" class="inline-form" (ngSubmit)="saveCategory()">
          <div class="field compact">
            <label for="catName">Category name</label>
            <input id="catName" [(ngModel)]="editingCat.name" name="catName" placeholder="e.g. Sarees" required>
          </div>
          <label class="check-line"><input type="checkbox" [(ngModel)]="editingCat.isActive" name="catActive"> Show this category in the store</label>
          <div class="form-actions">
            <button class="btn dark" type="submit">Save category</button>
            <button type="button" class="btn light" (click)="editingCat=null">Cancel</button>
          </div>
        </form>

        <div class="table">
          <div class="tr cat-row head"><span>Name</span><span>Status</span><span>Actions</span></div>
          <div class="tr cat-row" *ngFor="let c of categories">
            <span class="strong">{{c.name}}</span>
            <span><span class="status" [class.hidden-status]="!c.isActive">{{c.isActive?'Active':'Hidden'}}</span></span>
            <span><button type="button" (click)="editingCat={...c}">Edit</button><button type="button" (click)="deleteCategory(c.id)">Delete</button></span>
          </div>
          <div *ngIf="!categories.length" class="empty">No categories found. Add your first category above.</div>
        </div>
      </div>

      <div *ngIf="tab==='products'" class="panel">
        <div class="panel-head">
          <div>
            <h2>Products</h2>
            <p class="panel-subtitle">Add the product details your customers need to see before buying.</p>
          </div>
          <button class="btn dark" type="button" (click)="newProduct()">Add product</button>
        </div>

        <div *ngIf="categoryLoadError" class="alert error">
          <strong>Could not load categories.</strong> {{categoryLoadError}}
          <button type="button" class="retry" (click)="loadCategories()">Retry</button>
        </div>

        <form *ngIf="editingProduct" class="product-form" (ngSubmit)="saveProduct()">
          <div class="section-title">Basic information</div>
          <div class="form-grid two">
            <div class="field">
              <label for="pname">Product name <span>*</span></label>
              <input id="pname" [(ngModel)]="editingProduct.name" name="pname" placeholder="e.g. Red Banarasi Silk Saree" required>
              <small>Use a name customers will recognise easily.</small>
            </div>

            <div class="field">
              <label for="pcat">Product category <span>*</span></label>
              <select id="pcat" [(ngModel)]="editingProduct.categoryId" name="pcat" required [disabled]="loadingCategories || !categories.length">
                <option [ngValue]="0">{{loadingCategories ? 'Loading categories…' : (categories.length ? 'Choose a category' : 'No categories available')}}</option>
                <option *ngFor="let c of categories" [ngValue]="c.id">{{c.name}}</option>
              </select>
              <small *ngIf="categories.length">This decides where the product appears in the shop.</small>
              <small *ngIf="!loadingCategories && !categories.length">Go to <strong>Categories</strong> and create one first.</small>
            </div>
          </div>

          <div class="section-title">Pricing & inventory</div>
          <div class="form-grid three">
            <div class="field">
              <label for="price">Regular price (₹) <span>*</span></label>
              <input id="price" [(ngModel)]="editingProduct.price" name="price" type="number" min="0" step="0.01" placeholder="e.g. 2499" required>
              <small>Normal selling price before any discount.</small>
            </div>

            <div class="field">
              <label for="discountPrice">Sale price (₹)</label>
              <input id="discountPrice" [(ngModel)]="editingProduct.discountPrice" name="discountPrice" type="number" min="0" step="0.01" placeholder="Leave blank if no sale">
              <small>Optional. Customers will see this as the current price.</small>
            </div>

            <div class="field">
              <label for="stock">Available quantity <span>*</span></label>
              <input id="stock" [(ngModel)]="editingProduct.stock" name="stock" type="number" min="0" step="1" placeholder="e.g. 15" required>
              <small>How many pieces are currently available.</small>
            </div>
          </div>

          <div class="section-title">Product images</div>

          <div class="image-help">
            <strong>Add multiple images for this product.</strong>
            <span>
              The first image will be used as the main product image.
              You can use repository images now and Cloudflare/CDN URLs later.
            </span>
          </div>

          <div
            class="product-image-row"
            *ngFor="let image of editingProduct.images; let i = index">

            <div class="image-number">
              {{i + 1}}
            </div>

            <div class="image-source-tabs compact-tabs">

              <label
                class="source-option"
                [class.selected]="image.mode==='repo'">

                <input
                  type="radio"
                  [(ngModel)]="image.mode"
                  [name]="'imageMode' + i"
                  value="repo">

                <span>
                  <strong>Repository</strong>
                  <small>Use an image from src/assets</small>
                </span>

              </label>

              <label
                class="source-option"
                [class.selected]="image.mode==='cdn'">

                <input
                  type="radio"
                  [(ngModel)]="image.mode"
                  [name]="'imageMode' + i"
                  value="cdn">

                <span>
                  <strong>CDN</strong>
                  <small>Use a Cloudflare/R2 URL</small>
                </span>

              </label>

            </div>

            <div class="field image-url-field">

              <label>
                {{image.mode === 'repo'
                  ? 'Repository image path'
                  : 'CDN image URL'}}

                <span *ngIf="i === 0">(Main image)</span>
              </label>

              <input
                [(ngModel)]="image.url"
                [name]="'imageUrl' + i"
                [placeholder]="
                  image.mode === 'repo'
                    ? '/assets/products/red-saree-front.jpg'
                    : 'https://images.yourdomain.com/products/red-saree-front.jpg'
                ">

            </div>

            <div
              class="image-preview"
              *ngIf="image.url">

              <img
                [src]="resolveImage(image.url)"
                [alt]="editingProduct.name"
                (error)="previewError($event)">

            </div>

            <button
              type="button"
              class="remove-image"
              (click)="removeProductImage(i)"
              [disabled]="editingProduct.images.length === 1">

              ×

            </button>

          </div>

          <button
            type="button"
            class="btn light add-image-btn"
            (click)="addProductImage()">

            + Add another image

          </button>

          <div class="field full">
            <label for="desc">Product description <span>*</span></label>
            <textarea id="desc" [(ngModel)]="editingProduct.description" name="desc" placeholder="Describe the fabric, colour, design, occasion, care instructions, etc." rows="5" required></textarea>
          </div>

          <label class="check-line active-check">
            <input type="checkbox" [(ngModel)]="editingProduct.isActive" name="active">
            <span><strong>Product is active</strong><small>Active products are visible to customers.</small></span>
          </label>

          <div class="form-actions bottom-actions">
            <button class="btn dark" type="submit" [disabled]="!categories.length || !editingProduct.categoryId">{{editingProduct.id ? 'Update product' : 'Save product'}}</button>
            <button type="button" class="btn light" (click)="editingProduct=null">Cancel</button>
          </div>
        </form>

        <div class="table product-table">
          <div class="tr product-row head"><span>Product</span><span>Category</span><span>Price</span><span>Stock</span><span>Actions</span></div>
          <div class="tr product-row" *ngFor="let p of products">
            <span class="product-cell"><span class="thumb" *ngIf="p.images?.length"><img [src]="p.images[0]" [alt]="p.name"></span><span><strong>{{p.name}}</strong><small>{{p.description|slice:0:70}}{{p.description?.length>70?'…':''}}</small></span></span>
            <span>{{p.categoryName || 'Uncategorised'}}</span>
            <span>{{p.discountPrice ?? p.price|currency:'INR':'symbol':'1.0-0'}}</span>
            <span>{{p.stock}}</span>
            <span><button type="button" (click)="editProduct(p)">Edit</button><button type="button" (click)="deleteProduct(p.id)">Delete</button></span>
          </div>
          <div *ngIf="!products.length" class="empty">No products added yet. Click <strong>Add product</strong> to create your first one.</div>
        </div>
      </div>

      <div *ngIf="tab==='orders'" class="panel">
        <div class="panel-head">
          <div>
            <h2>Orders</h2>
            <p class="panel-subtitle">Manage customer orders, review what was purchased, and update fulfillment status.</p>
          </div>
          <button type="button" class="btn light" (click)="loadOrders()">Refresh</button>
        </div>

        <div *ngIf="ordersLoadError" class="alert error">
          {{ordersLoadError}}
          <button type="button" class="retry" (click)="loadOrders()">Retry</button>
        </div>

        <div class="table order-table">
          <div class="tr order-row head">
            <span>Order</span>
            <span>Customer</span>
            <span>Total</span>
            <span>Status</span>
          </div>

          <ng-container *ngFor="let o of orders">
            <div class="tr order-row">
              <span>
                <strong>#{{o.id}}</strong>
                <button type="button" class="detail-link" (click)="toggleOrder(o.id)">
                  {{expandedOrderId === o.id ? 'Hide details' : 'View details'}}
                </button>
              </span>

              <span>
                {{o.customer}}
                <small>{{o.email}}</small>
              </span>

              <span>
                {{o.totalAmount|currency:'INR':'symbol':'1.0-0'}}
                <small>{{o.paymentStatus}}</small>
              </span>

              <select
                [ngModel]="o.status"
                (ngModelChange)="changeStatus(o,$event)"
                [name]="'status'+o.id"
                [disabled]="statusSaving[o.id]">
                <option *ngFor="let status of statuses" [ngValue]="status">{{status}}</option>
              </select>
            </div>

            <div
              *ngIf="expandedOrderId === o.id"
              class="order-details-row">

              <div class="order-detail-grid">
                <div>
                  <h3>Items ordered</h3>
                  <div class="ordered-item" *ngFor="let item of (o.items || [])">
                    <span>
                      <strong>{{item.productName}}</strong>
                      <small>Product #{{item.productId}} · Qty {{item.quantity}}</small>
                    </span>
                    <span>{{item.lineTotal|currency:'INR':'symbol':'1.0-0'}}</span>
                  </div>
                  <div *ngIf="!(o.items || []).length" class="detail-empty">No item details were stored for this order.</div>
                </div>

                <div>
                  <h3>Shipping address</h3>
                  <div class="shipping-card" *ngIf="o.address">
                    <strong>{{o.address.recipientName}}</strong>
                    <span>{{o.address.phone}}</span>
                    <span>{{o.address.addressLine1}}</span>
                    <span *ngIf="o.address.addressLine2">{{o.address.addressLine2}}</span>
                    <span>{{o.address.city}}, {{o.address.state}} - {{o.address.pincode}}</span>
                  </div>
                  <div *ngIf="!o.address" class="detail-empty">No shipping address available.</div>
                </div>
              </div>

            </div>
          </ng-container>

          <div *ngIf="!orders.length && !ordersLoadError" class="empty">No customer orders found.</div>
        </div>
      </div>

      <div *ngIf="tab==='returns'" class="panel">
        <div class="panel-head">
          <div>
            <h2>Returns</h2>
            <p class="panel-subtitle">Review customer return requests and update their status.</p>
          </div>
          <button type="button" class="btn light" (click)="loadReturns()">Refresh</button>
        </div>

        <div *ngIf="returnsLoadError" class="alert error">{{returnsLoadError}} <button type="button" class="retry" (click)="loadReturns()">Retry</button></div>

        <div class="return-admin-list" *ngIf="returns.length; else noReturns">
          <article class="return-admin-card" *ngFor="let r of returns">
            <div class="return-admin-head">
              <div><strong>Return #{{r.id}}</strong><small>Order #{{r.orderId}} · {{r.createdAt|date:'mediumDate'}}</small></div>
              <select [ngModel]="r.status" (ngModelChange)="changeReturnStatus(r,$event)" [name]="'returnStatus'+r.id" [disabled]="returnStatusSaving[r.id]">
                <option *ngFor="let status of returnStatuses" [ngValue]="status">{{status}}</option>
              </select>
            </div>
            <div class="return-admin-grid">
              <div><span class="label">Customer</span><strong>{{r.customer}}</strong><small>{{r.email}}</small></div>
              <div><span class="label">Product</span><strong>{{r.productName}}</strong><small>Qty {{r.quantity}} · Product #{{r.productId}}</small></div>
              <div><span class="label">Reason</span><p>{{r.reason}}</p></div>
              <div><span class="label">Admin note</span><textarea [(ngModel)]="r.adminNote" [name]="'adminNote'+r.id" rows="2" placeholder="Optional note for this return"></textarea><button type="button" class="btn light note-save" (click)="saveReturnNote(r)">Save note</button></div>
            </div>
          </article>
        </div>
        <ng-template #noReturns><div class="empty">No return requests yet. Customers can request returns after an order is delivered.</div></ng-template>
      </div>

      <div *ngIf="tab==='customers'" class="panel">
        <div class="panel-head"><div><h2>Customers</h2><p class="panel-subtitle">Registered customers and verification status.</p></div><button type="button" class="btn light" (click)="loadCustomers()">Refresh</button></div>
        <div *ngIf="customersLoadError" class="alert error">{{customersLoadError}} <button type="button" class="retry" (click)="loadCustomers()">Retry</button></div>
        <div class="table"><div class="tr customer-row head"><span>Name</span><span>Email</span><span>Verified</span><span>Joined</span></div><div class="tr customer-row" *ngFor="let c of customers"><span>{{c.name}}</span><span>{{c.email}}</span><span>{{c.isEmailVerified?'Yes':'No'}}</span><span>{{c.createdAt|date:'mediumDate'}}</span></div></div>
      </div>
    </section>

    <ng-template #denied><section class="denied"><h1>Admin access required.</h1></section></ng-template>
  `,
  styles: [`
    .image-help{
      display:flex;
      flex-direction:column;
      gap:4px;
      margin-bottom:18px;
      padding:14px 16px;
      background:#f7f5f1;
      border:1px solid #e7e2da;
      font-size:13px;
    }

    .image-help span{
      color:#777;
      line-height:1.5;
    }

    .product-image-row{
      display:grid;
      grid-template-columns:32px 1.1fr 1.5fr 120px 36px;
      gap:14px;
      align-items:end;
      padding:18px 0;
      border-bottom:1px solid #eee;
    }

    .image-number{
      width:32px;
      height:32px;
      display:grid;
      place-items:center;
      background:#111;
      color:#fff;
      font-size:12px;
      font-weight:700;
    }

    .compact-tabs{
      display:flex;
      gap:8px;
    }

    .compact-tabs .source-option{
      min-width:0;
      padding:10px;
    }

    .image-url-field{
      min-width:0;
    }

    .product-image-row .image-preview{
      width:100px;
      height:110px;
      overflow:hidden;
      background:#eee;
      position:relative;
    }

    .product-image-row .image-preview img{
      width:100%;
      height:100%;
      object-fit:cover;
    }

    .remove-image{
      width:32px;
      height:32px;
      border:0;
      background:#f4f4f4;
      color:#777;
      font-size:20px;
      cursor:pointer;
    }

    .remove-image:hover{
      background:#111;
      color:#fff;
    }

    .remove-image:disabled{
      opacity:.35;
      cursor:not-allowed;
    }

    .add-image-btn{
      margin-top:18px;
    }

    @media(max-width:900px){
      .product-image-row{
        grid-template-columns:32px 1fr 36px;
        gap:12px;
      }

      .product-image-row .image-source-tabs{
        grid-column:2 / 4;
      }

      .product-image-row .image-url-field{
        grid-column:2 / 4;
      }

      .product-image-row .image-preview{
        grid-column:2;
      }

      .product-image-row .remove-image{
        grid-column:3;
        align-self:center;
      }
    }
    .detail-link{font-size:11px!important;color:#555!important;margin-left:8px!important;}
    .order-details-row{border-top:0;padding:0 0 18px 0;margin-top:-1px;background:#faf7f2;}
    .order-detail-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:24px;padding:20px;border:1px solid var(--line);border-top:0;}
    .order-detail-grid h3{font-size:15px;margin:0 0 12px;}
    .ordered-item{display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-top:1px solid #e7e0d8;}
    .ordered-item span:first-child{display:grid;gap:3px;}
    .ordered-item small{color:var(--muted);font-size:11px;}
    .shipping-card{display:grid;gap:5px;padding:13px 14px;border:1px solid #e2dbd2;background:#fff;font-size:13px;line-height:1.45;}
    .detail-empty{padding:13px 0;color:var(--muted);font-size:12px;}

    .dashboard-grid{display:grid;gap:18px}.stat-link{border:0;background:none;padding:0;text-align:left;text-decoration:underline;font-size:11px;color:#555;cursor:pointer}.dashboard-panel{background:#fff;padding:25px;border:1px solid var(--line)}.dashboard-panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}.recent-orders{margin-top:16px;border-top:1px solid var(--line)}.recent-order{display:flex;justify-content:space-between;gap:15px;padding:14px 0;border-bottom:1px solid var(--line)}.recent-order span{display:grid;gap:4px}.recent-order small{color:var(--muted);font-size:11px}.dashboard-empty{padding:22px 0;color:var(--muted);font-size:13px}.admin{padding:45px 6vw;background:#f7f4ef;min-height:750px}.admin-top{display:flex;justify-content:space-between;align-items:end}.admin h1{font:600 45px 'Playfair Display';margin:5px 0 25px}.tabs{display:flex;gap:5px;border-bottom:1px solid #ddd;margin-bottom:28px;overflow:auto}.tabs button{border:0;background:none;padding:13px 16px;cursor:pointer;white-space:nowrap}.tabs .sel{border-bottom:2px solid #111;font-weight:700}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:15px}.stats div{background:#fff;padding:25px;border:1px solid var(--line);display:grid;gap:8px}.stats small{color:var(--muted)}.stats b{font-size:27px}.panel{background:#fff;padding:28px;border:1px solid var(--line);margin-bottom:20px}.panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}.panel-head h2{margin:0}.panel-subtitle{margin:6px 0 0;color:var(--muted);font-size:14px}.inline-form,.product-form{margin:22px 0 10px;padding:22px;background:#faf7f2;border:1px solid #eee6dc}.inline-form{display:flex;gap:18px;align-items:end;flex-wrap:wrap}.field{display:grid;gap:7px}.field.compact{min-width:280px}.field label,.product-form>label,.product-form .field>label{font-weight:700;font-size:14px}.field label span{color:#9b2c2c}.field input,.field select,.field textarea,.product-form input,.product-form select,.product-form textarea,.order-row select{width:100%;box-sizing:border-box;padding:12px 13px;border:1px solid #d9d1c6;background:#fff;border-radius:3px;font:inherit}.field input:focus,.field select:focus,.field textarea:focus{outline:2px solid #111;outline-offset:-1px}.field small,.active-check small{color:var(--muted);font-size:12px;line-height:1.4}.image-source-tabs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}.source-option{display:flex;gap:10px;align-items:flex-start;padding:14px;border:1px solid #ddd7cf;background:#fff;cursor:pointer}.source-option.selected{border-color:#111;background:#faf7f2}.source-option input{margin-top:3px}.source-option span{display:grid;gap:4px}.source-option small{color:var(--muted);font-size:11px;line-height:1.4}.image-preview{margin-top:4px;position:relative;width:140px;aspect-ratio:3/4;background:#eee;overflow:hidden}.image-preview img{width:100%;height:100%;object-fit:cover}.image-preview span{position:absolute;left:7px;bottom:7px;background:#fff;padding:5px 7px;font-size:9px;letter-spacing:.1em;text-transform:uppercase}.form-grid{display:grid;gap:18px;margin-bottom:24px}.form-grid.two{grid-template-columns:1fr 1fr}.form-grid.three{grid-template-columns:repeat(3,1fr)}.field.full{margin-bottom:22px}.section-title{font-size:12px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;color:#6f665b;margin:5px 0 14px;padding-bottom:8px;border-bottom:1px solid #eee6dc}.check-line{display:flex;align-items:center;gap:8px;font-size:14px}.check-line input{width:auto}.active-check{align-items:flex-start;margin-top:2px}.active-check span{display:grid;gap:3px}.form-actions{display:flex;gap:10px;align-items:center}.bottom-actions{margin-top:10px}.btn{border:0;padding:13px 18px;cursor:pointer;font-weight:700;border-radius:2px}.btn:disabled{opacity:.45;cursor:not-allowed}.dark{background:#161515;color:#fff}.light{background:#f0ece5;color:#171515}.alert{padding:13px 15px;margin:16px 0;border:1px solid #e5c6c6;background:#fff5f5;font-size:14px}.retry{border:0;background:none;text-decoration:underline;font-weight:700;cursor:pointer;margin-left:8px}.table{margin-top:20px}.tr{display:grid;gap:12px;align-items:center;border-top:1px solid var(--line);padding:13px 0}.cat-row{grid-template-columns:2fr 1fr 1fr}.product-row{grid-template-columns:2.2fr 1.2fr 1fr .7fr 1.2fr}.order-row{grid-template-columns:1fr 2fr 1fr 1.2fr}.customer-row{grid-template-columns:1.4fr 2fr 1fr 1fr}.tr.head{font-weight:700;border-top:0;padding-top:5px}.tr button{border:0;background:none;text-decoration:underline;cursor:pointer;margin-right:12px;padding:0}.tr small{display:block;color:var(--muted)}.strong,.tr strong{font-weight:700}.status{display:inline-block;padding:5px 9px;background:#e8f3e8;font-size:12px}.hidden-status{background:#eee;color:#777}.empty{padding:32px 10px;text-align:center;color:var(--muted);border-top:1px solid var(--line)}.product-cell{display:flex;gap:10px;align-items:center}.thumb{width:48px;height:58px;background:#eee;overflow:hidden;display:inline-flex;flex:0 0 auto}.thumb img{width:100%;height:100%;object-fit:cover}.denied{display:grid;place-items:center;min-height:650px}@media(max-width:980px){.form-grid.three{grid-template-columns:1fr}.product-row{grid-template-columns:2fr 1fr 1fr 1fr}.product-row span:nth-child(2),.product-row span:nth-child(4){display:none}}@media(max-width:800px){.stats{grid-template-columns:1fr 1fr}.dashboard-panel{padding:18px}.dashboard-panel-head{flex-direction:column}.recent-order{align-items:flex-start}.form-grid.two{grid-template-columns:1fr}.tr{grid-template-columns:1fr 1fr}.tr.head{display:none}.panel{padding:18px}.admin{padding:28px 4vw}.product-row,.order-row,.customer-row,.cat-row{grid-template-columns:1fr 1fr}.product-row span:nth-child(2),.product-row span:nth-child(4){display:block}.panel-head{align-items:stretch;flex-direction:column}.panel-head .btn{align-self:flex-start}}
  @media(max-width:1100px){.admin{padding:35px 4vw}.product-row{grid-template-columns:2fr 1fr 1fr 1fr}.product-row span:nth-child(2){display:none}}@media(max-width:980px){.form-grid.three{grid-template-columns:1fr}.image-source-tabs{grid-template-columns:1fr}.product-row{grid-template-columns:2fr 1fr 1fr}.product-row span:nth-child(4){display:none}.panel-head{flex-direction:column}.panel-head .btn{align-self:flex-start}}@media(max-width:800px){.stats{grid-template-columns:1fr 1fr}.dashboard-panel{padding:18px}.dashboard-panel-head{flex-direction:column}.recent-order{align-items:flex-start}.form-grid.two{grid-template-columns:1fr}.tr{grid-template-columns:1fr 1fr}.tr.head{display:none}.panel{padding:18px}.admin{padding:28px 4vw}.product-row,.order-row,.customer-row,.cat-row{grid-template-columns:1fr 1fr}.product-row span:nth-child(2),.product-row span:nth-child(4){display:block}.panel-head{align-items:stretch;flex-direction:column}.panel-head .btn{align-self:flex-start}.table{overflow-x:auto}.tr{min-width:620px}.product-form{padding:16px}.form-actions{flex-wrap:wrap}}@media(max-width:520px){.stats{grid-template-columns:1fr}.recent-order{flex-direction:column}.admin-top{align-items:flex-start;gap:12px;flex-direction:column}.admin h1{font-size:34px}.tabs{margin-bottom:20px}.panel{padding:14px}.tr{min-width:560px}.panel-head h2{font-size:24px}.source-option{padding:12px}}
    .tab-count{display:inline-grid;place-items:center;min-width:18px;height:18px;margin-left:5px;padding:0 4px;border-radius:99px;background:#111;color:#fff;font-size:9px}
    .return-admin-list{display:grid;gap:14px}.return-admin-card{border:1px solid var(--line);padding:18px;background:#fff}.return-admin-head{display:flex;justify-content:space-between;gap:15px;align-items:start;border-bottom:1px solid #eee;padding-bottom:14px;margin-bottom:14px}.return-admin-head small{display:block;color:var(--muted);margin-top:4px}.return-admin-head select{min-width:155px;padding:9px;border:1px solid var(--line);background:#fff}.return-admin-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}.return-admin-grid>div{display:grid;gap:5px}.return-admin-grid .label{font-size:9px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;color:#777}.return-admin-grid small{color:#777}.return-admin-grid p{margin:0;line-height:1.5;color:#555}.return-admin-grid textarea{width:100%;border:1px solid var(--line);padding:10px;resize:vertical;font:inherit;box-sizing:border-box}.note-save{justify-self:start;min-height:38px;padding:0 12px;font-size:11px}
    @media(max-width:700px){.return-admin-head{flex-direction:column}.return-admin-head select{width:100%}.return-admin-grid{grid-template-columns:1fr}}
`]
})
export class AdminComponent {
  api = inject(ApiService);
  auth = inject(AuthService);
  router = inject(Router);
  tab = 'dashboard';
  dash: any = {};
  categories: any[] = [];
  products: any[] = [];
  orders: any[] = [];
  customers: any[] = [];
  editingCat: any = null;
  editingProduct: any = null;
  statuses = ['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];
  loadingCategories = false;
  categoryLoadError = '';
  adminLoadError = '';
  ordersLoadError = '';
  customersLoadError = '';
  dashboardOrders: any[] = [];
  expandedOrderId: number | null = null;
  statusSaving: Record<number, boolean> = {};
  returns: any[] = [];
  returnsLoadError = '';
  returnStatuses = ['Requested','Approved','Rejected','Received','Refunded','Cancelled'];
  returnStatusSaving: Record<number, boolean> = {};

  constructor() {
    if (!this.auth.isAdmin()) {
      this.router.navigateByUrl('/login');
      return;
    }
    this.load();
  }

  load() {
    this.tab = 'dashboard';
    this.adminLoadError = '';
    this.loadDashboard();
  }

  loadDashboard(){
    this.api.adminDashboard().subscribe({
      next:x=>this.dash=x,
      error:e=>this.adminLoadError=this.errorMessage(e,'Unable to load the admin dashboard. Please log in again if your session has expired.')
    });
    this.api.adminOrders().subscribe({
      next:x=>this.dashboardOrders=(x||[]).slice(0,5),
      error:e=>this.adminLoadError=this.errorMessage(e,'Unable to load recent orders.')
    });
  }

  loadProducts(){
    this.api.adminProducts().subscribe({
      next:x=>this.products=x||[],
      error:e=>this.adminLoadError=this.errorMessage(e,'Unable to load products.')
    });
  }

  loadOrders(){
    this.ordersLoadError='';
    this.api.adminOrders().subscribe({
      next:x=>this.orders=x||[],
      error:e=>this.ordersLoadError=this.errorMessage(e,'Unable to load orders. Please check that you are logged in as an administrator.')
    });
  }

  loadCustomers(){
    this.customersLoadError='';
    this.api.adminCustomers().subscribe({
      next:x=>this.customers=x||[],
      error:e=>this.customersLoadError=this.errorMessage(e,'Unable to load customers. Please check that you are logged in as an administrator.')
    });
  }

  selectTab(tab:string){
    this.tab=tab;
    if(tab==='dashboard') this.loadDashboard();
    if(tab==='products') this.loadProducts();
    if(tab==='categories') this.loadCategories();
    if(tab==='orders') this.loadOrders();
    if(tab==='customers') this.loadCustomers();
    if(tab==='returns') this.loadReturns();
  }

  loadReturns(){
    this.returnsLoadError='';
    this.api.adminReturns().subscribe({
      next:x=>this.returns=x||[],
      error:e=>this.returnsLoadError=this.errorMessage(e,'Unable to load return requests.')
    });
  }

  changeReturnStatus(r:any,status:string){
    const previous=r.status;
    r.status=status;
    this.returnStatusSaving[r.id]=true;
    this.api.updateReturnStatus(r.id,status,r.adminNote||'').subscribe({
      next:()=>this.returnStatusSaving[r.id]=false,
      error:e=>{r.status=previous;this.returnStatusSaving[r.id]=false;alert(this.errorMessage(e,'Unable to update the return status.'));}
    });
  }

  saveReturnNote(r:any){
    this.returnStatusSaving[r.id]=true;
    this.api.updateReturnStatus(r.id,r.status,r.adminNote||'').subscribe({
      next:()=>this.returnStatusSaving[r.id]=false,
      error:e=>{this.returnStatusSaving[r.id]=false;alert(this.errorMessage(e,'Unable to save the return note.'));}
    });
  }

  errorMessage(err:any, fallback:string){
    return err?.error?.message || err?.error || fallback;
  }

  loadCategories() {
    this.loadingCategories = true;
    this.categoryLoadError = '';
    this.api.adminCategories().subscribe({
      next: x => {
        // The API currently returns Category[], but accepting a data wrapper here
        // makes the admin UI more tolerant of a future API response wrapper.
        const result: any = x;
        this.categories = Array.isArray(result) ? result : (Array.isArray(result?.data) ? result.data : []);
        this.loadingCategories = false;
      },
      error: err => {
        this.categories = [];
        this.loadingCategories = false;
        this.categoryLoadError = err?.error?.message || err?.error || 'Unable to load categories right now. Please try again.';
      }
    });
  }

  saveCategory() {
    const c = this.editingCat;
    const call = c.id
      ? this.api.updateCategory(c.id, { name: c.name, isActive: c.isActive })
      : this.api.addCategory({ name: c.name, isActive: c.isActive });
    call.subscribe(() => {
      this.editingCat = null;
      this.load();
    });
  }

  deleteCategory(id: number) {
    if (confirm('Delete this category?')) this.api.deleteCategory(id).subscribe(() => this.load());
  }

  newProduct() {
    this.loadCategories();
    this.editingProduct = {
      name: '',
      categoryId: 0,
      price: 0,
      discountPrice: null,
      stock: 0,
      images: [{ mode: 'repo', url: '' }],
      description: '',
      isActive: true,
    };
  }

  editProduct(p: any) {
    this.loadCategories();

    this.editingProduct = {
      ...p,

      images: (p.images?.length ? p.images : ['']).map((url: string) => ({
        url,
        mode: /^https?:\/\//i.test(url) ? 'cdn' : 'repo'
      }))
    };
  }

  addProductImage() {
    this.editingProduct.images.push({
      url: '',
      mode: 'repo'
    });
  }

  removeProductImage(index: number) {
    if (this.editingProduct.images.length <= 1) {
      return;
    }

    this.editingProduct.images.splice(index, 1);
  }

  saveProduct() {
    const p = this.editingProduct;

    const imageUrls = (p.images || [])
      .map((image: any) => image.url?.trim())
      .filter((url: string) => !!url);

    const body = {
      name: p.name,
      categoryId: +p.categoryId,
      price: +p.price,
      discountPrice:
        p.discountPrice === null || p.discountPrice === ''
          ? null
          : +p.discountPrice,
      stock: +p.stock,
      description: p.description,
      isActive: p.isActive,
      imageUrls
    };

    const call = p.id
      ? this.api.updateProduct(p.id, body)
      : this.api.addProduct(body);

    call.subscribe({
      next: () => {
        this.editingProduct = null;
        this.load();
      },
      error: err => {
        console.error(err);
        alert(
          err?.error?.message ||
          err?.error ||
          'Could not save the product.'
        );
      }
    });
  }

  deleteProduct(id: number) {
    if (confirm('Hide this product?')) this.api.deleteProduct(id).subscribe(() => this.load());
  }

  resolveImage(src: string) {
    if (!src) return '/assets/demo/ivory-silk.jpg';
    if (/^(https?:)?\/\//i.test(src)) return src;
    return src.startsWith('/') ? src : `/${src}`;
  }

  previewError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.src = '/assets/demo/ivory-silk.jpg';
  }

  toggleOrder(id: number) {
    this.expandedOrderId = this.expandedOrderId === id ? null : id;
  }

  changeStatus(o: any, status: string) {
    const previous = o.status;
    o.status = status;
    this.statusSaving[o.id] = true;

    this.api.updateOrderStatus(o.id, status).subscribe({
      next: () => {
        this.statusSaving[o.id] = false;
      },
      error: err => {
        o.status = previous;
        this.statusSaving[o.id] = false;
        alert(this.errorMessage(err, 'Unable to update the order status.'));
      }
    });
  }
}
