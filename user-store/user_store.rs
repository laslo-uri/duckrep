//! Shared Tauri user-store commands. Include from each app's lib.rs:
//!
//! ```rust
//! mod user_store { include!("../../../user-store/user_store.rs"); }
//! .manage(user_store::new_state("com.lectory.app", None))
//! .invoke_handler(tauri::generate_handler![user_store::user_store_load, user_store::user_store_save, ...])
//! ```

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct UserStoreState {
    pub path: PathBuf,
    pub data: Mutex<HashMap<String, String>>,
}

fn app_data_store_path(app_id: &str) -> PathBuf {
    let base = std::env::var("APPDATA")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".into());
    PathBuf::from(base).join(app_id).join("user-store.json")
}

fn harbor_store_path(harbor_root: &PathBuf) -> PathBuf {
    harbor_root.join("data").join("user-store.json")
}

fn read_store_file(path: &PathBuf) -> HashMap<String, String> {
    if !path.exists() {
        return HashMap::new();
    }
    let raw = match fs::read_to_string(path) {
        Ok(s) => s,
        Err(_) => return HashMap::new(),
    };
    let value: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return HashMap::new(),
    };
    let Some(obj) = value.as_object() else {
        return HashMap::new();
    };
    obj.iter()
        .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
        .collect()
}

fn write_store_file(path: &PathBuf, data: &HashMap<String, String>) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

pub fn new_state(app_id: &str, harbor_root: Option<PathBuf>) -> UserStoreState {
    let path = match harbor_root {
        Some(root) => harbor_store_path(&root),
        None => app_data_store_path(app_id),
    };
    let initial = read_store_file(&path);
    UserStoreState {
        path,
        data: Mutex::new(initial),
    }
}

#[tauri::command]
pub fn user_store_load(state: tauri::State<'_, UserStoreState>) -> Result<HashMap<String, String>, String> {
    let disk = read_store_file(&state.path);
    let mut guard = state.data.lock().map_err(|e| e.to_string())?;
    if guard.is_empty() && !disk.is_empty() {
        *guard = disk.clone();
    }
    Ok(guard.clone())
}

#[tauri::command]
pub fn user_store_save(
    data: HashMap<String, String>,
    state: tauri::State<'_, UserStoreState>,
) -> Result<(), String> {
    write_store_file(&state.path, &data)?;
    let mut guard = state.data.lock().map_err(|e| e.to_string())?;
    *guard = data;
    Ok(())
}
