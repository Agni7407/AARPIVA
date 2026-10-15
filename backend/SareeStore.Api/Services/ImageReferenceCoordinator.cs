using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using SareeStore.Api.Data;

namespace SareeStore.Api.Services;

public static class ImageReferenceCoordinator
{
    private const long LockKey = 7_644_156_807_342_901;

    public static async Task<IAsyncDisposable> AcquireAsync(AppDbContext db, CancellationToken cancellationToken)
    {
        await db.Database.OpenConnectionAsync(cancellationToken);
        var connection = db.Database.GetDbConnection();
        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT pg_advisory_lock(@key)";
            var parameter = command.CreateParameter();
            parameter.ParameterName = "key";
            parameter.Value = LockKey;
            command.Parameters.Add(parameter);
            await command.ExecuteScalarAsync(cancellationToken);
            return new LockLease(connection);
        }
        catch
        {
            await db.Database.CloseConnectionAsync();
            throw;
        }
    }

    private sealed class LockLease(DbConnection connection) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            try
            {
                await using var command = connection.CreateCommand();
                command.CommandText = "SELECT pg_advisory_unlock(@key)";
                var parameter = command.CreateParameter();
                parameter.ParameterName = "key";
                parameter.Value = LockKey;
                command.Parameters.Add(parameter);
                await command.ExecuteScalarAsync();
            }
            finally
            {
                await connection.CloseAsync();
            }
        }
    }
}
