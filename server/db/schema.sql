-- Run this script once against your Azure SQL database to create the projects table.

IF NOT EXISTS (
  SELECT 1 FROM sys.tables WHERE name = 'projects'
)
BEGIN
  CREATE TABLE projects (
    id          INT           IDENTITY(1,1) PRIMARY KEY,
    title       NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    tech_tags   NVARCHAR(500) NOT NULL DEFAULT '',  -- comma-separated list, e.g. "React,Node.js,Azure"
    thumbnail   NVARCHAR(500) NOT NULL DEFAULT '',  -- URL to thumbnail image
    created_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
  );
END;
