use super::*;
use std::sync::atomic::{AtomicU32, Ordering};

static N: AtomicU32 = AtomicU32::new(0);

fn store() -> (FileStore, PathBuf) {
    let dir = std::env::temp_dir().join(format!(
        "realmnest-files-{}-{}",
        std::process::id(),
        N.fetch_add(1, Ordering::SeqCst)
    ));
    let _ = fs::remove_dir_all(&dir);
    (
        FileStore::new(dir.join("files"), Some(dir.join("exports"))),
        dir,
    )
}

#[test]
fn sha256_matches_the_standard_vectors() {
    assert_eq!(
        sha256::hex(b""),
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    assert_eq!(
        sha256::hex(b"abc"),
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    assert_eq!(
        sha256::hex(b"abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
        "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
    );
    assert_eq!(
        sha256::hex(&vec![b'a'; 1_000_000]),
        "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0"
    );
}

#[test]
fn sniffs_by_content_not_name() {
    assert_eq!(sniff::mime(b"\x89PNG\r\n\x1a\nrest"), Some("image/png"));
    assert_eq!(sniff::mime(b"%PDF-1.7"), Some("application/pdf"));
    assert_eq!(sniff::mime(b"MZ\x90\0"), Some("application/x-msdownload"));
    assert_eq!(sniff::mime(b"  <svg xmlns=..."), Some("image/svg+xml"));
    assert_eq!(sniff::mime(b"<!DOCTYPE html><p>"), Some("text/html"));
    assert_eq!(sniff::mime(b"just text"), None);
}

#[test]
fn stores_once_by_content_and_checks_integrity() {
    let (s, dir) = store();
    let a = s.put(b"hello").unwrap();
    assert_eq!(a.storage_ref, format!("sha256:{}", sha256::hex(b"hello")));
    assert!(a.text && a.mime.is_none() && a.size == 5);
    assert_eq!(s.put(b"hello").unwrap(), a);
    assert_eq!(s.get(&a.storage_ref).unwrap(), b"hello");
    // a blob changed outside RealmNest is refused
    fs::write(s.blob(&a.sha256), b"HELLO").unwrap();
    assert_eq!(s.get(&a.storage_ref).unwrap_err().code, "FILE_CHANGED");
    assert!(s.delete(&a.storage_ref).unwrap());
    assert!(!s.exists(&a.storage_ref));
    assert_eq!(s.get(&a.storage_ref).unwrap_err().code, "FILE_NOT_FOUND");
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn refuses_anything_that_is_not_a_reference() {
    let (s, dir) = store();
    let bad_hex = format!("sha256:{}", "g".repeat(64));
    for bad in [
        "../x",
        "sha256:../../etc",
        "sha256:ABC",
        "C:\\Windows\\win.ini",
        bad_hex.as_str(),
    ] {
        assert_eq!(s.get(bad).unwrap_err().code, "INVALID_FILE", "{bad}");
        assert!(!s.exists(bad));
    }
    assert_eq!(
        s.put(&vec![0u8; MAX_FILE_BYTES + 1]).unwrap_err().code,
        "FILE_TOO_LARGE"
    );
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn moves_files_between_a_workspace_and_the_store() {
    let (s, dir) = store();
    let ws = dir.join("ws");
    fs::create_dir_all(&ws).unwrap();
    fs::write(ws.join("out.txt"), "RealmNest artifact runtime successful.").unwrap();
    let wsp = ws.to_string_lossy().to_string();
    let (st, shown) = s.import_workspace(&wsp, "out.txt").unwrap();
    assert_eq!(shown, "out.txt");
    assert_eq!(
        s.get(&st.storage_ref).unwrap(),
        b"RealmNest artifact runtime successful."
    );
    assert_eq!(
        s.import_workspace(&wsp, "../out.txt").unwrap_err().code,
        "INVALID_FILE"
    );
    assert_eq!(
        s.import_workspace(&wsp, "missing.txt").unwrap_err().code,
        "FILE_NOT_FOUND"
    );
    let w = s
        .to_workspace(&st.storage_ref, &wsp, "inputs/copy.txt")
        .unwrap();
    assert_eq!(w.path, "inputs/copy.txt");
    assert_eq!(
        fs::read(ws.join("inputs").join("copy.txt")).unwrap(),
        b"RealmNest artifact runtime successful."
    );
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn exports_copies_and_never_overwrites() {
    let (s, dir) = store();
    let st = s.put(b"data").unwrap();
    let a = s.export_default(&st.storage_ref, "re/port.md").unwrap();
    let b = s.export_default(&st.storage_ref, "re/port.md").unwrap();
    assert_eq!(a.file_name().unwrap(), "port.md");
    assert_eq!(b.file_name().unwrap(), "port (2).md");
    assert!(s.exists(&st.storage_ref));
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn names_and_openable_kinds() {
    assert_eq!(safe_name("..\\..\\evil.png"), "evil.png");
    assert_eq!(safe_name("a<b>:c?.txt"), "a_b__c_.txt");
    assert_eq!(safe_name(".hidden"), "file.hidden");
    // device names, whatever the case or extension
    for dev in [
        "CON",
        "con.txt",
        "Nul.pdf",
        "COM1.md",
        "lpt9",
        "AUX .log",
        "conout$.txt",
    ] {
        assert!(safe_name(dev).starts_with('_'), "{dev}");
    }
    assert_eq!(safe_name("console.txt"), "console.txt");
    assert_eq!(safe_name("COM10.txt"), "COM10.txt");
    let png = b"\x89PNG\r\n\x1a\nrest";
    assert!(may_open("photo.png", png));
    assert!(!may_open("setup.exe", b"MZ\x90\0"));
    assert!(!may_open("page.html", b"<!doctype html><p>"));
    assert!(!may_open("photo.png", b"MZ\x90\0"));
}

#[test]
fn opens_only_documents_whose_bytes_match_their_name() {
    let pdf: &[u8] = b"%PDF-1.7\n...";
    let mz: &[u8] = b"MZ\x90\0\x03\0\0\0";
    // the name as Windows writes it decides, not the raw name
    for name in [
        "a.exe.",
        "a.exe ",
        "a.EXE..",
        "a.iso",
        "a.rdp",
        "a.py",
        "a.bat.",
        "a.svg",
        "a.html",
        "a.lnk",
        "a.msc",
        "a.docm",
        "a.pdf.exe",
        "a",
        "a.pdf:x.exe",
    ] {
        assert!(!may_open(name, pdf), "{name}");
    }
    // an executable, script or web page under a document name
    assert!(!may_open("a.pdf", mz));
    assert!(!may_open("a.txt", mz));
    assert!(!may_open("a.png", b"\x7fELF\x02"));
    assert!(!may_open("a.txt", b"#!/bin/sh\nrm -rf /"));
    assert!(!may_open("a.txt", b"<html><script>x</script>"));
    assert!(!may_open("a.md", b"<svg onload=x>"));
    assert!(!may_open("a.docx", pdf));
    // real documents and media
    assert!(may_open("Report.pdf", pdf));
    assert!(may_open("Report.PDF", pdf));
    assert!(may_open("photo.png", b"\x89PNG\r\n\x1a\nrest"));
    assert!(may_open("notes.txt", "plain text, è".as_bytes()));
    assert!(may_open("data.json", b"{\"a\":1}"));
    assert!(may_open("sheet.xlsx", b"PK\x03\x04rest"));
    assert!(may_open("song.mp3", b"ID3\x04"));
    // the store refuses before any copy is made
    let (s, dir) = store();
    let exe = s.put(mz).unwrap();
    for name in ["Invoice.pdf.", "Invoice.exe."] {
        assert_eq!(
            s.open_copy(&exe.storage_ref, name).unwrap_err().code,
            "UNSUPPORTED_FILE_TYPE"
        );
    }
    assert!(!s.root.join("open").exists());
    let doc = s.put(pdf).unwrap();
    let p = s.open_copy(&doc.storage_ref, "Report.pdf ").unwrap();
    assert_eq!(p.file_name().unwrap(), "Report.pdf");
    assert_eq!(fs::read(&p).unwrap(), pdf);
    #[cfg(windows)]
    {
        let mut ads = p.as_os_str().to_owned();
        ads.push(":Zone.Identifier");
        // NTFS keeps the Mark-of-the-Web; other volumes may not (best effort)
        if let Ok(z) = fs::read_to_string(PathBuf::from(ads)) {
            assert!(z.contains("ZoneId=3"));
        }
    }
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn report_pages_get_the_strict_policy_first() {
    let page = report_page("<!doctype html><html lang=\"it\"><head><meta charset=\"utf-8\"><script>alert(1)</script></head><body>x</body></html>").unwrap();
    let csp = page.find("Content-Security-Policy").unwrap();
    assert!(csp < page.find("<script>").unwrap());
    assert!(page.contains("default-src 'none'"));
    assert!(report_page("<html><body>no doctype</body></html>").is_err());
    assert!(report_page("<!doctype html><body>no head</body>").is_err());
    // nothing may come before RealmNest's policy
    for trick in [
        "<!doctype html><script>alert(1)</script><head></head>",
        "<!doctype html><html><script>alert(1)</script><head></head>",
        "<!doctype html><html><title><head></title><script>alert(1)</script>",
        "<!doctype html><html lang=\"x><script>alert(1)</script>\"><head></head>",
        "<!doctype html><!-- x --><html><head></head>",
        "<!doctype html><htmlx><head></head>",
        "x<!doctype html><html><head></head>",
    ] {
        assert!(report_page(trick).is_err(), "{trick}");
    }
    let ok =
        report_page("\u{feff} <!DOCTYPE html>\n<html lang=\"it\">\n <HEAD><title>t</title></head>")
            .unwrap();
    assert!(ok.contains("<HEAD><meta http-equiv=\"Content-Security-Policy\""));
    let (s, dir) = store();
    let p = s
        .report_copy(
            "../../evil",
            "<!doctype html><html><head></head><body>ok</body></html>",
        )
        .unwrap();
    assert_eq!(p.file_name().unwrap(), "evil.html");
    assert!(p.parent().unwrap().ends_with("exports/Reports"));
    assert!(fs::read_to_string(&p).unwrap().contains(&report_csp()));
    // the same hash the export's own policy names (src/runtime/research/export.ts)
    assert!(
        report_csp().contains("script-src 'sha256-QA0mEiyNQK9SX/umq7jxrbUyKUx7kdkznzYDkVDGh3s='")
    );
    assert!(!report_csp().contains("https:"));
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn collects_only_unreferenced_old_blobs() {
    let (s, dir) = store();
    let keep = s.put(b"kept").unwrap();
    let drop_ = s.put(b"orphan").unwrap();
    let young = s.put(b"just attached").unwrap();
    s.named_copy(&keep.storage_ref, "kept.txt").unwrap();
    let refs: std::collections::HashSet<String> = [keep.storage_ref.clone()].into_iter().collect();
    // nothing is old enough yet
    let u = s.collect(&refs, std::time::Duration::from_secs(3600));
    assert_eq!((u.removed, u.kept), (0, 3));
    // an expired trash day goes for good, a recent one and anything else stays
    let old_day = s.root.join("trash").join("2000-01-01");
    fs::create_dir_all(&old_day).unwrap();
    fs::write(old_day.join("x"), b"x").unwrap();
    let other = s.root.join("trash").join("notes");
    fs::create_dir_all(&other).unwrap();
    let u = s.collect(&refs, std::time::Duration::ZERO);
    assert_eq!((u.removed, u.kept, u.purged), (2, 1, 1));
    assert!(!old_day.exists() && other.exists());
    // collected blobs are moved to today's trash, not deleted
    let today = (std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs()
        / 86_400) as i64;
    let trash = s.root.join("trash").join(day_name(today));
    assert!(trash.join(&drop_.sha256).is_file() && trash.join(&young.sha256).is_file());
    assert!(!s.blob(&drop_.sha256).exists());
    assert!(!s.root.join("open").read_dir().unwrap().any(|_| true));
    // a record that still needs one gets it back from the trash
    assert_eq!(s.get(&drop_.storage_ref).unwrap(), b"orphan");
    assert!(s.blob(&drop_.sha256).is_file() && !trash.join(&drop_.sha256).exists());
    assert!(s.exists(&young.storage_ref));
    assert!(s.exists(&keep.storage_ref));
    let _ = fs::remove_dir_all(dir);
}

#[test]
fn trash_days_round_trip() {
    assert_eq!(day_name(0), "1970-01-01");
    assert_eq!(day_name(20_376), "2025-10-15");
    assert_eq!(day_number("2025-10-15"), Some(20_376));
    assert_eq!(
        day_number("2024-02-29").map(day_name).as_deref(),
        Some("2024-02-29")
    );
    for d in [-1, 59, 60, 11_016, 30_000] {
        assert_eq!(day_number(&day_name(d)), Some(d));
    }
    for bad in [
        "2025-13-01",
        "2025-1-01",
        "notes",
        "2025-10-15x",
        "abcd-ef-gh",
    ] {
        assert_eq!(day_number(bad), None, "{bad}");
    }
}
