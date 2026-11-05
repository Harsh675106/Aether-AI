#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod browser;
use browser::{commands::*, window::BrowserWindowManager};

fn main() {
    // This is an attachment point for the backend to control the existing WebView2
    // child webview. It must never be used to launch Chrome or create another context.
    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "--remote-debugging-port=9222",
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(BrowserWindowManager::new())
        .invoke_handler(tauri::generate_handler![
            browser_open,
            browser_navigate,
            browser_update_bounds,
            browser_show,
            browser_hide,
            browser_minimize,
            browser_maximize,
            browser_close,
            browser_back,
            browser_forward,
            browser_reload,
            browser_set_always_on_top,
            browser_set_position,
            browser_set_size,
            browser_resize,
            browser_get_state,
            browser_snap,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Aether AI desktop shell");
}
