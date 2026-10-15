//! The system's own file UI: a "Save as" dialog for exports, the default app for opening a
//! document, the file manager for revealing one. Windows only; elsewhere exports fall back to the
//! exports folder and open/reveal are refused.

use super::{ferr, FileErr};
use std::path::{Path, PathBuf};

pub enum Choice {
    Path(PathBuf),
    Cancelled,
    /// no dialog on this platform: the caller uses the exports folder
    NoDialog,
}

#[cfg(windows)]
fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// The Windows "Save as" dialog, modal to `owner` (the RealmNest window; 0: none). It runs on its own
/// thread with COM in a single-threaded apartment, as the Explorer-style dialog requires.
#[cfg(windows)]
pub fn save_as(name: &str, owner: isize) -> Result<Choice, FileErr> {
    let name = name.to_string();
    std::thread::spawn(move || save_as_sta(&name, owner))
        .join()
        .map_err(|_| ferr("IMPORT_FAILED", "The save dialog stopped."))?
}

#[cfg(windows)]
fn save_as_sta(name: &str, owner: isize) -> Result<Choice, FileErr> {
    use windows_sys::Win32::System::Com::{
        CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED, COINIT_DISABLE_OLE1DDE,
    };
    use windows_sys::Win32::UI::Controls::Dialogs::{
        CommDlgExtendedError, GetSaveFileNameW, OFN_EXPLORER, OFN_NOCHANGEDIR, OFN_OVERWRITEPROMPT,
        OFN_PATHMUSTEXIST, OPENFILENAMEW,
    };
    // SAFETY: this thread was just created for the dialog; it is uninitialised below
    let com = unsafe {
        CoInitializeEx(
            std::ptr::null(),
            (COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE) as u32,
        )
    };
    let mut buf = vec![0u16; 1024];
    for (i, c) in name.encode_utf16().take(1000).enumerate() {
        buf[i] = c;
    }
    let ext = Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_string();
    let filter = if ext.is_empty() {
        wide("Tutti i file\0*.*\0")
    } else {
        wide(&format!(
            "{} (*.{ext})\0*.{ext}\0Tutti i file\0*.*\0",
            ext.to_uppercase()
        ))
    };
    let title = wide("Esporta una copia");
    let def_ext = wide(&ext);
    // SAFETY: a zeroed OPENFILENAMEW is the documented starting point; every pointer we set lives until the call returns
    let mut ofn: OPENFILENAMEW = unsafe { std::mem::zeroed() };
    ofn.lStructSize = std::mem::size_of::<OPENFILENAMEW>() as u32;
    ofn.hwndOwner = owner as _;
    ofn.lpstrFilter = filter.as_ptr();
    ofn.lpstrFile = buf.as_mut_ptr();
    ofn.nMaxFile = buf.len() as u32;
    ofn.lpstrTitle = title.as_ptr();
    if !ext.is_empty() {
        ofn.lpstrDefExt = def_ext.as_ptr();
    }
    ofn.Flags = OFN_EXPLORER | OFN_OVERWRITEPROMPT | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR;
    // SAFETY: ofn is fully initialised above
    let ok = unsafe { GetSaveFileNameW(&mut ofn) } != 0;
    // 0 with no extended error: the user cancelled; anything else is a failure, not a cancel
    let err = if ok {
        0
    } else {
        unsafe { CommDlgExtendedError() }
    };
    if com >= 0 {
        // SAFETY: balanced with the successful CoInitializeEx above, on the same thread
        unsafe { CoUninitialize() };
    }
    if !ok {
        return if err == 0 {
            Ok(Choice::Cancelled)
        } else {
            Err(ferr(
                "IMPORT_FAILED",
                format!("The save dialog could not open (error {err:#x})."),
            ))
        };
    }
    let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    Ok(Choice::Path(PathBuf::from(String::from_utf16_lossy(
        &buf[..len],
    ))))
}

#[cfg(not(windows))]
pub fn save_as(_name: &str, _owner: isize) -> Result<Choice, FileErr> {
    Ok(Choice::NoDialog)
}

#[cfg(windows)]
pub fn open(path: &Path) -> Result<(), FileErr> {
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
    let verb = wide("open");
    let file = wide(&path.to_string_lossy());
    // SAFETY: both strings are NUL-terminated and outlive the call
    let r = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            verb.as_ptr(),
            file.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            SW_SHOWNORMAL,
        )
    };
    if (r as isize) <= 32 {
        return Err(ferr("IMPORT_FAILED", "No app could open this file."));
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn open(_path: &Path) -> Result<(), FileErr> {
    Err(ferr(
        "UNSUPPORTED_FILE_TYPE",
        "Opening files is not available on this platform yet.",
    ))
}

#[cfg(windows)]
pub fn reveal(path: &Path) -> Result<(), FileErr> {
    std::process::Command::new("explorer")
        .arg(format!("/select,{}", path.to_string_lossy()))
        .spawn()
        .map(|_| ())
        .map_err(|_| ferr("IMPORT_FAILED", "The file manager could not be opened."))
}

#[cfg(not(windows))]
pub fn reveal(_path: &Path) -> Result<(), FileErr> {
    Err(ferr(
        "UNSUPPORTED_FILE_TYPE",
        "Revealing files is not available on this platform yet.",
    ))
}
