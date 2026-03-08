// ProfTest Tauri v2 Application
// The Rust backend acts as a thin shell:
// - Manages the native window and system integration
// - Spawns a Node.js sidecar that hosts the TS business logic
// - Exposes Tauri commands that proxy to the sidecar's HTTP API
// - Provides native dialog, filesystem, and security APIs

mod commands;
mod sidecar;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            // Spawn the Node.js sidecar backend server
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = sidecar::start_backend(&app_handle).await {
                    eprintln!("Failed to start backend sidecar: {}", e);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Questions
            commands::list_questions,
            commands::search_questions,
            commands::get_question,
            commands::add_question,
            commands::update_question,
            commands::remove_question,
            commands::increment_question_usage,
            commands::export_questions_json,
            commands::import_questions_json,
            commands::export_questions_yaml,
            commands::import_questions_yaml,
            commands::export_question_metadata_csv,
            // Exports
            commands::export_answer_key_csv,
            commands::export_grading_matrix_xlsx,
            commands::export_response_template,
            commands::export_mixed_grading_xlsx,
            // Export profiles
            commands::list_export_profiles,
            commands::upsert_export_profile,
            commands::remove_export_profile,
            // Presets
            commands::list_header_presets,
            commands::upsert_header_preset,
            commands::remove_header_preset,
            commands::list_layout_presets,
            commands::upsert_layout_preset,
            commands::remove_layout_preset,
            // Projects
            commands::create_project,
            commands::list_projects,
            commands::activate_project,
            commands::get_active_project,
            commands::save_media,
            commands::list_media,
            commands::export_project,
            commands::import_project,
            // Test templates
            commands::list_test_templates,
            commands::get_test_template,
            commands::upsert_test_template,
            commands::remove_test_template,
            // Test instances
            commands::list_test_instances,
            commands::get_test_instance,
            commands::upsert_test_instance,
            commands::remove_test_instance,
            // Settings
            commands::get_settings,
            commands::save_settings,
            commands::is_encryption_available,
            // LaTeX
            commands::compile_latex,
            commands::detect_latex,
            commands::render_test_latex,
            commands::render_answer_key_latex,
            // AI
            commands::configure_ai,
            commands::ai_generate_questions,
            commands::ai_generate_distractors,
            commands::ai_rephrase_question,
            commands::ai_generate_solution,
            commands::ai_build_test_proposal,
            // Solver
            commands::solve_constraints,
            // Test generation
            commands::generate_test_versions,
            // Cache
            commands::clear_ai_cache,
            // Sidecar status
            commands::get_backend_port,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
