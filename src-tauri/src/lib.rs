mod rootsware;
#[path = "../../user-store/user_store.rs"]
mod user_store;

use std::{fs, io, path::Path, path::PathBuf};

use tauri::ipc::{InvokeBody, Request, Response};
use tauri::Manager;

/// The app was called YouPeak and its identifier was com.youpeak.app. Tauri keeps app data in
/// folders named after the identifier (config: the journal database and user-store.json; local:
/// the WebView2 profile). On the first start under the new identifier (com.duckrep.app), copy the
/// old folders over so nothing is lost. The old folders are left in place as a fallback; they can
/// be deleted by hand once the new start works.
///
/// A marker file records that the copy ran, so the plaintext database (sealed and removed on the
/// first unlock) is not copied again. When the new folder already exists (a dev server writes
/// user-store.json there), only the missing top-level files are copied, never into a live WebView
/// profile, and never the old database once a sealed journal is in place.
fn migrate_legacy_data(identifier: &str) {
    for (old, new) in legacy_dirs(identifier) {
        let marker = new.join(MIGRATION_MARKER);
        if !old.is_dir() || marker.exists() {
            continue;
        }
        let result = if new.exists() {
            copy_missing_files(&old, &new)
        } else {
            copy_dir(&old, &new).inspect_err(|_| {
                let _ = fs::remove_dir_all(&new); // a half copy would hide the old data on the next start
            })
        };
        match result.and_then(|()| fs::write(&marker, b"copied from com.youpeak.app\n")) {
            Ok(()) => {}
            Err(e) => eprintln!("could not copy {} to {}: {e}", old.display(), new.display()),
        }
    }
}

const MIGRATION_MARKER: &str = ".migrated-from-youpeak";

fn copy_missing_files(from: &Path, to: &Path) -> io::Result<()> {
    let sealed = to.join("journal.vault").exists();
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        let is_old_db = entry.file_name() == "youpeak.db";
        if entry.file_type()?.is_file() && !target.exists() && !(is_old_db && sealed) {
            fs::copy(entry.path(), target)?;
        }
    }
    Ok(())
}

fn legacy_dirs(identifier: &str) -> Vec<(PathBuf, PathBuf)> {
    let pair = |base: PathBuf| (base.join("com.youpeak.app"), base.join(identifier));
    let mut dirs = Vec::new();
    if cfg!(windows) {
        for var in ["APPDATA", "LOCALAPPDATA"] {
            if let Some(base) = std::env::var_os(var) {
                dirs.push(pair(base.into()));
            }
        }
    } else if let Some(home) = std::env::var_os("HOME").map(PathBuf::from) {
        if cfg!(target_os = "macos") {
            dirs.push(pair(home.join("Library/WebKit")));
            dirs.push(pair(home.join("Library/Application Support")));
        } else {
            let config = std::env::var_os("XDG_CONFIG_HOME").map(PathBuf::from).unwrap_or_else(|| home.join(".config"));
            let data = std::env::var_os("XDG_DATA_HOME").map(PathBuf::from).unwrap_or_else(|| home.join(".local/share"));
            dirs.push(pair(config));
            dirs.push(pair(data));
        }
    }
    dirs
}

fn copy_dir(from: &Path, to: &Path) -> io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), target)?;
        }
    }
    Ok(())
}

/// Files the web layer may read and write in the app config folder (src/lib/vault/storage.ts).
/// `youpeak.db` is the plaintext database from before the vault; it is read once, sealed, and removed.
const VAULT_FILES: &[&str] = &["journal.vault", "youpeak.db"];

fn vault_path(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    if !VAULT_FILES.contains(&name) {
        return Err(format!("unknown vault file {name}"));
    }
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(name))
}

/// Raw bytes of a vault file; empty when it does not exist.
#[tauri::command]
fn vault_read(app: tauri::AppHandle, name: String) -> Result<Response, String> {
    let path = vault_path(&app, &name)?;
    match fs::read(&path) {
        Ok(bytes) => Ok(Response::new(bytes)),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(Response::new(Vec::new())),
        Err(e) => Err(e.to_string()),
    }
}

/// Writes the raw request body to a vault file (name in the `x-vault-file` header). Written to a
/// temporary file first and renamed over the old one, so a crash never leaves half a vault.
#[tauri::command]
fn vault_write(app: tauri::AppHandle, request: Request<'_>) -> Result<(), String> {
    let name = request
        .headers()
        .get("x-vault-file")
        .and_then(|v| v.to_str().ok())
        .ok_or("missing x-vault-file header")?;
    let path = vault_path(&app, name)?;
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected raw bytes".into());
    };
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

#[tauri::command]
fn vault_remove(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let path = vault_path(&app, &name)?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();
    let identifier = context.config().identifier.clone();
    migrate_legacy_data(&identifier);
    tauri::Builder::default()
        .manage(user_store::new_state(&identifier, None))
        .invoke_handler(tauri::generate_handler![
            rootsware::open_rootsware,
            rootsware::rootsware_available,
            user_store::user_store_load,
            user_store::user_store_save,
            vault_read,
            vault_write,
            vault_remove,
        ])
        .run(context)
        .expect("error while running Duckrep");
}
