use crate::browser::window::{ensure_webview, select_or_create_tab, BrowserWindowManager};
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, State};

fn sync_tabs(
    app: &AppHandle,
    browser_state: &crate::browser::window::BrowserWindowState,
) -> Result<(), String> {
    let active_tab_id = browser_state.active_tab_id.as_deref().unwrap_or_default();
    for tab in &browser_state.tabs {
        ensure_webview(
            app,
            &tab.id,
            &tab.url,
            browser_state.x,
            browser_state.y,
            browser_state.width,
            browser_state.height,
            active_tab_id,
        )?;
    }
    Ok(())
}

fn set_tab_visibility(
    app: &AppHandle,
    browser_state: &crate::browser::window::BrowserWindowState,
    visible: bool,
) -> Result<(), String> {
    for tab in &browser_state.tabs {
        if let Some(webview) = app.get_webview(&tab.id) {
            if visible && browser_state.active_tab_id.as_deref() == Some(&tab.id) {
                webview.show().map_err(|e| e.to_string())?;
            } else {
                webview.hide().map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

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
) -> Result<crate::browser::window::BrowserWindowState, String> {
    let target_url = if url.trim().is_empty() {
        "https://www.google.com".to_string()
    } else {
        url.trim().to_string()
    };
    let _parsed_url = target_url
        .parse::<tauri::Url>()
        .map_err(|error| format!("Invalid browser tab URL: {error}"))?;
    let (px, py, pw, ph, active_tab_id) = {
        let mut st = state.state.lock().map_err(|e| e.to_string())?;
        let tab_id = select_or_create_tab(&mut st, &target_url);
        st.visible = true;
        st.is_open = true;
        st.minimized = false;
        if let Some(top) = always_on_top {
            st.always_on_top = top;
        }
        if let Some(v) = x {
            st.x = v;
        }
        if let Some(v) = y {
            st.y = v;
        }
        if let Some(v) = width {
            st.width = v;
        }
        if let Some(v) = height {
            st.height = v;
        }
        (st.x, st.y, st.width, st.height, tab_id)
    };

    // Opening from the React shell normally has no bounds yet. Do not attach
    // the native child WebView with fallback geometry; BrowserWindow measures
    // its actual content box and browser_update_bounds creates it from that
    // authoritative rectangle in the same layout lifecycle.
    let browser_state = state.get_state();
    let has_existing_webview = browser_state
        .tabs
        .iter()
        .any(|tab| app.get_webview(&tab.id).is_some());
    if !browser_state.tabs.is_empty()
        && (has_existing_webview || (width.is_some() && height.is_some() && pw > 0.0 && ph > 0.0))
    {
        for tab in &browser_state.tabs {
            ensure_webview(&app, &tab.id, &tab.url, px, py, pw, ph, &active_tab_id)?;
        }
    }
    Ok(state.get_state())
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

    let browser_state = state.get_state();
    if browser_state.is_open && browser_state.visible && width > 0.0 && height > 0.0 {
        sync_tabs(&app, &browser_state)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_set_dragging(
    app: AppHandle,
    dragging: bool,
    state: State<'_, BrowserWindowManager>,
) -> Result<(), String> {
    let browser_state = state.get_state();
    if let Some(tab_id) = browser_state.active_tab_id {
        if let Some(webview) = app.get_webview(&tab_id) {
            if dragging {
                webview.hide().map_err(|error| error.to_string())?;
            } else if browser_state.visible {
                webview.show().map_err(|error| error.to_string())?;
            }
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
    let parsed_url = target_url
        .parse::<tauri::Url>()
        .map_err(|error| format!("Invalid browser navigation URL: {error}"))?;

    let active_tab_id = {
        let mut browser_state = state.state.lock().map_err(|e| e.to_string())?;
        let current_tab_id = browser_state
            .active_tab_id
            .clone()
            .or_else(|| browser_state.tabs.first().map(|tab| tab.id.clone()));
        let tab_id = match current_tab_id {
            Some(tab_id) => tab_id,
            None => select_or_create_tab(&mut browser_state, &target_url),
        };
        if !browser_state.tabs.iter().any(|tab| tab.id == tab_id) {
            return Err("Unable to create a browser tab for navigation".to_string());
        }
        browser_state.active_tab_id = Some(tab_id.clone());
        browser_state.url = target_url.clone();
        if let Some(tab) = browser_state.tabs.iter_mut().find(|tab| tab.id == tab_id) {
            tab.url = target_url.clone();
        }
        browser_state.visible = true;
        browser_state.is_open = true;
        browser_state.minimized = false;
        tab_id
    };

    if let Some(webview) = app.get_webview(&active_tab_id) {
        webview
            .navigate(parsed_url)
            .map_err(|error| error.to_string())?;
        webview.show().map_err(|e| e.to_string())?;
    } else {
        let st = state.get_state();
        sync_tabs(&app, &st)?;
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
    set_tab_visibility(&app, &state.get_state(), true)
}

#[tauri::command]
pub async fn browser_hide(
    app: AppHandle,
    state: State<'_, BrowserWindowManager>,
) -> Result<(), String> {
    state.update_state(|st| {
        st.visible = false;
    });
    set_tab_visibility(&app, &state.get_state(), false)
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
    set_tab_visibility(&app, &state.get_state(), false)
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
    set_tab_visibility(&app, &state.get_state(), true)
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
    set_tab_visibility(&app, &state.get_state(), false)
}

#[tauri::command]
pub async fn browser_back(
    app: AppHandle,
    state: State<'_, BrowserWindowManager>,
) -> Result<(), String> {
    if let Some(tab_id) = state.get_state().active_tab_id {
        if let Some(webview) = app.get_webview(&tab_id) {
            webview
                .eval("window.history.back()")
                .map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_forward(
    app: AppHandle,
    state: State<'_, BrowserWindowManager>,
) -> Result<(), String> {
    if let Some(tab_id) = state.get_state().active_tab_id {
        if let Some(webview) = app.get_webview(&tab_id) {
            webview
                .eval("window.history.forward()")
                .map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn browser_reload(
    app: AppHandle,
    state: State<'_, BrowserWindowManager>,
) -> Result<(), String> {
    if let Some(tab_id) = state.get_state().active_tab_id {
        if let Some(webview) = app.get_webview(&tab_id) {
            webview
                .eval("window.location.reload()")
                .map_err(|error| error.to_string())?;
        }
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
    for tab in state.get_state().tabs {
        if let Some(webview) = app.get_webview(&tab.id) {
            webview
                .set_position(LogicalPosition::new(x, y))
                .map_err(|error| error.to_string())?;
        }
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
    for tab in state.get_state().tabs {
        if let Some(webview) = app.get_webview(&tab.id) {
            webview
                .set_size(LogicalSize::new(width, height))
                .map_err(|error| error.to_string())?;
        }
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
pub async fn browser_switch_tab(
    app: AppHandle,
    tab_id: String,
    state: State<'_, BrowserWindowManager>,
) -> Result<crate::browser::window::BrowserWindowState, String> {
    state.update_state(|st| {
        if let Some(tab) = st.tabs.iter().find(|tab| tab.id == tab_id) {
            st.url = tab.url.clone();
            st.active_tab_id = Some(tab_id.clone());
            st.visible = true;
            st.is_open = true;
            st.minimized = false;
        }
    });
    let browser_state = state.get_state();
    if browser_state.active_tab_id.as_deref() != Some(&tab_id) {
        return Err(format!("Browser tab '{tab_id}' was not found"));
    }
    set_tab_visibility(&app, &browser_state, true)?;
    Ok(browser_state)
}

#[tauri::command]
pub async fn browser_snap(
    app: AppHandle,
    _position: String,
    state: State<'_, BrowserWindowManager>,
) -> Result<(), String> {
    browser_show(app, state).await
}
