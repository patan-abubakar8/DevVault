using DBMigrator.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// Enable Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure CORS for local development
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Register dependency injection services
builder.Services.AddTransient<ISqlServerMetadataReader, SqlServerMetadataReader>();
builder.Services.AddTransient<IPostgresWriter, PostgresWriter>();
builder.Services.AddSingleton<IMigrationProgressTracker, MigrationProgressTracker>();
builder.Services.AddSingleton<IMigrationEngine, MigrationEngine>();

// PMS Test Tool Services
builder.Services.AddTransient<ProjectAnalyzer>();
builder.Services.AddTransient<TestGenerator>();
builder.Services.AddTransient<TestRunner>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Enable CORS
app.UseCors("AllowAll");

// Disable HTTPS redirection for easier local development debugging if not configured, 
// or keep it but allow HTTP access. Let's make it development friendly.
// app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
