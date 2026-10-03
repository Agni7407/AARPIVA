import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page-shell">
      <div class="eyebrow">CONTACT AARPIVA</div>
      <h1>We're here to help.</h1>
      <p class="lead">For account, order, payment, returns or privacy-related questions, contact our support team using the details below.</p>
      <div class="contact-grid">
        <article class="contact-card"><span class="label">Contact person</span><h2>Nilesh Barman</h2><p>Customer Support &amp; Grievance Contact</p></article>
        <article class="contact-card"><span class="label">Email</span><h2><a href="mailto:aarpiva1801@gmail.com">aarpiva1801@gmail.com</a></h2><p>For customer support and privacy requests.</p></article>
        <article class="contact-card"><span class="label">Phone</span><h2><a href="tel:+917605805775">+91 76058 05775</a></h2><p>Customer support contact.</p></article>
      </div>
      <div class="contact-note"><strong>Privacy &amp; grievance requests</strong><p>When contacting us about a personal-data request, please use the email address associated with your AARPIVA account where possible so we can verify and respond to the request.</p></div>
      <a routerLink="/" class="back-link">← Back to AARPIVA</a>
    </section>
  `,
  styles: [`
    .page-shell{max-width:1080px;margin:0 auto;padding:70px 6vw 90px;min-height:620px}.page-shell h1{font:600 50px 'Playfair Display';margin:8px 0 16px}.lead{max-width:720px;color:var(--muted);line-height:1.7;font-size:16px}.contact-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:38px}.contact-card{border:1px solid var(--line);padding:24px;background:#fff}.contact-card .label{text-transform:uppercase;letter-spacing:.12em;font-size:10px;font-weight:800;color:#777}.contact-card h2{font-size:20px;margin:10px 0}.contact-card h2 a{text-decoration:none;color:inherit}.contact-card h2 a:hover{text-decoration:underline}.contact-card p{color:var(--muted);line-height:1.6}.contact-note{margin-top:28px;padding:20px;background:#faf7f2;border:1px solid #eee6dc;color:#4b4742;line-height:1.6}.contact-note p{margin:8px 0 0}.back-link{display:inline-block;margin-top:32px;text-decoration:underline;color:inherit}@media(max-width:800px){.contact-grid{grid-template-columns:1fr 1fr}.page-shell h1{font-size:42px}}@media(max-width:560px){.page-shell{padding:45px 4vw 75px}.page-shell h1{font-size:36px}.contact-grid{grid-template-columns:1fr}}
  `]
})
export class ContactComponent {}
