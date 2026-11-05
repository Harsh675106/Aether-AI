use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewBuilder, WebviewUrl,
};

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
        self.state
            .lock()
            .map(|st| st.clone())
            .unwrap_or_default()
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
    url_str: &str,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    // If the webview already exists, update its position, size and navigate
    if let Some(webview) = app.get_webview("browser-view") {
        let _ = webview.set_position(LogicalPosition::new(x, y));
        let _ = webview.set_size(LogicalSize::new(width, height));
        let _ = webview.show();

        if let Ok(parsed_url) = url_str.parse::<tauri::Url>() {
            let _ = webview.navigate(parsed_url);
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
        .unwrap_or_else(|_| "https://www.google.com".parse().unwrap());

    let app_handle = app.clone();
    let builder = WebviewBuilder::new("browser-view", WebviewUrl::External(parsed_url))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
        .on_navigation(move |nav_url| {
            let _ = app_handle.emit("browser-url-changed", nav_url.as_str());
            true
        });

    let pos = LogicalPosition::new(x, y);
    let sz = LogicalSize::new(width, height);
    let webview = window.add_child(builder, pos, sz).map_err(|e| e.to_string())?;
    let _ = webview.show();

    Ok(())
}
