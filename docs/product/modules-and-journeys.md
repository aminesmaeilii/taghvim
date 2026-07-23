# Modules And User Journeys

Audience: product manager, team managers, developers  
Last verified version: `0.1.1` / commit `8842877`

## Module Catalog

| Module | Routes | Main users | Permissions |
| --- | --- | --- | --- |
| Authentication | `/login`, `/force-password-change`, `/profile`, `/sessions` | all users | profile/session permissions |
| Dashboard | `/` | all active users | `dashboard.view` |
| Calendar | `/calendar`, `/jalali-calendar` | content team | app access |
| Tasks | `/tasks` | team members/managers | app access |
| Content workflow | `/contents`, `/workflow` | creators/reviewers | app access |
| Campaigns/planning | `/campaigns`, `/gantt`, `/ideas`, `/templates`, `/advertising` | content/marketing | app access |
| Chat | floating panel | all active users | chat repository membership checks |
| Notifications/reminders | topbar, task/content actions | all active users | app access |
| Reports | `/reports` | managers | `reports.view`, `reports.export` |
| Social Monitoring | `/monitoring`, `/monitoring/sources/:sourceId` | managers/monitoring users | manage actions use `settings.update` |
| Technical health | `/technical-health` | technical admins | `technical_health.read` |
| Settings/activity | `/settings`, `/activity` | admins/managers | settings/audit permissions |

## Critical Journeys

Team member: sign in, open dashboard, inspect calendar/tasks, update task status, create reminder, use chat, read notifications.

Content creator: create content, select campaign/channel/date, save, move through workflow, respond to review feedback.

Reviewer/manager: inspect workload, open content/campaign, approve or reject, view reports, inspect risk.

Monitoring user: open Monitoring, filter source, open channel page, interpret unavailable/stale data.

Technical administrator: open technical health, inspect failed jobs/errors, check backup status, use request IDs.

## Roles And Permissions

Actual roles from `shared/services/authorization.ts`:

| Role | Permission source |
| --- | --- |
| `SUPER_ADMIN` | all permissions |
| `ADMIN` | all except `roles.delete` |
| `MANAGER` | dashboard, users view, own profile/session, reports view/export |
| `USER` | dashboard, own profile/session, reports view |
| `VIEWER` | dashboard, own profile, reports view, own sessions view |

Actual permission identifiers:

`dashboard.view`, `users.view`, `users.create`, `users.update`, `users.disable`, `users.delete`, `users.restore`, `users.assign_role`, `users.assign_permission`, `users.reset_password`, `users.view_activity`, `roles.view`, `roles.create`, `roles.update`, `roles.delete`, `roles.assign_permissions`, `settings.view`, `settings.update`, `profile.view_own`, `profile.update_own`, `profile.change_password`, `reports.view`, `reports.export`, `audit_logs.view`, `security_sessions.view_own`, `security_sessions.revoke_own`, `security_sessions.manage_all`, `technical_health.read`, `technical_logs.read`, `technical_alerts.manage`, `technical_jobs.retry`, `backup.status.read`, `backup.create`, `backup.verify`, `backup.restore_test`, `backup.restore_production`, `backup.retention.manage`, `backup.delete`.

Backend/shared authorization is authoritative; frontend visibility is only a usability layer.
