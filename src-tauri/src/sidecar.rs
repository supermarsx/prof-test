// Sidecar management: spawns the Node.js backend server and tracks its port.

use std::sync::atomic::{AtomicU16, Ordering};
use tauri::AppHandle;

/// Global port where the backend sidecar is listening.
static BACKEND_PORT: AtomicU16 = AtomicU16::new(0);

pub fn backend_url() -> String {
    let port = BACKEND_PORT.load(Ordering::Relaxed);
    format!("http://127.0.0.1:{}", port)
}

pub fn backend_port() -> u16 {
    BACKEND_PORT.load(Ordering::Relaxed)
}

/// Start the Node.js backend sidecar.
/// The sidecar binary is expected at `sidecar/proftest-backend` (resolved by Tauri bundler).
/// If running in dev, falls back to `node dist/backend.js` or `bun run src/backend.ts`.
pub async fn start_backend(_app: &AppHandle) -> Result<(), String> {
    // Pick a free port
    let port = portpicker::pick_unused_port().ok_or("No free port available")?;
    BACKEND_PORT.store(port, Ordering::Relaxed);

    let port_str = port.to_string();

    // In development, run the backend directly with bun/node.
    // In production, the sidecar binary is bundled.
    let is_dev = cfg!(debug_assertions);

    let _handle = if is_dev {
        // Dev mode: run via bun or node
        std::thread::spawn(move || {
            let status = std::process::Command::new("bun")
                .arg("run")
                .arg("src/backend.ts")
                .env("BACKEND_PORT", &port_str)
                .current_dir(std::env::current_dir().unwrap_or_default())
                .status();
            
            match status {
                Ok(s) if !s.success() => {
                    // Fallback to node
                    let _ = std::process::Command::new("node")
                        .arg("dist/backend.js")
                        .env("BACKEND_PORT", &port_str)
                        .current_dir(std::env::current_dir().unwrap_or_default())
                        .status();
                }
                Err(_) => {
                    // Fallback to node
                    let _ = std::process::Command::new("node")
                        .arg("dist/backend.js")
                        .env("BACKEND_PORT", &port_str)
                        .current_dir(std::env::current_dir().unwrap_or_default())
                        .status();
                }
                _ => {}
            }
        })
    } else {
        // Production: use bundled sidecar
        std::thread::spawn(move || {
            let exe_dir = std::env::current_exe()
                .map(|p| p.parent().unwrap_or(std::path::Path::new(".")).to_path_buf())
                .unwrap_or_default();
            
            let sidecar = exe_dir.join("proftest-backend");
            let _ = std::process::Command::new(sidecar)
                .env("BACKEND_PORT", &port_str)
                .status();
        })
    };

    // Wait a moment for the server to start
    tokio::time::sleep(std::time::Duration::from_millis(1500)).await;

    // Verify it's running
    let url = format!("http://127.0.0.1:{}/health", port);
    let client = reqwest::Client::new();
    for _ in 0..20 {
        match client.get(&url).send().await {
            Ok(resp) if resp.status().is_success() => {
                println!("Backend sidecar started on port {}", port);
                return Ok(());
            }
            _ => {
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }
        }
    }

    // Even if health check fails, the port is set — frontend will retry
    println!("Warning: Backend health check timed out, port {} may still be starting", port);
    Ok(())
}
