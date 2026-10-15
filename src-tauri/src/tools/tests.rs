//! The sandbox, tested on the real filesystem (a temp folder per test).

use super::*;
use std::sync::atomic::{AtomicUsize, Ordering};

static N: AtomicUsize = AtomicUsize::new(0);

/// a fresh workspace and a folder beside it (the "outside")
fn setup() -> (PathBuf, PathBuf) {
    let base = std::env::temp_dir().join(format!(
        "realmnest-tools-{}-{}",
        std::process::id(),
        N.fetch_add(1, Ordering::SeqCst)
    ));
    let ws = base.join("workspace");
    let out = base.join("outside");
    fs::create_dir_all(&ws).unwrap();
    fs::create_dir_all(&out).unwrap();
    fs::write(out.join("secret.txt"), "do not read").unwrap();
    (ws, out)
}

fn s(p: &Path) -> String {
    p.to_string_lossy().into_owned()
}

#[test]
fn writes_reads_and_lists_inside_the_workspace() {
    let (ws, _) = setup();
    let w = write_text(
        &s(&ws),
        "notes/hello.txt",
        "RealmNest tool runtime successful.",
    )
    .unwrap();
    assert_eq!(
        w,
        Written {
            path: "notes/hello.txt".into(),
            bytes: 34,
            created: true
        }
    );
    assert_eq!(
        fs::read_to_string(ws.join("notes").join("hello.txt")).unwrap(),
        "RealmNest tool runtime successful."
    );
    let again = write_text(&s(&ws), "notes\\hello.txt", "v2").unwrap();
    assert!(!again.created);
    assert_eq!(
        read_text(&s(&ws), "./notes/hello.txt").unwrap().content,
        "v2"
    );
    let root = list_directory(&s(&ws), ".").unwrap();
    assert_eq!(root.path, ".");
    assert_eq!(
        root.entries,
        vec![DirEntry {
            name: "notes".into(),
            kind: "dir",
            size: None
        }]
    );
    let notes = list_directory(&s(&ws), "notes").unwrap();
    assert_eq!(notes.entries[0].name, "hello.txt");
    // no temp file left behind
    assert_eq!(notes.entries.len(), 1);
}

#[test]
fn refuses_every_way_out() {
    let (ws, out) = setup();
    let w = s(&ws);
    let cases = [
        "../outside/secret.txt".to_string(),
        "notes/../../outside/secret.txt".into(),
        "..\\outside\\secret.txt".into(),
        s(&out.join("secret.txt")),
        "C:\\Windows\\win.ini".into(),
        "C:secret.txt".into(),
        "/etc/passwd".into(),
        "\\\\server\\share\\x.txt".into(),
        "\\\\?\\C:\\Windows\\win.ini".into(),
        "file.txt:stream".into(),
    ];
    for c in &cases {
        assert_eq!(
            read_text(&w, c).unwrap_err().code,
            "PATH_OUTSIDE_WORKSPACE",
            "read {c}"
        );
        assert_eq!(
            write_text(&w, c, "x").unwrap_err().code,
            "PATH_OUTSIDE_WORKSPACE",
            "write {c}"
        );
        assert_eq!(
            list_directory(&w, c).unwrap_err().code,
            "PATH_OUTSIDE_WORKSPACE",
            "list {c}"
        );
    }
    assert_eq!(
        fs::read_to_string(out.join("secret.txt")).unwrap(),
        "do not read"
    );
}

#[test]
fn refuses_odd_names_and_a_missing_workspace() {
    let (ws, _) = setup();
    let w = s(&ws);
    for bad in [
        "CON", "nul.txt", "COM1", "a./b.txt", "a /b.txt", "a*b.txt", "",
    ] {
        assert_eq!(
            write_text(&w, bad, "x").unwrap_err().code,
            "INVALID_TOOL_INPUT",
            "{bad:?}"
        );
    }
    assert_eq!(
        read_text("", "a.txt").unwrap_err().code,
        "WORKSPACE_REQUIRED"
    );
    assert_eq!(
        read_text("relative\\folder", "a.txt").unwrap_err().code,
        "WORKSPACE_REQUIRED"
    );
    assert_eq!(
        read_text(&s(&ws.join("missing")), "a.txt")
            .unwrap_err()
            .code,
        "WORKSPACE_REQUIRED"
    );
    assert_eq!(
        read_text(&w, "nope.txt").unwrap_err().code,
        "FILE_NOT_FOUND"
    );
}

#[test]
fn caps_sizes_and_text() {
    let (ws, _) = setup();
    let w = s(&ws);
    let big = "x".repeat(MAX_WRITE_BYTES + 1);
    assert_eq!(
        write_text(&w, "big.txt", &big).unwrap_err().code,
        "FILE_TOO_LARGE"
    );
    assert!(!ws.join("big.txt").exists());
    fs::write(ws.join("huge.txt"), vec![b'a'; MAX_READ_BYTES as usize + 1]).unwrap();
    assert_eq!(
        read_text(&w, "huge.txt").unwrap_err().code,
        "FILE_TOO_LARGE"
    );
    fs::write(ws.join("bin.dat"), [0xff, 0xfe, 0x00, 0x80]).unwrap();
    assert_eq!(
        read_text(&w, "bin.dat").unwrap_err().code,
        "NOT_A_TEXT_FILE"
    );
    for i in 0..(MAX_LIST_ENTRIES + 5) {
        fs::write(ws.join(format!("f{i}.txt")), "").unwrap();
    }
    let l = list_directory(&w, ".").unwrap();
    assert_eq!(l.entries.len(), MAX_LIST_ENTRIES);
    assert!(l.truncated);
}

