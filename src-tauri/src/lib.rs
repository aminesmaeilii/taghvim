use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{Manager, State};

struct DbState(Mutex<Connection>);

fn timestamp() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.join("rooznegar.sqlite"))
}

fn default_workspace() -> Value {
    let statuses = [
        ("draft", "پیش نویس", "#64748b"), ("in_progress", "در حال انجام", "#2563eb"),
        ("review", "در انتظار بررسی", "#b45309"), ("revision", "نیازمند اصلاح", "#dc2626"),
        ("approved", "تایید شده", "#0f766e"), ("scheduled", "زمان بندی شده", "#7c3aed"),
        ("published", "منتشر شده", "#15803d"), ("archived", "بایگانی", "#475569"),
        ("cancelled", "لغو شده", "#991b1b"),
    ];
    let status_values: Vec<Value> = statuses.iter().enumerate().map(|(index, (key, name, color))| {
        let terminal = matches!(*key, "published" | "archived" | "cancelled");
        json!({
            "id": format!("status-{key}"), "createdAt": "1970-01-01T00:00:00.000Z", "updatedAt": "1970-01-01T00:00:00.000Z", "archivedAt": null,
            "sortOrder": index, "version": 1, "name": name, "key": key, "color": color, "isTerminal": terminal, "wipLimit": null
        })
    }).collect();
    let platform_names = [
        ("کانال ایتا زمبیل", "MessageCircle", "#FF334C"), ("کانال ایتا زمبیلدار", "MessageCircle", "#F31F39"),
        ("کانال بله زمبیل", "MessagesSquare", "#DF1129"), ("کانال بله زمبیل دار", "MessagesSquare", "#B2071B"),
        ("کانال روبیکا زمبیل", "PlaySquare", "#FF4D63"), ("پیج اینستاگرام زمبیل", "Instagram", "#FF334C"),
        ("برودکاست اینستاگرام زمبیل", "Megaphone", "#F31F39"), ("چنل تلگرام", "Send", "#229ed9"),
        ("پیامک به زمبیلدارا", "MessageSquare", "#DF1129"), ("پیامک به مخاطبا", "MessageSquare", "#B2071B"),
        ("ربات زمبیل در ایتا", "Bot", "#FF6E80"), ("دینگ", "BellRing", "#FF4D63"),
        ("اینستاگرام", "Instagram", "#c13584"), ("تلگرام", "Send", "#229ed9"), ("ایتا", "MessageCircle", "#f59e0b"),
        ("بله", "MessagesSquare", "#0f766e"), ("روبیکا", "PlaySquare", "#dc2626"), ("واتساپ", "MessageCircle", "#16a34a"),
        ("لینکدین", "Linkedin", "#0a66c2"), ("ایکس", "AtSign", "#111827"), ("یوتیوب", "Youtube", "#dc2626"),
        ("وب سایت", "Globe2", "#0f766e"), ("ایمیل", "Mail", "#2563eb"), ("پیامک", "MessageSquare", "#7c3aed"),
        ("سایر", "MoreHorizontal", "#64748b"),
    ];
    let platforms: Vec<Value> = platform_names.iter().enumerate().map(|(index, (name, icon, color))| json!({
        "id": format!("platform-{}", index + 1), "createdAt": "1970-01-01T00:00:00.000Z", "updatedAt": "1970-01-01T00:00:00.000Z", "archivedAt": null,
        "sortOrder": index, "version": 1, "name": name, "icon": icon, "color": color, "characterLimit": null, "preferredTypes": [], "defaultPublishingTime": null, "notes": null
    })).collect();
    let type_names = ["تولید محتوا", "پست", "استوری", "ریلز", "ویدئو", "مقاله", "خبر", "گزارش", "پادکست", "ایمیل", "پیامک", "سایر"];
    let types: Vec<Value> = type_names.iter().enumerate().map(|(index, name)| {
        let type_color = ["#FF334C", "#F31F39", "#DF1129", "#B2071B", "#FF6E80", "#FFC0C8"][index % 6];
        json!({
            "id": format!("type-{}", index + 1), "createdAt": "1970-01-01T00:00:00.000Z", "updatedAt": "1970-01-01T00:00:00.000Z", "archivedAt": null,
            "sortOrder": index, "version": 1, "name": name, "icon": "FileText", "color": type_color
        })
    }).collect();
    let pillars: Vec<Value> = ["آموزشی", "خبری", "سرگرمی", "تعاملی", "تبلیغاتی", "اعتمادسازی", "فروش", "برندینگ", "مناسبتی"].iter().enumerate().map(|(index, name)| json!({
        "id": format!("pillar-{}", index + 1), "createdAt": "1970-01-01T00:00:00.000Z", "updatedAt": "1970-01-01T00:00:00.000Z", "archivedAt": null,
        "sortOrder": index, "version": 1, "name": name, "color": "#0f766e", "description": null
    })).collect();
    json!({ "contents": [], "platforms": platforms, "types": types, "statuses": status_values, "campaigns": [], "tags": [], "pillars": pillars, "ideas": [], "templates": [], "userProfiles": [], "activityLog": [], "kpiEntries": [], "learningMaterials": [], "highlights": [], "personalNotes": [], "adBudgets": [], "settings": null })
}

