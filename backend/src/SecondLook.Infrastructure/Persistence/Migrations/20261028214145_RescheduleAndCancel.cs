using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SecondLook.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RescheduleAndCancel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CancelReason",
                table: "Inspections",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "CancelledAt",
                table: "Inspections",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RefundSettled",
                table: "Inspections",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "RefundedCents",
                table: "Inspections",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "RetainedCents",
                table: "Inspections",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CancelReason",
                table: "Inspections");

            migrationBuilder.DropColumn(
                name: "CancelledAt",
                table: "Inspections");

            migrationBuilder.DropColumn(
                name: "RefundSettled",
                table: "Inspections");

            migrationBuilder.DropColumn(
                name: "RefundedCents",
                table: "Inspections");

            migrationBuilder.DropColumn(
                name: "RetainedCents",
                table: "Inspections");
        }
    }
}
