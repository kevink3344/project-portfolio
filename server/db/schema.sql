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

IF NOT EXISTS (
  SELECT 1 FROM sys.tables WHERE name = 'project_images'
)
BEGIN
  CREATE TABLE project_images (
    id          INT            IDENTITY(1,1) PRIMARY KEY,
    project_id  INT            NOT NULL,
    image_data  VARBINARY(MAX) NOT NULL,
    image_mime  NVARCHAR(100)  NULL,
    sort_order  INT            NOT NULL DEFAULT 0,
    created_at  DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_project_images_projects
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE INDEX IX_project_images_project_sort
    ON project_images(project_id, sort_order, id);
END;
