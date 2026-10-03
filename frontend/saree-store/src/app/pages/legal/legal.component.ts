import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="legal-shell">
      <div class="eyebrow">AARPIVA LEGAL</div>
      <ng-container *ngIf="type === 'privacy'; else termsTemplate">
        <h1>Privacy Policy</h1><p class="effective">Effective date: 3 October 2026</p>
        <p>This Privacy Policy explains how AARPIVA handles personal information when you use our website, create an account, place an order, contact support, or otherwise use our services.</p>
        <h2>1. Information we collect</h2><p>Depending on how you use the site, we may process your name, email address, phone number, shipping address, account credentials in hashed form, email verification and password-reset records, order and return details, cart information, payment and transaction identifiers, and information you provide when contacting us.</p>
        <h2>2. Why we use your information</h2><p>We use information to create and secure accounts, verify email addresses, process orders and returns, arrange delivery, process payments, prevent fraud and misuse, provide customer support, send essential transaction messages, maintain our website and records, and comply with applicable legal obligations.</p>
        <h2>3. Payments</h2><p>Payments are processed through Razorpay. AARPIVA does not ask customers to submit full card or payment credentials directly to the AARPIVA application. We retain transaction identifiers, payment status and related records required to confirm and manage orders.</p>
        <h2>4. Email and authentication</h2><p>Brevo is used to deliver verification, password-reset and transactional emails. One-time codes are stored in hashed form and expire after a limited period. Passwords are stored as salted one-way password hashes rather than plaintext.</p>
        <h2>5. Product images and Cloudflare</h2><p>Product images uploaded by authorised AARPIVA administrators are stored using Cloudflare R2 and served through <strong>images.aarpiva.com</strong>. These images are public product assets because customers need to be able to view them without logging in.</p>
        <h2>6. Service providers</h2><p>AARPIVA uses third-party service providers including Render for hosting, Neon for PostgreSQL database hosting, Brevo for transactional email, Cloudflare for web delivery and product-image storage, and Razorpay for payment processing. These providers may process information as required to provide their services. Some providers may process information outside India; AARPIVA will use safeguards applicable to such processing.</p>
        <h2>7. Browser storage and cookies</h2><p>The site may use necessary browser storage for authentication state and for a guest shopping bag before a customer signs in. We do not operate the newsletter subscription block that was previously shown in the site footer.</p>
        <h2>8. Your privacy choices and rights</h2><p>Subject to applicable law, you may request access to, correction of, or deletion of personal data, ask questions about processing, or raise a grievance. Where consent is the legal basis for a processing activity, applicable law may also provide a right to withdraw that consent. To make a request, contact Nilesh Barman at <a href="mailto:aarpiva1801@gmail.com">aarpiva1801@gmail.com</a>.</p>
        <h2>9. Security</h2><p>We use reasonable technical and organisational safeguards appropriate to the service, including HTTPS, authenticated API access, rate limiting for sensitive authentication endpoints, salted password hashing, and restricted server-side credentials for payment, email and storage services.</p>
        <h2>10. Retention</h2><p>We retain account, transaction and support information for as long as reasonably necessary for the purposes described above and to meet applicable accounting, tax, dispute-resolution, security and legal requirements. Specific retention periods may vary by record type.</p>
        <h2>11. Changes to this policy</h2><p>We may update this policy when our services, processing practices or legal obligations change. The updated version will be published on this page with a revised effective date.</p>
        <h2>12. Contact</h2><p><strong>Nilesh Barman</strong><br>Customer Support &amp; Grievance Contact<br><a href="mailto:aarpiva1801@gmail.com">aarpiva1801@gmail.com</a><br><a href="tel:+917605805775">+91 76058 05775</a></p>
      </ng-container>
      <ng-template #termsTemplate>
        <h1>Terms &amp; Conditions</h1><p class="effective">Effective date: 3 October 2026</p>
        <p>These Terms &amp; Conditions govern your use of the AARPIVA website and your purchase of products through it. By creating an account or placing an order, you agree to these terms to the extent permitted by applicable law.</p>
        <h2>1. Accounts</h2><p>You are responsible for keeping your account credentials confidential and for activity performed through your account. Email verification may be required before an account can be used for purchasing. We may restrict or suspend accounts involved in fraud, abuse or unlawful activity.</p>
        <h2>2. Product information</h2><p>We aim to keep product descriptions, images, prices and stock information accurate. Colours and appearance may vary slightly between displays and physical products. Product availability can change without notice.</p>
        <h2>3. Pricing and payment</h2><p>Prices are displayed in Indian Rupees unless stated otherwise. Applicable taxes and delivery charges are shown where applicable during checkout. Razorpay handles online payment processing. An order is not treated as a completed purchase merely because a Razorpay checkout window was opened; the order becomes paid only after successful server-side payment verification.</p>
        <h2>4. Failed or cancelled payments</h2><p>If you cancel a Razorpay payment or the payment fails, the payment attempt is not treated as a successful purchase. The items remain in your shopping bag so that you may retry payment. A successful payment confirmation is required before an order is treated as paid.</p>
        <h2>5. Orders and stock</h2><p>Orders are created from the customer's server-side shopping bag and validated against current product availability before checkout. We may cancel an order where an item becomes unavailable, a payment is not completed, or we identify an error or suspected fraudulent transaction, subject to applicable law.</p>
        <h2>6. Shipping, returns and refunds</h2><p>Shipping and return handling are governed by the information shown on the site and in your order communications. Returns are available only where the relevant order and product meet AARPIVA's return conditions. A return request can be submitted for eligible delivered orders through the account area. Any refund is processed according to the applicable return decision and payment-provider process.</p>
        <h2>7. Customer information</h2><p>You must provide accurate information needed for account creation, delivery and support. You must not use another person's account, provide false information, attempt to bypass security controls, or interfere with the website or its APIs.</p>
        <h2>8. Intellectual property</h2><p>AARPIVA's branding, website content, design elements, product photography and original text belong to AARPIVA or its licensors unless otherwise stated. You may not reproduce or commercially exploit them without permission.</p>
        <h2>9. User communications</h2><p>When you contact AARPIVA, please provide accurate information and do not send unlawful, threatening, abusive or malicious material. We may retain support communications where reasonably necessary for service, security or legal purposes.</p>
        <h2>10. Privacy</h2><p>Your use of the site is also governed by the <a routerLink="/privacy-policy">AARPIVA Privacy Policy</a>, which explains how personal information is processed.</p>
        <h2>11. Limitation and force majeure</h2><p>We will use reasonable care to keep the service available, but we are not responsible for interruptions or delays caused by events beyond our reasonable control, including failures of third-party networks, payment services, hosting providers or other infrastructure. Nothing in these terms limits rights that cannot lawfully be excluded.</p>
        <h2>12. Changes</h2><p>We may update these terms when our services or legal obligations change. The revised terms will be posted on this page with an updated effective date.</p>
        <h2>13. Governing law and contact</h2><p>These terms are governed by applicable laws of India. For customer support or grievances, contact:</p><p><strong>Nilesh Barman</strong><br>Customer Support &amp; Grievance Contact<br><a href="mailto:aarpiva1801@gmail.com">aarpiva1801@gmail.com</a><br><a href="tel:+917605805775">+91 76058 05775</a></p>
        <div class="legal-note">These terms are a general ecommerce website template based on the current information provided for AARPIVA. The legal entity name, registered business address and any product-specific return/warranty rules should be reviewed and completed for the operating business before relying on these terms as a final legal document.</div>
      </ng-template>
    </section>
  `,
  styles: [`
    .legal-shell{max-width:940px;margin:0 auto;padding:65px 6vw 95px;min-height:700px}.legal-shell h1{font:600 50px 'Playfair Display';margin:8px 0 8px}.legal-shell .effective{color:#777;font-size:13px;margin-bottom:35px}.legal-shell h2{font-size:20px;margin:34px 0 10px}.legal-shell p{color:#4f4b46;line-height:1.75;font-size:15px}.legal-shell a{text-decoration:underline;color:inherit}.legal-note{margin-top:35px;padding:18px 20px;background:#fff8e7;border:1px solid #eadfbe;color:#655a3f;line-height:1.6;font-size:13px}@media(max-width:600px){.legal-shell{padding:45px 4vw 75px}.legal-shell h1{font-size:38px}.legal-shell h2{font-size:18px}}
  `]
})
export class LegalPageComponent {
  private readonly route = inject(ActivatedRoute);
  readonly type = this.route.snapshot.data['type'] ?? 'privacy';
}
