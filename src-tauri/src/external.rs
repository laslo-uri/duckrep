//! Opens https links (exercise videos, MuscleWiki, the credits) in the system browser instead of the app window.

use std::process::Command;

/// Only plain https URLs without spaces or quotes; the OS opener gets the URL as one argument, never via a shell.
fn safe_https(url: &str) -> bool {
    url.starts_with("https://")
        && url.len() < 2048
        && !url.chars().any(|c| c.is_whitespace() || c.is_control() || c == '"' || c == '\'')
}

#[tauri::command]
pub fn open_external(url: String) -> Result<(), String> {
    if !safe_https(&url) {
        return Err("only https links can be opened".into());
    }
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut c = Command::new("rundll32");
        c.args(["url.dll,FileProtocolHandler", &url]);
        c
    };
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut c = Command::new("open");
        c.arg(&url);
        c
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut c = Command::new("xdg-open");
        c.arg(&url);
        c
    };
    command.spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::safe_https;

    #[test]
    fn accepts_only_plain_https() {
        assert!(safe_https("https://www.youtube.com/results?search_query=bench+press"));
        assert!(!safe_https("http://example.com"));
        assert!(!safe_https("file:///C:/Windows/System32/calc.exe"));
        assert!(!safe_https("https://a.example/\" & calc"));
    }
}
