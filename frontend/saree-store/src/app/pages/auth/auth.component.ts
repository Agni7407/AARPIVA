import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="auth">
      <div class="card" *ngIf="mode !== 'verify'">
        <div class="eyebrow">AARPIVA ACCOUNT</div>
        <h1>{{ mode === 'login' ? 'Welcome back' : 'Create your account' }}</h1>

        <div *ngIf="message" class="message" [class.success-message]="messageType === 'success'">
          {{ message }}
        </div>

        <button
          *ngIf="mode === 'login' && canVerifyFromLogin"
          type="button"
          class="verify-link"
          (click)="goToVerification()">
          Verify this email address →
        </button>

        <form (ngSubmit)="submit()">
          <label *ngIf="mode === 'register'">
            Name
            <input [(ngModel)]="form.name" name="name" required autocomplete="name">
          </label>
          <label>
            Email
            <input type="email" [(ngModel)]="form.email" name="email" required autocomplete="email">
          </label>
          <label>
            Password
            <input type="password" [(ngModel)]="form.password" name="password" required minlength="8" autocomplete="current-password">
          </label>
          <button type="submit" class="btn dark full auth-submit" [disabled]="busy">
            {{ busy ? (mode === 'login' ? 'Logging in…' : 'Creating account…') : (mode === 'login' ? 'Login' : 'Create account') }}
          </button>
        </form>

        <a class="switch-link" (click)="switchMode()">
          {{ mode === 'login' ? 'New here? Create an account' : 'Already registered? Login' }}
        </a>
      </div>

      <div class="card" *ngIf="mode === 'verify'">
        <div class="eyebrow">EMAIL VERIFICATION</div>
        <h1>Verify your email</h1>
        <p>Enter the 6-digit code we sent to <strong>{{ verificationEmail }}</strong>.</p>
        <p class="verify-message" *ngIf="verifyMessage">{{ verifyMessage }}</p>

        <div class="otp-area">
          <input
            class="otp-input"
            [(ngModel)]="otp"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            placeholder="000000"
            aria-label="6 digit verification code"
            (input)="sanitizeOtp()"
            (keyup.enter)="verifyOtp()">

          <button type="button" class="btn dark full auth-submit" (click)="verifyOtp()" [disabled]="otpBusy || otp.length !== 6">
            {{ otpBusy ? 'Verifying…' : 'Verify email' }}
          </button>

          <button type="button" class="text-button" (click)="resendOtp()" [disabled]="resendBusy || resendSeconds > 0">
            {{ resendBusy ? 'Sending…' : (resendSeconds > 0 ? 'Resend code in ' + resendSeconds + 's' : 'Resend code') }}
          </button>

          <button type="button" class="text-button" (click)="backToLogin()">Back to login</button>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .auth{min-height:650px;display:grid;place-items:center;background:var(--peach);padding:40px}.card{width:min(460px,100%);background:#fff;padding:40px;box-shadow:0 20px 60px #0000000d}.card h1{font:600 42px 'Playfair Display';margin:8px 0 12px}.card p{color:var(--muted);line-height:1.5}.message,.verify-message{margin-top:10px;padding:12px 14px;background:#fff4f4;border:1px solid #edcdcd;color:#8b3030;line-height:1.5}.success-message{background:#eef8f0;border-color:#cee5d2;color:#315d39}.verify-link{border:0;background:none;padding:0;margin:12px 0 0;text-decoration:underline;font-weight:700;cursor:pointer}.card form{display:grid;gap:16px;margin:25px 0}.card label{display:grid;gap:7px;font-weight:600}.card input{padding:13px;border:1px solid var(--line);font:inherit;box-sizing:border-box}.switch-link{cursor:pointer;text-decoration:underline}.full{width:100%}.auth-submit{width:100%;min-height:52px;display:flex;align-items:center;justify-content:center;padding:0 20px;font-size:15px;font-weight:700;cursor:pointer}.auth-submit:disabled{opacity:.5;cursor:not-allowed}.otp-area{display:grid;gap:14px;margin-top:24px}.otp-input{width:100%;box-sizing:border-box;text-align:center;font-size:28px;letter-spacing:10px;font-weight:800;padding:16px 12px!important}.text-button{border:0;background:none;text-decoration:underline;font:inherit;cursor:pointer;padding:6px}.text-button:disabled{opacity:.45;cursor:not-allowed;text-decoration:none}@media(max-width:600px){.auth{padding:24px 16px;min-height:calc(100svh - 66px);align-items:start;padding-top:44px}.card{padding:26px 20px;border-radius:2px}.card h1{font-size:34px;line-height:1.05}.card form{gap:14px;margin:22px 0}.card input{min-height:48px}.auth-submit{min-height:50px;font-size:14px}.card a,.text-button{font-size:13px}.otp-input{font-size:24px;letter-spacing:7px}}@media(max-width:380px){.auth{padding-left:12px;padding-right:12px;padding-top:28px}.card{padding:22px 16px}.card h1{font-size:30px}}
  `]
})
export class AuthComponent implements OnDestroy {
  api = inject(ApiService);
  auth = inject(AuthService);
  router = inject(Router);
  route = inject(ActivatedRoute);

  mode: 'login' | 'register' | 'verify' = 'login';
  form: any = {};
  message = '';
  messageType: 'error' | 'success' = 'error';
  busy = false;
  verifyMessage = '';
  verificationEmail = '';
  otp = '';
  otpBusy = false;
  resendBusy = false;
  resendSeconds = 0;
  canVerifyFromLogin = false;
  private resendTimer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    this.route.url.subscribe(parts => {
      const path = parts[0]?.path;
      this.mode = path === 'register' ? 'register' : path === 'verify-email' ? 'verify' : 'login';
    });

    this.route.queryParamMap.subscribe(params => {
      const email = params.get('email')?.trim().toLowerCase();
      if (email) this.verificationEmail = email;

      if (this.mode === 'verify' && !this.verificationEmail) {
        this.message = 'Please start registration again so we know which email address to verify.';
      }

      if (this.mode === 'login' && params.get('verified') === '1') {
        this.message = 'Email verified successfully. You can now log in.';
        this.messageType = 'success';
      }
    });

    this.route.url.subscribe(parts => {
      if (parts[0]?.path === 'verify-email') this.loadLegacyTokenIfPresent();
    });
  }

  get currentEmail(): string {
    return String(this.form.email || this.verificationEmail || '').trim().toLowerCase();
  }

  submit() {
    if (this.busy) return;
    this.busy = true;
    this.message = '';
    this.canVerifyFromLogin = false;
    const currentMode = this.mode;
    const call = currentMode === 'login' ? this.api.login(this.form) : this.api.register(this.form);

    call.subscribe({
      next: (r: any) => {
        this.busy = false;

        if (currentMode === 'login') {
          this.auth.set(r);
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          if (r.role === 'Admin') this.router.navigateByUrl('/admin');
          else if (returnUrl) this.router.navigateByUrl(returnUrl);
          else this.router.navigateByUrl('/');
          return;
        }

        const email = String(this.form.email || '').trim().toLowerCase();
        if (!email) {
          this.message = 'Registration succeeded, but the email address could not be read.';
          return;
        }

        this.verificationEmail = email;
        this.otp = '';
        this.verifyMessage = r?.message || 'A 6-digit verification code has been sent to your email.';
        this.startResendCooldown(60);
        this.router.navigate(['/verify-email'], { queryParams: { email }, replaceUrl: true });
      },
      error: (e) => {
        this.busy = false;
        const text = this.errorMessage(e, 'Something went wrong. Please try again.');
        this.message = text;
        this.canVerifyFromLogin = this.mode === 'login' && /verify your email/i.test(text);
      }
    });
  }

  verifyOtp() {
    if (this.otp.length !== 6 || this.otpBusy || !this.verificationEmail) return;
    this.otpBusy = true;
    this.verifyMessage = '';
    this.api.verifyOtp(this.verificationEmail, this.otp).subscribe({
      next: (r: any) => {
        this.otpBusy = false;
        clearInterval(this.resendTimer);
        this.router.navigate(['/login'], { queryParams: { verified: '1' }, replaceUrl: true });
      },
      error: (e) => {
        this.otpBusy = false;
        this.verifyMessage = this.errorMessage(e, 'Verification failed. Please check the code and try again.');
      }
    });
  }

  resendOtp() {
    if (this.resendBusy || this.resendSeconds > 0 || !this.verificationEmail) return;
    this.resendBusy = true;
    this.api.resendOtp(this.verificationEmail).subscribe({
      next: (r: any) => {
        this.resendBusy = false;
        this.verifyMessage = r?.message || 'A new verification code has been sent.';
        this.otp = '';
        this.startResendCooldown(60);
      },
      error: (e) => {
        this.resendBusy = false;
        this.verifyMessage = this.errorMessage(e, 'Could not resend the verification code.');
      }
    });
  }

  sanitizeOtp() {
    this.otp = this.otp.replace(/\D/g, '').slice(0, 6);
  }

  goToVerification() {
    const email = this.currentEmail;
    if (!email) {
      this.message = 'Enter the email address you registered with first.';
      return;
    }
    this.router.navigate(['/verify-email'], { queryParams: { email }, replaceUrl: true });
  }

  switchMode() {
    this.message = '';
    this.canVerifyFromLogin = false;
    this.router.navigateByUrl(this.mode === 'login' ? '/register' : '/login');
  }

  backToLogin() {
    clearInterval(this.resendTimer);
    this.otp = '';
    this.verifyMessage = '';
    this.router.navigateByUrl('/login');
  }

  private loadLegacyTokenIfPresent() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) return;
    this.api.verifyEmail(token).subscribe({
      next: () => this.router.navigate(['/login'], { queryParams: { verified: '1' }, replaceUrl: true }),
      error: e => this.verifyMessage = this.errorMessage(e, 'Verification failed.')
    });
  }

  private startResendCooldown(seconds: number) {
    this.resendSeconds = seconds;
    clearInterval(this.resendTimer);
    this.resendTimer = setInterval(() => {
      this.resendSeconds = Math.max(0, this.resendSeconds - 1);
      if (this.resendSeconds === 0) clearInterval(this.resendTimer);
    }, 1000);
  }

  private errorMessage(err: any, fallback: string): string {
    const body = err?.error;
    if (typeof body === 'string') return body;
    return body?.message || fallback;
  }

  ngOnDestroy() {
    clearInterval(this.resendTimer);
  }
}
