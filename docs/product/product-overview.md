# Product Overview

Audience: product owner, managers, developers  
Last verified version: `0.1.1` / commit `8842877`

Zambil/Taghvim is a Persian-first content operations workspace. The central module is the Jalali content calendar. Tasks, campaigns, workflow, chat, reminders, notifications, reports, social Monitoring, technical health, and backups support that calendar.

## Product Principles

- Persian and RTL first.
- Calendar-centered daily work.
- Role-aware navigation and permissions.
- Safe operational defaults: no production destructive restore, no public backup downloads, no real social crawling in tests.
- Honest Beta labeling for social Monitoring and unproven operational capabilities.

## Core Workflow

1. User signs in.
2. User opens dashboard or calendar.
3. User creates or edits scheduled content.
4. User assigns or completes related tasks.
5. Workflow moves content through review and scheduling.
6. Chat and notifications support coordination.
7. Managers inspect reports and campaign health.
8. Technical users inspect health, alerts, and backup status.

## Current Maturity

Implemented in code: frontend/PWA, backend workspace API, role/permission catalog, local/Tauri/browser repository adapters, monitoring model, technical health overview, backup scripts, performance scripts, PostgreSQL schema files.

Not yet production-proven from repository evidence: runtime PostgreSQL integration, managed PITR, real WebSocket gateway, full restore drill, full staging load test, CI workflow.
