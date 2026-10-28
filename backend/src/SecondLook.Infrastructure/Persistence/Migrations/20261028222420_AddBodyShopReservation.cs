using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SecondLook.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBodyShopReservation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "BodyShopReservationId",
                table: "Inspections",
                type: "uniqueidentifier",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BodyShopReservationId",
                table: "Inspections");
        }
    }
}
