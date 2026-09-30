using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SareeStore.Api.Data;
using SareeStore.Api.DTOs;

namespace SareeStore.Api.Controllers;
[ApiController, Authorize, Route("api/account")]
public class AccountController(AppDbContext db) : ControllerBase
{
    [HttpGet("addresses")]
    public async Task<ActionResult> GetAddresses()=>Ok(await db.Addresses.Where(x=>x.UserId==ApiHelper.UserId(User)).Select(x=>new AddressResponse(x.Id,x.RecipientName,x.Phone,x.AddressLine1,x.AddressLine2,x.City,x.State,x.Pincode)).ToListAsync());
    [HttpPost("addresses")]
    public async Task<ActionResult> AddAddress(AddressRequest req){var a=new Models.Address{UserId=ApiHelper.UserId(User),RecipientName=req.RecipientName,Phone=req.Phone,AddressLine1=req.AddressLine1,AddressLine2=req.AddressLine2,City=req.City,State=req.State,Pincode=req.Pincode};db.Addresses.Add(a);await db.SaveChangesAsync();return Ok(new AddressResponse(a.Id,a.RecipientName,a.Phone,a.AddressLine1,a.AddressLine2,a.City,a.State,a.Pincode));}
    [HttpPut("addresses/{id:int}")]
    public async Task<ActionResult> UpdateAddress(int id,AddressRequest req){var a=await db.Addresses.FirstOrDefaultAsync(x=>x.Id==id&&x.UserId==ApiHelper.UserId(User));if(a is null)return NotFound();a.RecipientName=req.RecipientName;a.Phone=req.Phone;a.AddressLine1=req.AddressLine1;a.AddressLine2=req.AddressLine2;a.City=req.City;a.State=req.State;a.Pincode=req.Pincode;await db.SaveChangesAsync();return Ok(new AddressResponse(a.Id,a.RecipientName,a.Phone,a.AddressLine1,a.AddressLine2,a.City,a.State,a.Pincode));}
    [HttpDelete("addresses/{id:int}")]
    public async Task<ActionResult> DeleteAddress(int id){var a=await db.Addresses.FirstOrDefaultAsync(x=>x.Id==id&&x.UserId==ApiHelper.UserId(User));if(a is null)return NotFound();if(await db.Orders.AnyAsync(o=>o.AddressId==id))return BadRequest("This address is linked to an order and cannot be deleted.");db.Remove(a);await db.SaveChangesAsync();return NoContent();}
}
