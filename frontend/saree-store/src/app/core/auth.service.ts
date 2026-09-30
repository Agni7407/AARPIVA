import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({providedIn:'root'})
export class AuthService {
  private key='saree_store_auth';
  private subject=new BehaviorSubject<any>(this.get());
  user$=this.subject.asObservable();

  get(){
    try {
      const value = JSON.parse(localStorage.getItem(this.key)||'null');
      if (value?.token && this.isExpired(value.token)) {
        localStorage.removeItem(this.key);
        return null;
      }
      return value;
    } catch {
      localStorage.removeItem(this.key);
      return null;
    }
  }

  set(v:any){
    localStorage.setItem(this.key,JSON.stringify(v));
    this.subject.next(v);
  }

  clear(){
    localStorage.removeItem(this.key);
    this.subject.next(null);
  }

  token(){
    const value=this.get();
    const token=value?.token||null;
    if (!token) {
      if (this.subject.value !== null) this.subject.next(null);
      return null;
    }
    return token;
  }

  isLogged(){return !!this.token()}
  isAdmin(){return this.get()?.role==='Admin' && !!this.token()}

  private isExpired(token:string):boolean{
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }
}
