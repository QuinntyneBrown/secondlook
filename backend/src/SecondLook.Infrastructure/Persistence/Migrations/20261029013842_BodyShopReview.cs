using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SecondLook.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BodyShopReview : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The mechanic's submission time keeps its data: it is renamed, not dropped and re-added (ADR 0014).
            migrationBuilder.RenameColumn(
                name: "SubmittedAt",
                table: "Reports",
                newName: "MechanicSubmittedAt");

            migrationBuilder.AlterColumn<long>(
                name: "MechanicSubmittedAt",
                table: "Reports",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AlterColumn<Guid>(
                name: "MechanicId",
                table: "Reports",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<Guid>(
                name: "BodyShopId",
                table: "Reports",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "BodyShopSubmittedAt",
                table: "Reports",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "ReportFindings",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Mechanic");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BodyShopId",
                table: "Reports");

            migrationBuilder.DropColumn(
                name: "BodyShopSubmittedAt",
                table: "Reports");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "ReportFindings");

            migrationBuilder.AlterColumn<Guid>(
                name: "MechanicId",
                table: "Reports",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);

            migrationBuilder.AlterColumn<long>(
                name: "MechanicSubmittedAt",
                table: "Reports",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            migrationBuilder.RenameColumn(
                name: "MechanicSubmittedAt",
                table: "Reports",
                newName: "SubmittedAt");
        }
    }
}
