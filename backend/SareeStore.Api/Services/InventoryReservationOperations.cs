using Microsoft.EntityFrameworkCore;
using SareeStore.Api.Data;
using SareeStore.Api.Models;

namespace SareeStore.Api.Services;

public static class InventoryReservationOperations
{
    public static async Task<bool> ReleasePendingAsync(AppDbContext db, int orderId, bool onlyIfExpired, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted, cancellationToken);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT \"Id\" FROM \"Orders\" WHERE \"Id\" = {orderId} FOR UPDATE", cancellationToken);
        var order = await db.Orders.Include(x => x.Payment).Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == orderId, cancellationToken);
        if (order is null || order.PaymentStatus != PaymentStatus.Pending || order.Status != OrderStatus.Pending ||
            (onlyIfExpired && (!order.StockReserved || order.ReservationExpiresAt > DateTime.UtcNow)))
        {
            await transaction.CommitAsync(cancellationToken);
            return false;
        }

        if (order.StockReserved)
        {
            var productIds = order.Items.Select(x => x.ProductId).Distinct().Order().ToArray();
            foreach (var productId in productIds)
                await db.Database.ExecuteSqlInterpolatedAsync($"SELECT \"Id\" FROM \"Products\" WHERE \"Id\" = {productId} FOR UPDATE", cancellationToken);

            var products = await db.Products.Include(x => x.SizeVariants).Where(x => productIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
            foreach (var item in order.Items)
            {
                var product = products[item.ProductId];
                if (item.RequiresSize)
                {
                    var variant = product.SizeVariants.FirstOrDefault(x => x.SizeCode == item.SizeCode);
                    if (variant is null) throw new InvalidOperationException($"Reserved product size {item.ProductId}/{item.SizeCode} is missing.");
                    variant.Stock = checked(variant.Stock + item.Quantity);
                }
                else product.Stock = checked(product.Stock + item.Quantity);
            }
            order.StockReserved = false;
            order.ReservationExpiresAt = null;
        }

        order.PaymentStatus = PaymentStatus.Failed;
        order.Status = OrderStatus.Cancelled;
        if (order.Payment is not null) order.Payment.Status = PaymentStatus.Failed;
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return true;
    }

    public static async Task ReleaseExpiredAsync(IServiceScopeFactory scopeFactory, ILogger logger, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        List<int> ids;
        using (var scope = scopeFactory.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            ids = await db.Orders.AsNoTracking()
                .Where(x => x.StockReserved && x.PaymentStatus == PaymentStatus.Pending && x.Status == OrderStatus.Pending && x.ReservationExpiresAt <= now)
                .OrderBy(x => x.ReservationExpiresAt).ThenBy(x => x.Id)
                .Select(x => x.Id).Take(100).ToListAsync(cancellationToken);
        }
        foreach (var id in ids)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                await ReleasePendingAsync(db, id, onlyIfExpired: true, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (Exception ex) { logger.LogError(ex, "Could not release expired inventory reservation for order {OrderId}; it will be retried.", id); }
        }
    }
}

public sealed class InventoryReservationWorker(IServiceScopeFactory scopeFactory, ILogger<InventoryReservationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(15));
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await InventoryReservationOperations.ReleaseExpiredAsync(scopeFactory, logger, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Could not release expired inventory reservations."); }
            try { await timer.WaitForNextTickAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
