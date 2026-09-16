#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{
    Builder as ShortcutBuilder, Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};

/// The element the app's own code binds its start/pause handler to. Reaching into
/// the DOM is how this shell drives the timer without the web app knowing a shell
/// exists: the click runs the same listener a person's click would.
const START_PAUSE_BUTTON: &str = "start-pause-btn";

fn main() {
    tauri::Builder::default()
        // Single-instance must be registered first, before any other plugin.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .setup(|app| {
            build_tray(app)?;
            register_shortcuts(app.handle())?;
            enable_autostart_on_installed_builds(app);
            Ok(())
        })
        .on_window_event(|window, event| {
            // On Windows, closing the last window exits the process. The tray is
            // this app's real lifetime, so closing the window only hides it.
            // ponytail: every window is treated this way. Revisit when the
            // mini-timer becomes its own window, which should be closable.
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to start Kairos desktop");
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn hide_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

/// Drives the timer by clicking the app's own button. A no-op if the webview has
/// not finished loading, which is the honest outcome rather than a fake success.
fn toggle_timer(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.eval(format!(
            "document.getElementById('{START_PAUSE_BUTTON}')?.click()"
        ));
    }
}

fn toggle_main_window(app: &AppHandle) {
    let visible = app
        .get_webview_window("main")
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(false);

    if visible {
        hide_main_window(app);
    } else {
        show_main_window(app);
    }
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
    let toggle = MenuItem::with_id(app, "toggle-timer", "开始 / 暂停计时", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &toggle, &quit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main_window(app),
            "toggle-timer" => toggle_timer(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn register_shortcuts(app: &AppHandle) -> tauri::Result<()> {
    let toggle = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyP);
    let window = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyS);

    let handler_toggle = toggle;
    let handler_window = window;

    app.plugin(
        ShortcutBuilder::new()
            .with_handler(move |app, shortcut, event| {
                if let ShortcutState::Pressed = event.state() {
                    if shortcut == &handler_toggle {
                        toggle_timer(app);
                    } else if shortcut == &handler_window {
                        toggle_main_window(app);
                    }
                }
            })
            .build(),
    )?;

    for (shortcut, label) in [(toggle, "Ctrl+Alt+P"), (window, "Ctrl+Alt+S")] {
        if let Err(error) = app.global_shortcut().register(shortcut) {
            // Windows RegisterHotKey is system-wide and first-come-first-served.
            // The plugin flattens the platform error to a string, so a foreign
            // owner is only distinguishable by message. Report it and keep going:
            // one unavailable shortcut must not cost the person the tray or the
            // other shortcut.
            let message = error.to_string();
            if message.contains("already registered") {
                eprintln!("[shortcuts] {label} is claimed by another application; skipping it");
            } else {
                eprintln!("[shortcuts] could not register {label}: {message}");
            }
        }
    }

    Ok(())
}

/// Registers the app to start with Windows, once, on an installed build.
///
/// Deliberately release-only: in a debug build the executable lives in
/// `target/debug`, and writing that path into the Run key would leave a startup
/// entry pointing at a build artifact that is deleted on the next `cargo clean`.
fn enable_autostart_on_installed_builds(app: &tauri::App) {
    #[cfg(not(debug_assertions))]
    {
        use tauri_plugin_autostart::ManagerExt;

        let autostart = app.autolaunch();
        match autostart.is_enabled() {
            Ok(true) => {}
            Ok(false) => {
                if let Err(error) = autostart.enable() {
                    eprintln!("[autostart] could not enable: {error}");
                }
            }
            Err(error) => eprintln!("[autostart] could not read state: {error}"),
        }
    }

    #[cfg(debug_assertions)]
    let _ = app;
}
