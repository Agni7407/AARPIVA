import { HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const apiOrigin = environment.apiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
  const isApiRequest = req.url.startsWith(apiOrigin + '/') || req.url === apiOrigin;

  const request = token && isApiRequest
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError(error => {
      if (error?.status === 401) {
        const returnUrl = router.url && router.url !== '/login' ? router.url : '/';
        auth.clear();
        if (router.url !== '/login') {
          router.navigate(['/login'], { queryParams: { returnUrl } });
        }
      }
      return throwError(() => error);
    })
  );
};
