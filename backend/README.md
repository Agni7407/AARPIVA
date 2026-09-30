# SareeStore V1 Backend

ASP.NET Core 10 Web API + EF Core + PostgreSQL (Neon-ready).

## Run
1. Install .NET 10 SDK.
2. Put your PostgreSQL/Neon connection string in `appsettings.Development.json` or environment variable `ConnectionStrings__DefaultConnection`.
3. Install EF CLI if needed: `dotnet tool install --global dotnet-ef`.
4. From this folder run `dotnet restore`.
5. Run `dotnet ef migrations add InitialCreate` (first time only if migration is absent).
6. Run `dotnet run`.
7. Swagger opens at `http://localhost:5107/swagger`.

## Important
The included admin credentials are development-only. Change them before any public deployment.
Email mode `Console` prints the verification link in the API logs. Replace `IEmailSender` with your chosen transactional provider for production.
Razorpay keys are intentionally blank. Add Test Mode keys first.
