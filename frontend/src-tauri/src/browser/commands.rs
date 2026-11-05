use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, State};
use crate::browser::window::{ensure_webview, BrowserWindowManager};

#[tauri::command]
pub async fn browser_open(
    app: AppHandle,
    url: String,
    x: Option<f64>,
    y: Option<f64>,
    width: Option<f64>,
    height: Option<f64>,
    always_on_top: Option<bool>,
    state: State<'_, BrowserWindowManager>,
) -> Result<(), String> {
    let target_url = if url.trim().is_empty() {
        "https://www.google.com".to_string()
    } else {
        url.trim().to_string()
    };

    let (px, py, pw, ph) = {
        let mut st = state.state.lock().map_err(|e| e.to_string())?;
        st.url = target_url.clone();
        st.visible = true;
        st.is_open = true;
        st.minimized = false;
        if let Some(top) = always_on_top {
            st.always_on_top = top;
        }
        if let Some(v) = x { st.x = v; }
        if let Some(v) = y { st.y = v; }
        if let Some(v) = width { st.width = v; }
        if let Some(v) = height { st.height = v; }
        (st.x, st.y, st.width, st.height)
    };

    // Opening from the React shell normally has no bounds yet. Do not attach
    // the native child WebView with fallback geometry; BrowserWindow measures
    // its actual content box and browser_update_bounds creates it from that
    // authoritative rectangle in the same layout lifecycle.
    if app.get_webview("browser-view").is_some()
        || (width.is_some() && height.is_some() && pw > 0.0 && ph > 0.0)
    {
        ensure_webview(&app, &target_url, px, py, pw, ph)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_update_bounds(
    app: AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    state: State<'_, BrowserWindowManager>,
) -> Result<(), String> {
    state.update_state(|st| {
        st.x = x;
        st.y = y;
        st.width = width;
        st.height = height;
    });

    if let Some(webview) = app.get_webview("browser-view") {
        let _ = webview.set_position(LogicalPosition::new(x, y));
        let _ = webview.set_size(LogicalSize::new(width, height));
    } else {
        let browser_state = state.get_state();
        if browser_state.is_open && browser_state.visible && width > 0.0 && height > 0.0 {
            ensure_webview(&app, &browser_state.url, x, y, width, height)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_navigate(
    app: AppHandle,
    url: String,
    state: State<'_, BrowserWindowManager>,
) -> Result<(), String> {
    let target_url = if url.trim().is_empty() {
        "https://www.google.com".to_string()
    } else {
        url.trim().to_string()
    };

    state.update_state(|st| {
        st.url = target_url.clone();
        st.visible = true;
        st.is_open = true;
        st.minimized = false;
    });

    if let Some(webview) = app.get_webview("browser-view") {
        if let Ok(parsed) = target_url.parse::<tauri::Url>() {
            let _ = webview.navigate(parsed);
        }
        let _ = webview.show();
    } else {
        let st = state.get_state();
        ensure_webview(&app, &target_url, st.x, st.y, st.width, st.height)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_show(
    app: AppHandle,
    state: State<'_, BrowserWindowManager>,
) -> Result<(), String> {
    state.update_state(|st| {
        st.visible = true;
        st.minimized = false;
        st.is_open = true;
    });
    if let Some(webview) = app.get_webview("browser-view") {
        let _ = webview.show();
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_hide(
    app: AppHandle,
    state: State<'_, BrowserWindowManager>,
) -> Result<(), String> {
    state.update_state(|st| {
        st.visible = false;
    });
    if let Some(webview) = app.get_webview("browser-view") {
        let _ = webview.hide();
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_minimize(
    app: AppHandle,
    state: State<'_, BrowserWindowManager>,
) -> Result<(), String> {
    state.update_state(|st| {
        st.visible = false;
        st.minimized = true;
    });
    if let Some(webview) = app.get_webview("browser-view") {
        let _ = webview.hide();
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_maximize(
    app: AppHandle,
    state: State<'_, BrowserWindowManager>,
) -> Result<(), String> {
    state.update_state(|st| {
        st.maximized = true;
        st.visible = true;
        st.minimized = false;
    });
    if let Some(webview) = app.get_webview("browser-view") {
        let _ = webview.show();
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_close(
    app: AppHandle,
    state: State<'_, BrowserWindowManager>,
) -> Result<(), String> {
    state.update_state(|st| {
        st.is_open = false;
        st.visible = false;
    });
    if let Some(webview) = app.get_webview("browser-view") {
        let _ = webview.hide();
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_back(app: AppHandle) -> Result<(), String> {
    if let Some(webview) = app.get_webview("browser-view") {
        let _ = webview.eval("window.history.back()");
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_forward(app: AppHandle) -> Result<(), String> {
    if let Some(webview) = app.get_webview("browser-view") {
        let _ = webview.eval("window.history.forward()");
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_reload(app: AppHandle) -> Result<(), String> {
    if let Some(webview) = app.get_webview("browser-view") {
        let _ = webview.eval("window.location.reload()");
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_set_always_on_top(
    always_on_top: bool,
    state: State<'_, BrowserWindowManager>,
) -> Result<(), String> {
    state.update_state(|st| {
        st.always_on_top = always_on_top;
    });
    Ok(())
}

#[tauri::command]
pub async fn browser_set_position(
    app: AppHandle,
    x: f64,
    y: f64,
    state: State<'_, BrowserWindowManager>,
) -> Result<(), String> {
    state.update_state(|st| {
        st.x = x;
        st.y = y;
    });
    if let Some(webview) = app.get_webview("browser-view") {
        let _ = webview.set_position(LogicalPosition::new(x, y));
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_set_size(
    app: AppHandle,
    width: f64,
    height: f64,
    state: State<'_, BrowserWindowManager>,
) -> Result<(), String> {
    state.update_state(|st| {
        st.width = width;
        st.height = height;
    });
    if let Some(webview) = app.get_webview("browser-view") {
        let _ = webview.set_size(LogicalSize::new(width, height));
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_resize(
    app: AppHandle,
    width: f64,
    height: f64,
    state: State<'_, BrowserWindowManager>,
) -> Result<(), String> {
    browser_set_size(app, width, height, state).await
}

#[tauri::command]
pub async fn browser_get_state(
    state: State<'_, BrowserWindowManager>,
) -> Result<serde_json::Value, String> {
    let win_state = state.get_state();
    serde_json::to_value(&win_state).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn browser_snap(
    app: AppHandle,
    _position: String,
    state: State<'_, BrowserWindowManager>,
) -> Result<(), String> {
    browser_show(app, state).await
}
