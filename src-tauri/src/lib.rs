use serde::Serialize;
use sysinfo::System;

// What the page needs to know about this computer to decide how big a shape it can draw.
// The webview cannot see real memory or core counts, so Rust reads them.
#[derive(Serialize)]
struct Machine {
  total_mb: u64,
  available_mb: u64,
  cores: usize,
  physical_cores: Option<usize>,
  cpu: String,
  os: String,
}

#[tauri::command]
async fn system_scan() -> Machine {
  let mut sys = System::new();
  sys.refresh_memory();
  sys.refresh_cpu_all();
  let cpu = sys.cpus().first().map(|c| c.brand().trim().to_string()).unwrap_or_default();
  let cores = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(sys.cpus().len().max(1));
  Machine {
    total_mb: sys.total_memory() / 1_048_576,
    available_mb: sys.available_memory() / 1_048_576,
    cores,
    physical_cores: sys.physical_core_count(),
    cpu,
    os: System::long_os_version().unwrap_or_default(),
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![system_scan])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
  #[test]
  fn scan_reads_this_machine() {
    let m = tauri::async_runtime::block_on(super::system_scan());
    assert!(m.total_mb > 0 && m.available_mb > 0 && m.available_mb <= m.total_mb && m.cores > 0);
    println!("{}", serde_json::to_string(&m).unwrap());
  }
}