fn read_workspace(connection: &Connection) -> Result<Value, String> {
    let raw: Option<String> = connection.query_row("SELECT data FROM workspace_snapshots WHERE id = 1", [], |row| row.get(0)).optional().map_err(|error| error.to_string())?;
    let mut workspace = match raw { Some(value) => serde_json::from_str(&value).map_err(|error| error.to_string())?, None => default_workspace() };
    if let Some(object) = workspace.as_object_mut() {
        object.entry("userProfiles").or_insert_with(|| json!([]));
        object.entry("activityLog").or_insert_with(|| json!([]));
        object.entry("kpiEntries").or_insert_with(|| json!([]));
        object.entry("learningMaterials").or_insert_with(|| json!([]));
        object.entry("highlights").or_insert_with(|| json!([]));
        object.entry("personalNotes").or_insert_with(|| json!([]));
        object.entry("adBudgets").or_insert_with(|| json!([]));
    }
    Ok(workspace)
}

fn write_workspace(connection: &Connection, workspace: &Value) -> Result<(), String> {
    let raw = serde_json::to_string(workspace).map_err(|error| error.to_string())?;
    connection.execute("INSERT INTO workspace_snapshots (id, data, updated_at) VALUES (1, ?1, ?2) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at", params![raw, timestamp()]).map_err(|error| error.to_string())?;
    Ok(())
}

fn array_mut<'a>(workspace: &'a mut Value, key: &str) -> Result<&'a mut Vec<Value>, String> {
    workspace.get_mut(key).and_then(Value::as_array_mut).ok_or_else(|| format!("ساختار فضای کاری برای {key} معتبر نیست."))
}

fn merge_entity(list: &mut Vec<Value>, mut incoming: Value) -> Result<Value, String> {
    let object = incoming.as_object_mut().ok_or_else(|| "رکورد معتبر نیست.".to_string())?;
    let id = object.get("id").and_then(Value::as_str).filter(|value| !value.is_empty()).map(str::to_owned).unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    object.insert("id".to_string(), Value::String(id.clone()));
    object.entry("createdAt".to_string()).or_insert_with(|| Value::String(timestamp()));
    object.insert("updatedAt".to_string(), Value::String(timestamp()));
    if let Some(existing) = list.iter_mut().find(|item| item.get("id").and_then(Value::as_str) == Some(id.as_str())) { *existing = incoming.clone(); } else { list.push(incoming.clone()); }
    Ok(incoming)
}

fn save_entity(state: &State<'_, DbState>, key: &str, entity: Value) -> Result<Value, String> {
    let connection = state.0.lock().map_err(|_| "قفل پایگاه داده آزاد نشد.".to_string())?;
    let mut workspace = read_workspace(&connection)?;
    let result = merge_entity(array_mut(&mut workspace, key)?, entity)?;
    write_workspace(&connection, &workspace)?;
    Ok(result)
}

#[tauri::command]
fn bootstrap_workspace(state: State<'_, DbState>) -> Result<Value, String> {
    let connection = state.0.lock().map_err(|_| "قفل پایگاه داده آزاد نشد.".to_string())?;
    read_workspace(&connection)
}

