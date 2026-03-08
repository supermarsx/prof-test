// Tauri commands that proxy requests to the Node.js backend sidecar.
// Each command serializes its arguments to JSON, POSTs to the backend,
// and returns the JSON response to the frontend.

use serde_json::Value;

use crate::sidecar;

/// Helper: POST JSON to the backend sidecar and return the response.
async fn backend_post(endpoint: &str, body: Value) -> Result<Value, String> {
    let url = format!("{}{}", sidecar::backend_url(), endpoint);
    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Backend request failed: {}", e))?;

    let json: Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse backend response: {}", e))?;

    Ok(json)
}

/// Helper: GET from the backend sidecar.
async fn backend_get(endpoint: &str) -> Result<Value, String> {
    let url = format!("{}{}", sidecar::backend_url(), endpoint);
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Backend request failed: {}", e))?;

    let json: Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse backend response: {}", e))?;

    Ok(json)
}

/// Helper: DELETE to the backend sidecar.
async fn backend_delete(endpoint: &str) -> Result<Value, String> {
    let url = format!("{}{}", sidecar::backend_url(), endpoint);
    let client = reqwest::Client::new();
    let resp = client
        .delete(&url)
        .send()
        .await
        .map_err(|e| format!("Backend request failed: {}", e))?;

    let json: Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse backend response: {}", e))?;

    Ok(json)
}

// ─── Questions ───────────────────────────────────────────────

#[tauri::command]
pub async fn list_questions() -> Result<Value, String> {
    backend_get("/api/questions").await
}

#[tauri::command]
pub async fn search_questions(text: String) -> Result<Value, String> {
    backend_post("/api/questions/search", serde_json::json!({ "text": text })).await
}

#[tauri::command]
pub async fn get_question(id: String) -> Result<Value, String> {
    backend_get(&format!("/api/questions/{}", id)).await
}

#[tauri::command]
pub async fn add_question(question: Value) -> Result<Value, String> {
    backend_post("/api/questions", question).await
}

#[tauri::command]
pub async fn update_question(id: String, patch: Value) -> Result<Value, String> {
    backend_post(&format!("/api/questions/{}/update", id), patch).await
}

#[tauri::command]
pub async fn remove_question(id: String) -> Result<Value, String> {
    backend_delete(&format!("/api/questions/{}", id)).await
}

#[tauri::command]
pub async fn increment_question_usage(id: String) -> Result<Value, String> {
    backend_post(&format!("/api/questions/{}/increment-usage", id), serde_json::json!({})).await
}

#[tauri::command]
pub async fn export_questions_json(file_path: String) -> Result<Value, String> {
    backend_post("/api/questions/export/json", serde_json::json!({ "filePath": file_path })).await
}

#[tauri::command]
pub async fn import_questions_json(file_path: String, mode: String) -> Result<Value, String> {
    backend_post("/api/questions/import/json", serde_json::json!({ "filePath": file_path, "mode": mode })).await
}

#[tauri::command]
pub async fn export_questions_yaml(file_path: String) -> Result<Value, String> {
    backend_post("/api/questions/export/yaml", serde_json::json!({ "filePath": file_path })).await
}

#[tauri::command]
pub async fn import_questions_yaml(file_path: String, mode: String) -> Result<Value, String> {
    backend_post("/api/questions/import/yaml", serde_json::json!({ "filePath": file_path, "mode": mode })).await
}

#[tauri::command]
pub async fn export_question_metadata_csv(file_path: String) -> Result<Value, String> {
    backend_post("/api/questions/export/metadata-csv", serde_json::json!({ "filePath": file_path })).await
}

// ─── Exports ─────────────────────────────────────────────────

#[tauri::command]
pub async fn export_answer_key_csv(test_id: String, versions: Value, file_path: String) -> Result<Value, String> {
    backend_post("/api/exports/answer-key-csv", serde_json::json!({
        "testId": test_id,
        "versions": versions,
        "filePath": file_path
    })).await
}

#[tauri::command]
pub async fn export_grading_matrix_xlsx(test_id: String, versions: Value, file_path: String) -> Result<Value, String> {
    backend_post("/api/exports/grading-matrix-xlsx", serde_json::json!({
        "testId": test_id,
        "versions": versions,
        "filePath": file_path
    })).await
}

