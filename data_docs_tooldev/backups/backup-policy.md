# DevToolkit Persistent Data Backup & Disaster Recovery Policy

## 1. Backup Strategy
- **SQLite Database (`devtoolkit.db`)**:
  - The database runs in Write-Ahead-Logging (`WAL`) mode.
  - To perform an online zero-downtime backup without locks:
    ```bash
    sqlite3 devtoolkit.db ".backup 'backups/devtoolkit_$(date +%Y%m%d_%H%M%S).db'"
    ```
- **Markdown Document Repository (`docs/`)**:
  - Source-of-truth markdown files can be backed up using Git or standard archiving:
    ```bash
    tar -czf backups/docs_backup_$(date +%Y%m%d).tar.gz docs/ images/
    ```

## 2. Retention Policy
- Daily snapshots: Retain for 7 days.
- Weekly snapshots: Retain for 4 weeks.
- Monthly snapshots: Retain for 6 months.

## 3. Disaster Recovery (RPO / RTO)
- **Recovery Point Objective (RPO)**: < 1 hour.
- **Recovery Time Objective (RTO)**: < 5 minutes.
- To restore: Replace `devtoolkit.db` with the latest snapshot in `backups/` and call `POST /api/docs/sync` to reconcile all disk markdown specifications.