#[tauri::command]
fn list_contents(state: State<'_, DbState>, filters: Option<Value>) -> Result<Vec<Value>, String> {
    let connection = state.0.lock().map_err(|_| "قفل پایگاه داده آزاد نشد.".to_string())?;
    let workspace = read_workspace(&connection)?;
    let items = workspace.get("contents").and_then(Value::as_array).cloned().unwrap_or_default();
    let filters = filters.unwrap_or_else(|| json!({}));
    let query = filters.get("search").and_then(Value::as_str).unwrap_or("").to_lowercase();
    let status = filters.get("status").and_then(Value::as_array);
    let platforms = filters.get("platformIds").and_then(Value::as_array);
    Ok(items.into_iter().filter(|item| {
        let archived = item.get("archivedAt").is_some_and(|value| !value.is_null());
        let searchable = serde_json::to_string(item).unwrap_or_default().to_lowercase();
        let status_ok = status.map(|values| values.iter().any(|value| value.as_str() == item.get("status").and_then(Value::as_str))).unwrap_or(true);
        let platform_ok = platforms.map(|values| values.iter().any(|value| value.as_str() == item.get("platformId").and_then(Value::as_str))).unwrap_or(true);
        !archived && (query.is_empty() || searchable.contains(&query)) && status_ok && platform_ok
    }).collect())
}