#[tauri::command]
pub async fn export_response_template(test_id: String, versions: Value, file_path: String) -> Result<Value, String> {
    backend_post("/api/exports/response-template", serde_json::json!({
        "testId": test_id,
        "versions": versions,
        "filePath": file_path
    })).await
}

#[tauri::command]
pub async fn export_mixed_grading_xlsx(test_id: String, versions: Value, file_path: String) -> Result<Value, String> {
    backend_post("/api/exports/mixed-grading-xlsx", serde_json::json!({
        "testId": test_id,
        "versions": versions,
        "filePath": file_path
    })).await
}

// ─── Export Profiles ─────────────────────────────────────────

#[tauri::command]
pub async fn list_export_profiles() -> Result<Value, String> {
    backend_get("/api/export-profiles").await
}

#[tauri::command]
pub async fn upsert_export_profile(profile: Value) -> Result<Value, String> {
    backend_post("/api/export-profiles", profile).await
}

#[tauri::command]
pub async fn remove_export_profile(id: String) -> Result<Value, String> {
    backend_delete(&format!("/api/export-profiles/{}", id)).await
}

// ─── Presets ─────────────────────────────────────────────────

#[tauri::command]
pub async fn list_header_presets() -> Result<Value, String> {
    backend_get("/api/presets/header").await
}

#[tauri::command]
pub async fn upsert_header_preset(preset: Value) -> Result<Value, String> {
    backend_post("/api/presets/header", preset).await
}

#[tauri::command]
pub async fn remove_header_preset(id: String) -> Result<Value, String> {
    backend_delete(&format!("/api/presets/header/{}", id)).await
}

#[tauri::command]
pub async fn list_layout_presets() -> Result<Value, String> {
    backend_get("/api/presets/layout").await
}

#[tauri::command]
pub async fn upsert_layout_preset(preset: Value) -> Result<Value, String> {
    backend_post("/api/presets/layout", preset).await
}

#[tauri::command]
pub async fn remove_layout_preset(id: String) -> Result<Value, String> {
    backend_delete(&format!("/api/presets/layout/{}", id)).await
}

// ─── Projects ────────────────────────────────────────────────

#[tauri::command]
pub async fn create_project(name: String) -> Result<Value, String> {
    backend_post("/api/projects", serde_json::json!({ "name": name })).await
}

#[tauri::command]
pub async fn list_projects() -> Result<Value, String> {
    backend_get("/api/projects").await
}

#[tauri::command]
pub async fn activate_project(name: String) -> Result<Value, String> {
    backend_post("/api/projects/activate", serde_json::json!({ "name": name })).await
}

#[tauri::command]
pub async fn get_active_project() -> Result<Value, String> {
    backend_get("/api/projects/active").await
}

#[tauri::command]
pub async fn save_media(project_name: String, filename: String, base64: String) -> Result<Value, String> {
    backend_post("/api/projects/media", serde_json::json!({
        "projectName": project_name,
        "filename": filename,
        "base64": base64
    })).await
}

#[tauri::command]
pub async fn list_media(project_name: String) -> Result<Value, String> {
    backend_get(&format!("/api/projects/{}/media", project_name)).await
}

#[tauri::command]
pub async fn export_project(name: String, out_path: String) -> Result<Value, String> {
    backend_post("/api/projects/export", serde_json::json!({
        "name": name,
        "outPath": out_path
    })).await
}

#[tauri::command]
pub async fn import_project(archive_path: String, name: String) -> Result<Value, String> {
    backend_post("/api/projects/import", serde_json::json!({
        "archivePath": archive_path,
        "name": name
    })).await
}

// ─── Test Templates ──────────────────────────────────────────

#[tauri::command]
pub async fn list_test_templates() -> Result<Value, String> {
    backend_get("/api/test-templates").await
}

#[tauri::command]
pub async fn get_test_template(id: String) -> Result<Value, String> {
    backend_get(&format!("/api/test-templates/{}", id)).await
}

#[tauri::command]
pub async fn upsert_test_template(template: Value) -> Result<Value, String> {
    backend_post("/api/test-templates", template).await
}

#[tauri::command]
pub async fn remove_test_template(id: String) -> Result<Value, String> {
    backend_delete(&format!("/api/test-templates/{}", id)).await
}

// ─── Test Instances ──────────────────────────────────────────

