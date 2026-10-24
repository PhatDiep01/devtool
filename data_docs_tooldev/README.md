# DevToolkit Persistent Data Repository

This directory contains persistent developer data for DevToolkit:

```
data_docs_tooldev/
├── devtoolkit.db           # SQLite 3 Database (WAL mode, FTS5 enabled)
├── docs/                   # Markdown handover documentation
│   └── modules/            # Organized by application feature domain
│       ├── survey-management/
│       │   └── survey-management-screen.md
│       └── general/
├── images/                 # Uploaded screenshots, UI mockups, and ER diagrams
├── schemas/                # OpenAPI specs, SQL DDL schemas, and JSON validation schemas
├── backups/                # Periodic database and markdown export backups
└── templates/              # Reusable specification templates for BA, Dev & QA
```

## Directory Specifications

1. **`docs/modules/{module-slug}/{screen-slug}.md`**
   - Source-of-truth markdown files containing YAML frontmatter and structured sections.
   - Automatically indexed into SQLite FTS5 for sub-millisecond full-text search.
2. **`images/`**
   - Stored with UUID filenames to prevent collision and path manipulation.
   - Served via `/api/files/images/{filename}`.
3. **`schemas/`**
   - Stores formal JSON schemas, DB migration scripts, and OpenAPI definitions.
4. **`backups/`**
   - Stores scheduled SQLite snapshots (`devtoolkit.db.bak`) and markdown archives.
5. **`templates/`**
   - Enterprise-grade templates covering BA feature specs, Acceptance Criteria, API contracts, ER models, and QA test matrices.
