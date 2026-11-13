use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewBuilder, WebviewUrl,
};

static NEXT_TAB_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserTab {
    pub id: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserWindowState {
    pub url: String,
    pub visible: bool,
    pub always_on_top: bool,
    pub minimized: bool,
    pub maximized: bool,
    pub is_open: bool,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub tabs: Vec<BrowserTab>,
    pub active_tab_id: Option<String>,
}

impl Default for BrowserWindowState {
    fn default() -> Self {
        Self {
            url: "https://www.google.com".to_string(),
            visible: false,
            always_on_top: false,
            minimized: false,
            maximized: false,
            is_open: false,
            x: 100.0,
            y: 100.0,
            width: 800.0,
            height: 600.0,
            tabs: Vec::new(),
            active_tab_id: None,
        }
    }
}

pub struct BrowserWindowManager {
    pub state: Arc<Mutex<BrowserWindowState>>,
}

impl BrowserWindowManager {
    pub fn new() -> Self {
        Self {
            state: Arc::new(Mutex::new(BrowserWindowState::default())),
        }
    }

    pub fn get_state(&self) -> BrowserWindowState {
        self.state.lock().map(|st| st.clone()).unwrap_or_default()
    }

    pub fn update_state<F>(&self, f: F)
    where
        F: FnOnce(&mut BrowserWindowState),
    {
        if let Ok(mut st) = self.state.lock() {
            f(&mut st);
        }
    }
}

pub fn ensure_webview(
    app: &AppHandle,
    tab_id: &str,
    url_str: &str,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    active_tab_id: &str,
) -> Result<(), String> {
    if let Some(webview) = app.get_webview(tab_id) {
        webview
            .set_position(LogicalPosition::new(x, y))
            .map_err(|e| e.to_string())?;
        webview
            .set_size(LogicalSize::new(width, height))
            .map_err(|e| e.to_string())?;
        if tab_id == active_tab_id {
            webview.show().map_err(|e| e.to_string())?;
        } else {
            webview.hide().map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    // Otherwise, attach child webview to the main window
    let window = app
        .get_window("main")
        .or_else(|| app.windows().values().next().cloned())
        .ok_or_else(|| "No main window found to attach browser webview".to_string())?;

    let parsed_url = url_str
        .parse::<tauri::Url>()
        .map_err(|error| format!("Invalid browser tab URL: {error}"))?;

    let app_handle = app.clone();
    let event_tab_id = tab_id.to_string();
    let builder = WebviewBuilder::new(tab_id, WebviewUrl::External(parsed_url))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
        .on_navigation(move |nav_url| {
            let url = nav_url.as_str().to_string();
            if let Some(state) = app_handle.try_state::<BrowserWindowManager>() {
                state.update_state(|browser_state| {
                    if let Some(tab) = browser_state
                        .tabs
                        .iter_mut()
                        .find(|tab| tab.id == event_tab_id)
                    {
                        tab.url = url.clone();
                    }
                    if browser_state.active_tab_id.as_deref() == Some(&event_tab_id) {
                        browser_state.url = url.clone();
                    }
                });
            }
            let _ = app_handle.emit("browser-url-changed", serde_json::json!({
                "tab_id": event_tab_id,
                "url": url
            }));
            true
        });

    let pos = LogicalPosition::new(x, y);
    let sz = LogicalSize::new(width, height);
    let webview = window
        .add_child(builder, pos, sz)
        .map_err(|e| e.to_string())?;
    if tab_id == active_tab_id {
        webview.show().map_err(|e| e.to_string())?;
    } else {
        webview.hide().map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub fn new_tab_id(existing_tabs: &[BrowserTab]) -> String {
    if existing_tabs.is_empty() {
        return "browser-view".to_string();
    }
    format!(
        "browser-tab-{}",
        NEXT_TAB_ID.fetch_add(1, Ordering::Relaxed)
    )
}

pub fn select_or_create_tab(browser_state: &mut BrowserWindowState, url: &str) -> String {
    let target_key = url_key(url);
    let tab_id = browser_state
        .tabs
        .iter()
        .find(|tab| url_key(&tab.url) == target_key)
        .map(|tab| tab.id.clone())
        .unwrap_or_else(|| {
            let id = new_tab_id(&browser_state.tabs);
            browser_state.tabs.push(BrowserTab {
                id: id.clone(),
                url: url.to_string(),
            });
            id
        });
    if let Some(tab) = browser_state.tabs.iter_mut().find(|tab| tab.id == tab_id) {
        tab.url = url.to_string();
    }
    browser_state.active_tab_id = Some(tab_id.clone());
    browser_state.url = url.to_string();
    tab_id
}

pub fn url_key(url: &str) -> String {
    let Ok(mut parsed) = url.parse::<tauri::Url>() else {
        return url.trim_end_matches('/').to_ascii_lowercase();
    };
    let path = parsed.path().trim_end_matches('/').to_string();
    parsed.set_path(if path.is_empty() { "/" } else { &path });
    parsed.to_string()
}

#[cfg(test)]
mod tests {
    use super::{select_or_create_tab, BrowserWindowState};

    #[test]
    fn reuses_matching_url_and_creates_tabs_for_new_urls() {
        let mut state = BrowserWindowState::default();
        let youtube_tab = select_or_create_tab(&mut state, "https://www.youtube.com");
        let github_tab = select_or_create_tab(&mut state, "https://github.com/");
        let youtube_again = select_or_create_tab(&mut state, "https://www.youtube.com/");
        let youtube_fragment = select_or_create_tab(&mut state, "https://www.youtube.com/#feed");

        assert_eq!(youtube_again, youtube_tab);
        assert_ne!(youtube_fragment, youtube_tab);
        assert_ne!(github_tab, youtube_tab);
        assert_eq!(state.tabs.len(), 3);
        assert_eq!(
            state.active_tab_id.as_deref(),
            Some(youtube_fragment.as_str())
        );
    }
}
