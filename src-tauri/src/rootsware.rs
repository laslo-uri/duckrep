//! "← Rootsware": opens the family launcher from a bird app (same lookup as Rootsware uses for the birds).

use std::path::{Path, PathBuf};
use std::process::Command;

/// Finds the Rootsware exe: right beside this exe wins (an installed copy); otherwise each parent folder is
/// tried for `rootsware/src-tauri/target/release/rootsware.exe`, which from
/// `_apps/<bird>/src-tauri/target/release/` reaches `_apps/rootsware/...`.
fn find_rootsware(start: &Path) -> Option<PathBuf> {
    let file = format!("rootsware{}", std::env::consts::EXE_SUFFIX);
    let beside = start.join(&file);
    if beside.is_file() {
        return Some(beside);
    }
    let release = Path::new("rootsware").join("src-tauri").join("target").join("release").join(&file);
    let mut dir = start.to_path_buf();
    for _ in 0..8 {
        let built = dir.join(&release);
        if built.is_file() {
            return Some(built);
        }
        if !dir.pop() {
            break;
        }
    }
    None
}

fn located() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    find_rootsware(exe.parent()?)
}

/// True when a Rootsware build can be found, so the link only shows when it would work.
#[tauri::command]
pub fn rootsware_available() -> bool {
    located().is_some()
}

#[tauri::command]
pub fn open_rootsware() -> Result<(), String> {
    let path = located().ok_or_else(|| "Rootsware is not built on this machine".to_string())?;
    Command::new(&path).current_dir(path.parent().unwrap_or(Path::new("."))).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::find_rootsware;
    use std::fs;

    #[test]
    fn finds_the_sibling_release_build() {
        let root = std::env::temp_dir().join(format!("rootsware-lookup-{}", std::process::id()));
        let start = root.join("bird").join("src-tauri").join("target").join("release");
        let release = root.join("rootsware").join("src-tauri").join("target").join("release");
        fs::create_dir_all(&start).unwrap();
        fs::create_dir_all(&release).unwrap();
        let exe = release.join(format!("rootsware{}", std::env::consts::EXE_SUFFIX));
        assert_eq!(find_rootsware(&start), None);
        fs::write(&exe, b"").unwrap();
        assert_eq!(find_rootsware(&start), Some(exe));
        fs::remove_dir_all(&root).unwrap();
    }
}
