using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SecondLook.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCallSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CallNotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CallSessionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AuthorId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AuthorName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Text = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CallNotes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CallSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InspectionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StartedAt = table.Column<long>(type: "bigint", nullable: false),
                    EndedAt = table.Column<long>(type: "bigint", nullable: true),
                    EndedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ChecklistIndex = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CallSessions", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CallNotes_CallSessionId",
                table: "CallNotes",
                column: "CallSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_CallSessions_InspectionId",
                table: "CallSessions",
                column: "InspectionId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CallNotes");

            migrationBuilder.DropTable(
                name: "CallSessions");
        }
    }
}