/// A junction (Windows) inside the workspace that points outside: listed as a
/// link, never followed by reads, listings or writes.
#[cfg(windows)]
#[test]
fn does_not_follow_a_junction_out() {
    let (ws, out) = setup();
    let link = ws.join("escape");
    let made = std::process::Command::new("cmd")
        .args(["/C", "mklink", "/J", &s(&link), &s(&out)])
        .output()
        .unwrap();
    assert!(
        made.status.success(),
        "mklink /J failed: {}",
        String::from_utf8_lossy(&made.stderr)
    );
    let w = s(&ws);
    assert_eq!(
        read_text(&w, "escape/secret.txt").unwrap_err().code,
        "PATH_OUTSIDE_WORKSPACE"
    );
    assert_eq!(
        list_directory(&w, "escape").unwrap_err().code,
        "PATH_OUTSIDE_WORKSPACE"
    );
    assert_eq!(
        write_text(&w, "escape/new.txt", "x").unwrap_err().code,
        "PATH_OUTSIDE_WORKSPACE"
    );
    assert_eq!(
        write_text(&w, "escape", "x").unwrap_err().code,
        "PATH_OUTSIDE_WORKSPACE"
    );
    assert!(!out.join("new.txt").exists());
    let listed = list_directory(&w, ".").unwrap();
    assert_eq!(
        listed.entries,
        vec![DirEntry {
            name: "escape".into(),
            kind: "link",
            size: None
        }]
    );
    let _ = fs::remove_dir(&link);
}

#[test]
fn refuses_a_drive_root_as_workspace() {
    #[cfg(windows)]
    assert_eq!(
        list_directory("C:\\", ".").unwrap_err().code,
        "WORKSPACE_REQUIRED"
    );
    #[cfg(not(windows))]
    assert_eq!(
        list_directory("/", ".").unwrap_err().code,
        "WORKSPACE_REQUIRED"
    );
}

fn g(path: &str, tree: bool) -> Guard {
    Guard {
        path: path.into(),
        tree,
        what: "x",
    }
}

#[cfg(windows)]
#[test]
fn protected_folders_cannot_be_workspaces() {
    let guards = [
        g(r"c:\users\me\appdata\roaming", true),
        g(r"c:\users\me\appdata\local", true),
        g(r"c:\windows", true),
        g(r"c:\program files", true),
        g(r"c:\users\me", false),
        g(r"c:\users\me\.ssh", true),
        g(r"c:\users\me\appdata\local\app.nestra.desktop", true),
    ];
    let temp = Some(r"c:\users\me\appdata\local\temp");
    for bad in [
        r"c:\users\me",
        r"c:\users",
        r"c:\users\me\appdata",
        r"c:\users\me\appdata\roaming",
        r"c:\users\me\appdata\roaming\microsoft\windows\start menu\programs\startup",
        r"c:\users\me\appdata\local\app.nestra.desktop",
        r"c:\users\me\appdata\local\app.nestra.desktop\files",
        r"c:\users\me\.ssh",
        r"c:\windows\system32",
        r"c:\program files\x",
        r"c:\users\me\appdata\local\temp",
    ] {
        assert!(refused_root(bad, &guards, temp).is_some(), "{bad}");
    }
    for ok in [
        r"c:\users\me\documents\project",
        r"c:\users\me\onedrive\documents\x",
        r"c:\users\me\.nestra\workspace",
        r"c:\users\meagain",
        r"d:\projects\game",
        r"c:\users\me\appdata\local\temp\scratch",
        r"c:\windowsapps-not-really",
    ] {
        assert_eq!(refused_root(ok, &guards, temp), None, "{ok}");
    }
    // writes: inside a protected tree is refused, the scratch folder's subfolders are not
    assert!(in_protected(
        r"c:\users\me\appdata\roaming\microsoft\windows\start menu\programs\startup\x.exe",
        &guards,
        temp
    ));
    assert!(!in_protected(r"c:\users\me\documents\a.txt", &guards, temp));
    assert!(!in_protected(
        r"c:\users\me\appdata\local\temp\ws\a.txt",
        &guards,
        temp
    ));
    assert_eq!(norm(Path::new(r"\\?\C:\Users\Me\X\")), r"c:\users\me\x");
}

/// the real protected folders of this user, through the real commands (nothing is written)
#[cfg(windows)]
#[test]
fn the_real_system_and_account_folders_are_refused() {
    let var = |k: &str| std::env::var(k).ok().filter(|v| !v.is_empty());
    let mut bad: Vec<String> = Vec::new();
    for k in [
        "APPDATA",
        "LOCALAPPDATA",
        "SystemRoot",
        "ProgramFiles",
        "USERPROFILE",
    ] {
        bad.extend(var(k));
    }
    if let Some(a) = var("APPDATA") {
        let startup = Path::new(&a)
            .join("Microsoft")
            .join("Windows")
            .join("Start Menu")
            .join("Programs")
            .join("Startup");
        if startup.is_dir() {
            bad.push(s(&startup));
        }
    }
    if let Some(h) = var("USERPROFILE") {
        bad.push(s(Path::new(&h).parent().unwrap()));
        for d in [".ssh", ".claude", ".codex"] {
            let p = Path::new(&h).join(d);
            if p.is_dir() {
                bad.push(s(&p));
            }
        }
    }
    for w in &bad {
        assert_eq!(
            write_text(w, "realmnest-must-not-exist.txt", "x")
                .unwrap_err()
                .code,
            "WORKSPACE_REQUIRED",
            "{w}"
        );
        assert_eq!(
            list_directory(w, ".").unwrap_err().code,
            "WORKSPACE_REQUIRED",
            "{w}"
        );
        assert!(!Path::new(w).join("realmnest-must-not-exist.txt").exists());
    }
}
