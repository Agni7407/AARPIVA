# SareeStore V1 Frontend

Angular 21 standalone app. API base URL is configured in `src/app/core/api.service.ts` for the V1 local setup.

## Run
1. Install Node.js 22+ and npm.
2. `npm install`
3. `npm start`
4. Open http://localhost:4200

## Production
Change the API base URL to your deployed HTTPS API before building. Razorpay Checkout is loaded from Razorpay's official checkout script.


### Demo images
The local demo images live under `src/assets/demo`. `angular.json` explicitly maps `src/assets` to the browser `/assets` path, so URLs such as `/assets/demo/ivory-silk.jpg` work during `ng serve` and after `ng build`.