#[tauri::command]
fn save_content(state: State<'_, DbState>, content: Value) -> Result<Value, String> { save_entity(&state, "contents", content) }

#[tauri::command]
fn archive_content(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let connection = state.0.lock().map_err(|_| "قفل پایگاه داده آزاد نشد.".to_string())?;
    let mut workspace = read_workspace(&connection)?;
    let item = array_mut(&mut workspace, "contents")?.iter_mut().find(|item| item.get("id").and_then(Value::as_str) == Some(id.as_str())).ok_or_else(|| "محتوا پیدا نشد.".to_string())?;
    let object = item.as_object_mut().ok_or_else(|| "رکورد محتوا معتبر نیست.".to_string())?;
    object.insert("archivedAt".to_string(), Value::String(timestamp()));
    object.insert("status".to_string(), Value::String("archived".to_string()));
    write_workspace(&connection, &workspace)
}

#[tauri::command]
fn delete_content(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let connection = state.0.lock().map_err(|_| "قفل پایگاه داده آزاد نشد.".to_string())?;
    let mut workspace = read_workspace(&connection)?;
    array_mut(&mut workspace, "contents")?.retain(|item| item.get("id").and_then(Value::as_str) != Some(id.as_str()));
    write_workspace(&connection, &workspace)
}

#[tauri::command]
fn move_content(state: State<'_, DbState>, id: String, publication_date: String, status: Option<String>) -> Result<Value, String> {
    let connection = state.0.lock().map_err(|_| "قفل پایگاه داده آزاد نشد.".to_string())?;
    let mut workspace = read_workspace(&connection)?;
    let item = array_mut(&mut workspace, "contents")?.iter_mut().find(|item| item.get("id").and_then(Value::as_str) == Some(id.as_str())).ok_or_else(|| "محتوا پیدا نشد.".to_string())?;
    let object = item.as_object_mut().ok_or_else(|| "رکورد محتوا معتبر نیست.".to_string())?;
    object.insert("publicationDate".to_string(), Value::String(publication_date));
    if let Some(value) = status { object.insert("status".to_string(), Value::String(value)); }
    object.insert("updatedAt".to_string(), Value::String(timestamp()));
    let result = item.clone();
    write_workspace(&connection, &workspace)?;
    Ok(result)
}

#[tauri::command]
fn duplicate_content(state: State<'_, DbState>, id: String, options: Option<Value>) -> Result<Value, String> {
    let connection = state.0.lock().map_err(|_| "قفل پایگاه داده آزاد نشد.".to_string())?;
    let mut workspace = read_workspace(&connection)?;
    let source = array_mut(&mut workspace, "contents")?.iter().find(|item| item.get("id").and_then(Value::as_str) == Some(id.as_str())).cloned().ok_or_else(|| "محتوا پیدا نشد.".to_string())?;
    let mut duplicate = source;
    let object = duplicate.as_object_mut().ok_or_else(|| "رکورد محتوا معتبر نیست.".to_string())?;
    object.insert("id".to_string(), Value::String(uuid::Uuid::new_v4().to_string()));
    object.insert("title".to_string(), Value::String(format!("{} (کپی)", object.get("title").and_then(Value::as_str).unwrap_or("محتوا"))));
    object.insert("status".to_string(), Value::String("draft".to_string()));
    let keep_schedule = options.as_ref().and_then(|value| value.get("copySchedule")).and_then(Value::as_bool).unwrap_or(false);
    if !keep_schedule { object.insert("publicationTime".to_string(), Value::Null); }
    object.insert("createdAt".to_string(), Value::String(timestamp()));
    object.insert("updatedAt".to_string(), Value::String(timestamp()));
    array_mut(&mut workspace, "contents")?.push(duplicate.clone());
    write_workspace(&connection, &workspace)?;
    Ok(duplicate)
}

#[tauri::command]
fn save_campaign(state: State<'_, DbState>, campaign: Value) -> Result<Value, String> { save_entity(&state, "campaigns", campaign) }
#[tauri::command]
fn save_idea(state: State<'_, DbState>, idea: Value) -> Result<Value, String> { save_entity(&state, "ideas", idea) }
#[tauri::command]
fn save_template(state: State<'_, DbState>, template: Value) -> Result<Value, String> { save_entity(&state, "templates", template) }

#[tauri::command]
fn delete_entity(state: State<'_, DbState>, entity: String, id: String) -> Result<(), String> {
    let key = match entity.as_str() { "campaign" => "campaigns", "idea" => "ideas", "template" => "templates", _ => return Err("نوع رکورد معتبر نیست.".to_string()) };
    let connection = state.0.lock().map_err(|_| "قفل پایگاه داده آزاد نشد.".to_string())?;
    let mut workspace = read_workspace(&connection)?;
    array_mut(&mut workspace, key)?.retain(|item| item.get("id").and_then(Value::as_str) != Some(id.as_str()));
    write_workspace(&connection, &workspace)
}

#[tauri::command]
fn save_reference(state: State<'_, DbState>, kind: String, entity: Value) -> Result<Value, String> {
    let key = match kind.as_str() { "platform" => "platforms", "type" => "types", "status" => "statuses", "pillar" => "pillars", "tag" => "tags", _ => return Err("نوع داده مرجع معتبر نیست.".to_string()) };
    save_entity(&state, key, entity)
}

#[tauri::command]
fn delete_reference(state: State<'_, DbState>, kind: String, id: String) -> Result<(), String> {
    let key = match kind.as_str() { "platform" => "platforms", "type" => "types", "status" => "statuses", "pillar" => "pillars", "tag" => "tags", _ => return Err("نوع داده مرجع معتبر نیست.".to_string()) };
    let connection = state.0.lock().map_err(|_| "قفل پایگاه داده آزاد نشد.".to_string())?;
    let mut workspace = read_workspace(&connection)?;
    array_mut(&mut workspace, key)?.retain(|item| item.get("id").and_then(Value::as_str) != Some(id.as_str()));
    write_workspace(&connection, &workspace)
}

#[tauri::command]
fn get_settings(state: State<'_, DbState>) -> Result<Option<Value>, String> {
    let connection = state.0.lock().map_err(|_| "قفل پایگاه داده آزاد نشد.".to_string())?;
    Ok(read_workspace(&connection)?.get("settings").filter(|value| !value.is_null()).cloned())
}

#[tauri::command]
fn save_settings(state: State<'_, DbState>, settings: Value) -> Result<(), String> {
    let connection = state.0.lock().map_err(|_| "قفل پایگاه داده آزاد نشد.".to_string())?;
    let mut workspace = read_workspace(&connection)?;
    workspace.as_object_mut().ok_or_else(|| "فضای کاری معتبر نیست.".to_string())?.insert("settings".to_string(), settings);
    write_workspace(&connection, &workspace)
}

#[tauri::command]
fn get_dashboard(state: State<'_, DbState>) -> Result<Value, String> {
    let items = list_contents(state, None)?;
    Ok(json!({ "today": [], "upcoming": items.iter().take(5).cloned().collect::<Vec<_>>(), "overdue": [], "awaitingReview": items.iter().filter(|item| item.get("status").and_then(Value::as_str) == Some("review")).cloned().collect::<Vec<_>>(), "scheduled": items.iter().filter(|item| item.get("status").and_then(Value::as_str) == Some("scheduled")).cloned().collect::<Vec<_>>(), "recentlyPublished": items.iter().filter(|item| item.get("status").and_then(Value::as_str) == Some("published")).take(5).cloned().collect::<Vec<_>>() }))
}

#[tauri::command]
fn export_workspace(state: State<'_, DbState>) -> Result<String, String> {
    let connection = state.0.lock().map_err(|_| "قفل پایگاه داده آزاد نشد.".to_string())?;
    serde_json::to_string_pretty(&json!({ "version": 1, "exportedAt": timestamp(), "workspace": read_workspace(&connection)? })).map_err(|error| error.to_string())
}

#[tauri::command]
fn import_workspace(state: State<'_, DbState>, raw: String) -> Result<Value, String> {
    let parsed: Value = serde_json::from_str(&raw).map_err(|_| "ساختار فایل پشتیبان معتبر نیست.".to_string())?;
    let incoming_workspace = parsed.get("workspace").and_then(Value::as_object).ok_or_else(|| "ساختار فضای کاری در فایل پیدا نشد.".to_string())?;
    let connection = state.0.lock().map_err(|_| "قفل پایگاه داده آزاد نشد.".to_string())?;
    let mut workspace = read_workspace(&connection)?;
    let mut imported = 0;
    let mut skipped = 0;
    let mut errors: Vec<String> = Vec::new();
    for key in ["contents", "platforms", "types", "statuses", "campaigns", "tags", "pillars", "ideas", "templates"] {
        let Some(incoming) = incoming_workspace.get(key) else { continue };
        let Some(incoming) = incoming.as_array() else { errors.push(format!("بخش {key} آرایه نیست.")); continue };
        let list = array_mut(&mut workspace, key)?;
        let mut existing: std::collections::HashSet<String> = list.iter().filter_map(|item| item.get("id").and_then(Value::as_str).map(str::to_owned)).collect();
        for item in incoming {
            let Some(id) = item.get("id").and_then(Value::as_str) else { errors.push(format!("یک رکورد نامعتبر در بخش {key} نادیده گرفته شد.")); continue };
            if existing.contains(id) { skipped += 1; } else { list.push(item.clone()); existing.insert(id.to_string()); imported += 1; }
        }
    }
    if let Some(settings) = parsed.get("settings").or_else(|| incoming_workspace.get("settings")) { workspace.as_object_mut().ok_or_else(|| "فضای کاری معتبر نیست.".to_string())?.insert("settings".to_string(), settings.clone()); }
    write_workspace(&connection, &workspace)?;
    Ok(json!({ "imported": imported, "skipped": skipped, "errors": errors }))
}

#[tauri::command]
fn create_backup(state: State<'_, DbState>) -> Result<String, String> { export_workspace(state) }

#[tauri::command]
fn save_profile(state: State<'_, DbState>, profile: Value) -> Result<Value, String> {
    let connection = state.0.lock().map_err(|_| "قفل پایگاه داده آزاد نشد.".to_string())?;
    let mut workspace = read_workspace(&connection)?;
    let user_id = profile.get("userId").and_then(Value::as_str).ok_or_else(|| "شناسه کاربر معتبر نیست.".to_string())?.to_string();
    let mut saved = profile;
    let object = saved.as_object_mut().ok_or_else(|| "رکورد پروفایل معتبر نیست.".to_string())?;
    object.insert("id".to_string(), Value::String(user_id.clone()));
    object.insert("updatedAt".to_string(), Value::String(timestamp()));
    let list = array_mut(&mut workspace, "userProfiles")?;
    if let Some(existing) = list.iter_mut().find(|item| item.get("userId").and_then(Value::as_str) == Some(user_id.as_str())) { *existing = saved.clone(); } else { list.push(saved.clone()); }
    write_workspace(&connection, &workspace)?;
    Ok(saved)
}

#[tauri::command]
fn log_activity(state: State<'_, DbState>, entry: Value) -> Result<Value, String> {
    let connection = state.0.lock().map_err(|_| "قفل پایگاه داده آزاد نشد.".to_string())?;
    let mut workspace = read_workspace(&connection)?;
    let mut saved = entry;
    let object = saved.as_object_mut().ok_or_else(|| "رکورد فعالیت معتبر نیست.".to_string())?;
    object.insert("id".to_string(), Value::String(uuid::Uuid::new_v4().to_string()));
    object.insert("createdAt".to_string(), Value::String(timestamp()));
    let list = array_mut(&mut workspace, "activityLog")?;
    list.insert(0, saved.clone());
    if list.len() > 500 { list.truncate(500); }
    write_workspace(&connection, &workspace)?;
    Ok(saved)
}

#[tauri::command]
fn save_kpi_entry(state: State<'_, DbState>, entry: Value) -> Result<Value, String> {
    let connection = state.0.lock().map_err(|_| "قفل پایگاه داده آزاد نشد.".to_string())?;
    let mut workspace = read_workspace(&connection)?;
    let mut saved = entry;
    let object = saved.as_object_mut().ok_or_else(|| "رکورد شاخص معتبر نیست.".to_string())?;
    object.insert("id".to_string(), Value::String(uuid::Uuid::new_v4().to_string()));
    object.insert("recordedAt".to_string(), Value::String(timestamp()));
    array_mut(&mut workspace, "kpiEntries")?.push(saved.clone());
    write_workspace(&connection, &workspace)?;
    Ok(saved)
}

#[tauri::command]
fn save_learning_material(state: State<'_, DbState>, material: Value) -> Result<Value, String> { save_entity(&state, "learningMaterials", material) }

#[tauri::command]
fn delete_learning_material(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let connection = state.0.lock().map_err(|_| "قفل پایگاه داده آزاد نشد.".to_string())?;
    let mut workspace = read_workspace(&connection)?;
    array_mut(&mut workspace, "learningMaterials")?.retain(|item| item.get("id").and_then(Value::as_str) != Some(id.as_str()));
    array_mut(&mut workspace, "highlights")?.retain(|item| item.get("materialId").and_then(Value::as_str) != Some(id.as_str()));
    write_workspace(&connection, &workspace)
}

#[tauri::command]
fn save_highlight(state: State<'_, DbState>, highlight: Value) -> Result<Value, String> {
    let connection = state.0.lock().map_err(|_| "قفل پایگاه داده آزاد نشد.".to_string())?;
    let mut workspace = read_workspace(&connection)?;
    let mut saved = highlight;
    let object = saved.as_object_mut().ok_or_else(|| "رکورد هایلایت معتبر نیست.".to_string())?;
    object.insert("id".to_string(), Value::String(uuid::Uuid::new_v4().to_string()));
    object.insert("createdAt".to_string(), Value::String(timestamp()));
    array_mut(&mut workspace, "highlights")?.push(saved.clone());
    write_workspace(&connection, &workspace)?;
    Ok(saved)
}

#[tauri::command]
fn delete_highlight(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let connection = state.0.lock().map_err(|_| "قفل پایگاه داده آزاد نشد.".to_string())?;
    let mut workspace = read_workspace(&connection)?;
    array_mut(&mut workspace, "highlights")?.retain(|item| item.get("id").and_then(Value::as_str) != Some(id.as_str()));
    write_workspace(&connection, &workspace)
}

#[tauri::command]
fn save_personal_note(state: State<'_, DbState>, note: Value) -> Result<Value, String> { save_entity(&state, "personalNotes", note) }

#[tauri::command]
fn delete_personal_note(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let connection = state.0.lock().map_err(|_| "قفل پایگاه داده آزاد نشد.".to_string())?;
    let mut workspace = read_workspace(&connection)?;
    array_mut(&mut workspace, "personalNotes")?.retain(|item| item.get("id").and_then(Value::as_str) != Some(id.as_str()));
    write_workspace(&connection, &workspace)
}

#[tauri::command]
fn save_ad_budget(state: State<'_, DbState>, budget: Value) -> Result<Value, String> { save_entity(&state, "adBudgets", budget) }

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let path = database_path(app.handle())?;
            let connection = Connection::open(path).map_err(|error| error.to_string())?;
            connection.execute_batch(include_str!("../migrations/001_initial.sql")).map_err(|error| error.to_string())?;
            app.manage(DbState(Mutex::new(connection)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![bootstrap_workspace, list_contents, save_content, archive_content, delete_content, move_content, duplicate_content, save_campaign, save_idea, save_template, delete_entity, save_reference, delete_reference, get_settings, save_settings, get_dashboard, export_workspace, import_workspace, create_backup, save_profile, log_activity, save_kpi_entry, save_learning_material, delete_learning_material, save_highlight, delete_highlight, save_personal_note, delete_personal_note, save_ad_budget])
        .run(tauri::generate_context!())
        .expect("خطای اجرای روزنگار");
}
