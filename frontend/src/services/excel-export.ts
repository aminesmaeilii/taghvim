import type { WorkspaceData } from "@shared/types/domain";

type CellValue = unknown;
type Row = Record<string, CellValue>;
type Sheet = { name: string; rows: Row[] };

const baseColumns = ["id", "createdAt", "updatedAt", "archivedAt", "sortOrder", "version"];

export function buildWorkspaceExcel(workspace: WorkspaceData): string {
  const sheets: Sheet[] = [
    { name: "Contents", rows: toRows(workspace.contents) },
    { name: "Campaigns", rows: toRows(workspace.campaigns) },
    { name: "Ideas", rows: toRows(workspace.ideas) },
    { name: "Templates", rows: toRows(workspace.templates) },
    { name: "Tasks", rows: toRows(workspace.tasks) },
    { name: "Ad Budgets", rows: toRows(workspace.adBudgets) },
    { name: "Personal Notes", rows: toRows(workspace.personalNotes) },
    { name: "Learning Materials", rows: toRows(workspace.learningMaterials) },
    { name: "Highlights", rows: toRows(workspace.highlights) },
    { name: "Activity Log", rows: toRows(workspace.activityLog) },
    { name: "User Profiles", rows: toRows(workspace.userProfiles) },
    { name: "Platforms", rows: toRows(workspace.platforms) },
    { name: "Content Types", rows: toRows(workspace.types) },
    { name: "Statuses", rows: toRows(workspace.statuses) },
    { name: "Pillars", rows: toRows(workspace.pillars) },
    { name: "Tags", rows: toRows(workspace.tags) },
    { name: "Chat Conversations", rows: toRows(workspace.chatConversations ?? []) },
    { name: "Chat Members", rows: toRows(workspace.chatMembers ?? []) },
    { name: "Chat Messages", rows: toRows(workspace.chatMessages ?? []) },
    { name: "Reminders", rows: toRows(workspace.reminders ?? []) },
    { name: "Push Subscriptions", rows: toRows(workspace.pushSubscriptions ?? []) },
    { name: "Notifications", rows: toRows(workspace.notifications ?? []) },
  ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>Rooznegar</Author>
  <Created>${escapeXml(new Date().toISOString())}</Created>
 </DocumentProperties>
 ${sheets.map(renderSheet).join("\n")}
</Workbook>`;
}

export function downloadWorkspaceExcel(workspace: WorkspaceData): void {
  const raw = buildWorkspaceExcel(workspace);
  const url = URL.createObjectURL(new Blob([raw], { type: "application/vnd.ms-excel;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `rooznegar-workspace-${new Date().toISOString().slice(0, 10)}.xls`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function renderSheet(sheet: Sheet): string {
  const columns = collectColumns(sheet.rows);
  const rows = [columns, ...sheet.rows.map((row) => columns.map((column) => row[column]))];
  return `<Worksheet ss:Name="${escapeXml(sheet.name)}">
  <Table>
   ${rows.map(renderRow).join("\n")}
  </Table>
 </Worksheet>`;
}

function toRows<T extends object>(items: T[]): Row[] {
  return items.map((item) => Object.fromEntries(Object.entries(item)) as Row);
}

function collectColumns(rows: Row[]): string[] {
  const keys = new Set<string>();
  baseColumns.forEach((key) => keys.add(key));
  rows.forEach((row) => Object.keys(row).forEach((key) => keys.add(key)));
  return [...keys].filter((key) => rows.some((row) => row[key] !== undefined) || !baseColumns.includes(key));
}

function renderRow(values: CellValue[]): string {
  return `   <Row>${values.map(renderCell).join("")}</Row>`;
}

function renderCell(value: CellValue): string {
  const normalized = normalizeValue(value);
  const type = typeof normalized === "number" ? "Number" : "String";
  return `<Cell><Data ss:Type="${type}">${escapeXml(String(normalized))}</Data></Cell>`;
}

function normalizeValue(value: CellValue): string | number {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? value : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return value.map((item) => typeof item === "object" ? JSON.stringify(item) : String(item)).join(" | ");
  if (typeof value === "object") return JSON.stringify(value) ?? "";
  if (typeof value === "string") return value;
  return String(value);
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