#[tauri::command]
pub async fn list_test_instances(template_id: Option<String>) -> Result<Value, String> {
    match template_id {
        Some(tid) => backend_get(&format!("/api/test-instances?templateId={}", tid)).await,
        None => backend_get("/api/test-instances").await,
    }
}

#[tauri::command]
pub async fn get_test_instance(id: String) -> Result<Value, String> {
    backend_get(&format!("/api/test-instances/{}", id)).await
}

#[tauri::command]
pub async fn upsert_test_instance(instance: Value) -> Result<Value, String> {
    backend_post("/api/test-instances", instance).await
}

#[tauri::command]
pub async fn remove_test_instance(id: String) -> Result<Value, String> {
    backend_delete(&format!("/api/test-instances/{}", id)).await
}

// ─── Settings ────────────────────────────────────────────────

#[tauri::command]
pub async fn get_settings() -> Result<Value, String> {
    backend_get("/api/settings").await
}

#[tauri::command]
pub async fn save_settings(settings: Value) -> Result<Value, String> {
    backend_post("/api/settings", settings).await
}

#[tauri::command]
pub async fn is_encryption_available() -> Result<Value, String> {
    backend_get("/api/settings/encryption-available").await
}

// ─── LaTeX ───────────────────────────────────────────────────

#[tauri::command]
pub async fn compile_latex(source: String, filename: String, options: Option<Value>) -> Result<Value, String> {
    backend_post("/api/latex/compile", serde_json::json!({
        "source": source,
        "filename": filename,
        "options": options
    })).await
}

#[tauri::command]
pub async fn detect_latex() -> Result<Value, String> {
    backend_get("/api/latex/detect").await
}

#[tauri::command]
pub async fn render_test_latex(questions: Value, instances: Value, context: Value, sections: Option<Value>) -> Result<Value, String> {
    backend_post("/api/latex/render-test", serde_json::json!({
        "questions": questions,
        "instances": instances,
        "context": context,
        "sections": sections
    })).await
}

#[tauri::command]
pub async fn render_answer_key_latex(questions: Value, instances: Value, answer_key: Value, context: Value) -> Result<Value, String> {
    backend_post("/api/latex/render-answer-key", serde_json::json!({
        "questions": questions,
        "instances": instances,
        "answerKey": answer_key,
        "context": context
    })).await
}

// ─── AI ──────────────────────────────────────────────────────

#[tauri::command]
pub async fn configure_ai(config: Value) -> Result<Value, String> {
    backend_post("/api/ai/configure", config).await
}

#[tauri::command]
pub async fn ai_generate_questions(request: Value) -> Result<Value, String> {
    backend_post("/api/ai/generate-questions", request).await
}

#[tauri::command]
pub async fn ai_generate_distractors(request: Value) -> Result<Value, String> {
    backend_post("/api/ai/generate-distractors", request).await
}

#[tauri::command]
pub async fn ai_rephrase_question(request: Value) -> Result<Value, String> {
    backend_post("/api/ai/rephrase-question", request).await
}

#[tauri::command]
pub async fn ai_generate_solution(question: Value) -> Result<Value, String> {
    backend_post("/api/ai/generate-solution", question).await
}

#[tauri::command]
pub async fn ai_build_test_proposal(request: Value) -> Result<Value, String> {
    backend_post("/api/ai/build-test-proposal", request).await
}

// ─── Solver ──────────────────────────────────────────────────

#[tauri::command]
pub async fn solve_constraints(constraints: Value) -> Result<Value, String> {
    backend_post("/api/solver/solve", constraints).await
}

// ─── Test Generation ─────────────────────────────────────────

#[tauri::command]
pub async fn generate_test_versions(question_ids: Vec<String>, options: Value) -> Result<Value, String> {
    backend_post("/api/tests/generate-versions", serde_json::json!({
        "questionIds": question_ids,
        "options": options
    })).await
}

// ─── Cache ───────────────────────────────────────────────────

#[tauri::command]
pub async fn clear_ai_cache() -> Result<Value, String> {
    backend_post("/api/cache/ai/clear", serde_json::json!({})).await
}

// ─── Sidecar Status ──────────────────────────────────────────

#[tauri::command]
pub async fn get_backend_port() -> Result<u16, String> {
    Ok(sidecar::backend_port())
}
