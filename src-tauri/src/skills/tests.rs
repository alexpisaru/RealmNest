use super::*;

fn store() -> (SkillStore, PathBuf) {
    let base = std::env::temp_dir().join(format!(
        "realmnest-skills-test-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    (
        SkillStore::new(base.join("skills"), Some(base.join("exports"))),
        base,
    )
}

fn file(path: &str, content: &[u8]) -> WireFile {
    WireFile {
        path: path.into(),
        data: b64_encode(content),
    }
}

#[test]
fn base64_round_trips() {
    for s in [
        &b""[..],
        b"a",
        b"ab",
        b"abc",
        b"abcd",
        &[0u8, 255, 128, 7, 9],
    ] {
        assert_eq!(b64_decode(&b64_encode(s)).unwrap(), s);
    }
    assert_eq!(b64_encode(b"RealmNest"), "UmVhbG1OZXN0");
    assert!(b64_decode("@@").is_err());
}

#[test]
fn ids_and_paths_are_checked() {
    assert!(is_skill_id("nestra.workspace-note"));
    assert!(is_skill_id("community.product-photo-cleanup"));
    for bad in [
        "noDot",
        "Upper.case",
        "a..b",
        "a.-b",
        "a.b-",
        "../x.y",
        "a b.c",
        "",
    ] {
        assert!(!is_skill_id(bad), "{bad}");
    }
    assert!(package_path("SKILL.md").is_ok());
    assert!(package_path("resources/guide v2.md").is_ok());
    assert!(package_path("LICENSE").is_ok());
    for bad in [
        "../x.md",
        "a/../b.md",
        "/abs.md",
        "C:/x.md",
        "a\\b.md",
        "run.ps1",
        "tool.exe",
        "page.html",
        "x.js",
        "scripts/notes.md",
        "a/b/c/d/e/f/g.md",
        "trailing.md.",
        "",
        // Windows device names, any case, any extension, any folder
        "CON.md",
        "con.md",
        "nul",
        "aux.json",
        "Prn.txt",
        "COM1.md",
        "lpt9.csv",
        "resources/con.md",
        "con/notes.md",
        "CON .md",
        "nul.tar.md",
    ] {
        assert!(package_path(bad).is_err(), "{bad}");
    }
    // names that only start like a device are fine
    for ok in [
        "console.md",
        "com10.md",
        "auxiliary.md",
        "lpt.md",
        "resources/nullable.md",
    ] {
        assert!(package_path(ok).is_ok(), "{ok}");
    }
}

/// the next `times` renames to a path ending with `fail_to` fail (an injected disk error)
struct FailingFs {
    fail_to: String,
    times: std::sync::Mutex<usize>,
}
impl FsOps for FailingFs {
    fn rename(&self, from: &Path, to: &Path) -> std::io::Result<()> {
        let mut left = self.times.lock().unwrap();
        if to.to_string_lossy().ends_with(&self.fail_to) && *left > 0 {
            *left -= 1;
            return Err(std::io::Error::other("injected rename failure"));
        }
        fs::rename(from, to)
    }
    fn remove_dir_all(&self, p: &Path) -> std::io::Result<()> {
        fs::remove_dir_all(p)
    }
}

#[test]
fn a_failed_update_keeps_the_old_version() {
    let (s, base) = store();
    s.write("realmnest.note", &[file("SKILL.md", b"# v1")])
        .unwrap();
    // the new version cannot be renamed into place: the old one is put back
    let failing = SkillStore::with_fs(
        base.join("skills"),
        None,
        Box::new(FailingFs {
            fail_to: "realmnest.note".into(),
            times: std::sync::Mutex::new(1),
        }),
    );
    let err = failing
        .write("realmnest.note", &[file("SKILL.md", b"# v2")])
        .unwrap_err();
    assert!(err.contains("injected"), "{err}");
    assert_eq!(
        b64_decode(&s.read_file("realmnest.note", "SKILL.md").unwrap()).unwrap(),
        b"# v1"
    );
    // even when putting it back fails too, the next start restores it from the backup
    let worse = SkillStore::with_fs(
        base.join("skills"),
        None,
        Box::new(FailingFs {
            fail_to: "realmnest.note".into(),
            times: std::sync::Mutex::new(2),
        }),
    );
    assert!(worse
        .write("realmnest.note", &[file("SKILL.md", b"# v2")])
        .is_err());
    assert!(s.read_file("realmnest.note", "SKILL.md").is_err());
    let restarted = SkillStore::new(base.join("skills"), None);
    assert_eq!(
        b64_decode(&restarted.read_file("realmnest.note", "SKILL.md").unwrap()).unwrap(),
        b"# v1"
    );
    // no staging or backup folder is left behind
    let names: Vec<String> = fs::read_dir(base.join("skills"))
        .unwrap()
        .flatten()
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    assert_eq!(names, ["realmnest.note"]);
    // and a working store replaces it normally
    s.write("realmnest.note", &[file("SKILL.md", b"# v2")])
        .unwrap();
    assert_eq!(
        b64_decode(&s.read_file("realmnest.note", "SKILL.md").unwrap()).unwrap(),
        b"# v2"
    );
    let _ = fs::remove_dir_all(base);
}

#[test]
fn an_interrupted_update_is_swept_or_restored_at_start() {
    let (_, base) = store();
    let root = base.join("skills");
    // stopped between the two renames: only the backup holds the package
    let backup = root.join(".backup-realmnest.note-123");
    fs::create_dir_all(&backup).unwrap();
    fs::write(backup.join("SKILL.md"), b"# kept").unwrap();
    // a backup whose package is in place, and a half-written staging folder
    fs::create_dir_all(root.join("realmnest.other")).unwrap();
    fs::write(root.join("realmnest.other").join("SKILL.md"), b"# other").unwrap();
    fs::create_dir_all(root.join(".backup-realmnest.other-5")).unwrap();
    fs::create_dir_all(root.join(".staging-realmnest.note-456").join("resources")).unwrap();
    let s = SkillStore::new(root.clone(), None);
    assert_eq!(
        b64_decode(&s.read_file("realmnest.note", "SKILL.md").unwrap()).unwrap(),
        b"# kept"
    );
    let mut names: Vec<String> = fs::read_dir(&root)
        .unwrap()
        .flatten()
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .collect();
    names.sort();
    assert_eq!(names, ["realmnest.note", "realmnest.other"]);
    let _ = fs::remove_dir_all(base);
}

#[test]
fn writes_reads_replaces_and_removes_atomically() {
    let (s, base) = store();
    s.write(
        "realmnest.note",
        &[
            file("SKILL.md", b"# Note"),
            file("skill.json", b"{}"),
            file("resources/a.md", b"hello"),
        ],
    )
    .unwrap();
    let files = s.read("realmnest.note").unwrap();
    assert_eq!(
        files.iter().map(|f| f.path.as_str()).collect::<Vec<_>>(),
        ["SKILL.md", "resources/a.md", "skill.json"]
    );
    assert_eq!(
        b64_decode(&s.read_file("realmnest.note", "resources/a.md").unwrap()).unwrap(),
        b"hello"
    );
    // a replacement drops files the new version does not have
    s.write(
        "realmnest.note",
        &[file("SKILL.md", b"# Note 2"), file("skill.json", b"{}")],
    )
    .unwrap();
    assert_eq!(s.read("realmnest.note").unwrap().len(), 2);
    assert!(s.read_file("realmnest.note", "resources/a.md").is_err());
    assert!(s.read_file("realmnest.note", "../x.md").is_err());
    s.remove("realmnest.note").unwrap();
    assert!(s.read("realmnest.note").unwrap().is_empty());
    // nothing is left in staging
    assert_eq!(fs::read_dir(base.join("skills")).unwrap().count(), 0);
    let _ = fs::remove_dir_all(base);
}

#[test]
fn refuses_unsafe_packages_before_writing_anything() {
    let (s, base) = store();
    let cases: Vec<Vec<WireFile>> = vec![
        vec![file("../escape.md", b"x")],
        vec![file("bin/tool.exe", b"x")],
        vec![file("notes.md", b"MZ\x90\x00 disguised executable")],
        vec![file("run.md", b"#!/bin/sh\nrm -rf /")],
        vec![file("scripts/run.md", b"x")],
        vec![file("big.md", &vec![b'a'; MAX_FILE_BYTES + 1])],
        vec![file("a.md", b"x"), file("A.md", b"y")],
        (0..=MAX_FILES)
            .map(|i| file(&format!("f{i}.md"), b"x"))
            .collect(),
    ];
    for files in cases {
        assert!(s.write("realmnest.bad", &files).is_err());
    }
    let too_big: Vec<WireFile> = (0..6)
        .map(|i| file(&format!("f{i}.md"), &vec![b'a'; MAX_FILE_BYTES]))
        .collect();
    assert!(s.write("realmnest.bad", &too_big).is_err());
    assert!(s.write("Bad Id", &[file("SKILL.md", b"x")]).is_err());
    assert!(!base.join("skills").join("realmnest.bad").exists());
    let _ = fs::remove_dir_all(base);
}

#[test]
fn exports_only_bundles_into_the_exports_folder() {
    let (s, base) = store();
    let p = s.export("nestra.note-1.0.0.nestra-skill", "{}").unwrap();
    assert!(p.ends_with("nestra.note-1.0.0.nestra-skill"));
    assert!(Path::new(&p).starts_with(base.join("exports")));
    for bad in [
        "../x.nestra-skill",
        "x.exe",
        "a\\b.nestra-skill",
        "UPPER.x-1.nestra-skill",
    ] {
        assert!(s.export(bad, "{}").is_err(), "{bad}");
    }
    let _ = fs::remove_dir_all(base);
}

#[cfg(windows)]
#[test]
fn does_not_follow_a_junction_out_of_a_skill() {
    let (s, base) = store();
    s.write("realmnest.note", &[file("SKILL.md", b"# Note")])
        .unwrap();
    let outside = base.join("outside");
    fs::create_dir_all(&outside).unwrap();
    fs::write(outside.join("secret.md"), b"secret").unwrap();
    let link = base.join("skills").join("realmnest.note").join("resources");
    let ok = std::process::Command::new("cmd")
        .args(["/C", "mklink", "/J"])
        .arg(&link)
        .arg(&outside)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);
    if ok {
        assert!(s
            .read_file("realmnest.note", "resources/secret.md")
            .is_err());
        assert!(!s
            .read("realmnest.note")
            .unwrap()
            .iter()
            .any(|f| f.path.contains("secret")));
    }
    let _ = fs::remove_dir_all(base);
}
