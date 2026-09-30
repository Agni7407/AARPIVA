using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SareeStore.Api.Data;
using SareeStore.Api.DTOs;

namespace SareeStore.Api.Controllers;

[ApiController, Route("api/categories")]
public class CategoriesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> Get() => Ok(await db.Categories
        .Where(x => x.IsActive)
        .OrderBy(x => x.Name)
        .Select(x => new CategoryResponse(x.Id, x.Name, x.Slug, x.IsActive))
        .ToListAsync());

    [Authorize(Policy = "Admin"), HttpGet("admin")]
    public async Task<ActionResult> GetAdmin() => Ok(await db.Categories
        .OrderBy(x => x.Name)
        .Select(x => new CategoryResponse(x.Id, x.Name, x.Slug, x.IsActive))
        .ToListAsync());

    [Authorize(Policy = "Admin"), HttpPost]
    public async Task<ActionResult> Create(CategoryRequest req)
    {
        var name = req.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Category name is required.");
        var slug = ApiHelper.Slug(name);
        if (await db.Categories.AnyAsync(x => x.Slug == slug)) return Conflict("Category already exists.");
        var c = new Models.Category { Name = name, Slug = slug, IsActive = req.IsActive };
        db.Categories.Add(c);
        await db.SaveChangesAsync();
        return Ok(new CategoryResponse(c.Id, c.Name, c.Slug, c.IsActive));
    }

    [Authorize(Policy = "Admin"), HttpPut("{id:int}")]
    public async Task<ActionResult> Update(int id, CategoryRequest req)
    {
        var c = await db.Categories.FindAsync(id);
        if (c is null) return NotFound();
        var name = req.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) return BadRequest("Category name is required.");
        var slug = ApiHelper.Slug(name);
        if (await db.Categories.AnyAsync(x => x.Id != id && x.Slug == slug)) return Conflict("Category already exists.");
        c.Name = name;
        c.Slug = slug;
        c.IsActive = req.IsActive;
        await db.SaveChangesAsync();
        return Ok(new CategoryResponse(c.Id, c.Name, c.Slug, c.IsActive));
    }

    [Authorize(Policy = "Admin"), HttpDelete("{id:int}")]
    public async Task<ActionResult> Delete(int id)
    {
        var c = await db.Categories.FindAsync(id);
        if (c is null) return NotFound();
        var has = await db.Products.AnyAsync(p => p.CategoryId == id);
        if (has)
        {
            c.IsActive = false;
            await db.SaveChangesAsync();
            return Ok(new { message = "Category deactivated because it has products." });
        }
        db.Categories.Remove(c);
        await db.SaveChangesAsync();
        return NoContent();
    }
}
