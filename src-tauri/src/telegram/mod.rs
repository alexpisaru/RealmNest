//! The Telegram bridge (docs/TELEGRAM.md): a bot the owner pairs with RealmNest, reached by long
//! polling (`getUpdates`), so nothing listens on the network and no server is needed. While
//! RealmNest is open the bot answers; when it closes, the bot goes quiet.
//!
//! Safety:
//! - the bot token lives in the OS credential store (`telegram.botToken`) and is read here only;
//!   it never reaches the webview, logs, events or error messages (errors never carry a URL);
//! - one origin (https://api.telegram.org), a fixed list of methods, no redirects, size limits
//!   and timeouts;
//! - only paired users (numeric Telegram ids, never usernames) are served: every other update is
//!   dropped here, before the webview sees it. Pairing needs a short-lived code shown in the app;
//! - messages and files go only to the chats of paired users.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::hash::{BuildHasher, Hasher};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::watch;

pub const TOKEN_REF: &str = "telegram.botToken";
const API: &str = "https://api.telegram.org";
/// the methods RealmNest may call, nothing else
const METHODS: &[&str] = &[
    "getMe",
    "getUpdates",
    "sendMessage",
    "editMessageText",
    "answerCallbackQuery",
    "sendChatAction",
    "sendDocument",
    "sendPhoto",
    "getFile",
];
/// bots may download files up to 20 MB
pub const MAX_FILE: usize = 20 * 1024 * 1024;
const MAX_TEXT: usize = 4096;
const MAX_BUTTON_DATA: usize = 64;
const MAX_RESPONSE: usize = 4 * 1024 * 1024;
const POLL_SECONDS: u64 = 50;
const PAIR_TTL_MS: u64 = 10 * 60_000;
const PAIR_TRIES: u32 = 5;

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

// ── what the webview sees ────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TgUser {
    pub user_id: i64,
    pub chat_id: i64,
    pub name: String,
    pub role: String,
    pub paired_at: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TgFile {
    pub file_id: String,
    /// document · photo · voice · audio · video
    pub kind: String,
    pub name: Option<String>,
    pub mime: Option<String>,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "t", rename_all = "camelCase")]
pub enum TgEvent {
    #[serde(rename_all = "camelCase")]
    Message {
        chat_id: i64,
        user_id: i64,
        message_id: i64,
        text: Option<String>,
        file: Option<TgFile>,
    },
    #[serde(rename_all = "camelCase")]
    Callback {
        id: String,
        chat_id: i64,
        user_id: i64,
        message_id: i64,
        data: String,
    },
    Paired {
        user: TgUser,
    },
    Status {
        running: bool,
        error: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TgStatus {
    pub has_token: bool,
    pub running: bool,
    pub bot: Option<String>,
    pub error: Option<String>,
    pub users: Vec<TgUser>,
    /// a pairing code is open until then
    pub pairing_until: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairCode {
    pub code: String,
    pub expires_at: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TgButton {
    pub text: String,
    pub data: String,
}

// ── state ────────────────────────────────────────────────────

#[derive(Default, Serialize, Deserialize)]
struct Saved {
    users: Vec<TgUser>,
    /// the next update to ask for
    offset: i64,
}

struct Pairing {
    code: String,
    expires: u64,
    fails: u32,
}

#[derive(Default)]
struct Inner {
    saved: Saved,
    pairing: Option<Pairing>,
    stop: Option<watch::Sender<bool>>,
    running: bool,
    error: Option<String>,
    bot: Option<String>,
}

pub struct Telegram {
    http: reqwest::Client,
    /// `telegram.json` in RealmNest's data folder: paired users and the update offset (no secrets)
    path: Option<PathBuf>,
    inner: Mutex<Inner>,
}

/// what handling one update asks for (pure, so it can be tested without the network)
#[derive(Debug, PartialEq)]
pub enum Outcome {
    /// a paired user wrote or pressed a button: to the webview
    Event(TgEvent),
    /// the pairing worked: tell the user and the webview
    Paired(TgUser),
    /// a wrong code: tell the sender nothing useful
    Refused { chat_id: i64 },
    /// not for RealmNest (not paired, not private, nothing usable)
    Ignore,
}

#[derive(Debug)]
pub struct TgError(pub String);

impl Telegram {
    pub fn new(path: Option<PathBuf>) -> Arc<Self> {
        let http = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .https_only(true)
            .connect_timeout(Duration::from_secs(15))
            .user_agent("RealmNest")
            .build()
            .expect("HTTP client");
        let saved = path
            .as_ref()
            .and_then(|p| std::fs::read(p).ok())
            .and_then(|b| serde_json::from_slice::<Saved>(&b).ok())
            .unwrap_or_default();
        Arc::new(Telegram {
            http,
            path,
            inner: Mutex::new(Inner {
                saved,
                ..Default::default()
            }),
        })
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Inner> {
        self.inner.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn save(&self, inner: &Inner) {
        if let Some(p) = &self.path {
            if let Ok(b) = serde_json::to_vec_pretty(&inner.saved) {
                let tmp = p.with_extension("json.tmp");
                if std::fs::write(&tmp, b).is_ok() {
                    let _ = std::fs::rename(&tmp, p);
                }
            }
        }
    }

    fn token() -> Result<String, TgError> {
        crate::secrets::read(TOKEN_REF)
            .map_err(TgError)?
            .filter(|t| !t.trim().is_empty())
            .ok_or_else(|| {
                TgError("No bot token is stored: paste the one BotFather gave you.".into())
            })
    }

    pub fn status(&self) -> TgStatus {
        let i = self.lock();
        let now = now_ms();
        TgStatus {
            has_token: crate::secrets::exists(TOKEN_REF).unwrap_or(false),
            running: i.running,
            bot: i.bot.clone(),
            error: i.error.clone(),
            users: i.saved.users.clone(),
            pairing_until: i
                .pairing
                .as_ref()
                .filter(|p| p.expires > now)
                .map(|p| p.expires),
        }
    }

    // ── the Bot API ──────────────────────────────────────────

    async fn call(
        &self,
        token: &str,
        method: &str,
        body: Value,
        timeout: Duration,
    ) -> Result<Value, TgError> {
        if !METHODS.contains(&method) {
            return Err(TgError("This Telegram operation is not allowed.".into()));
        }
        let resp = self
            .http
            .post(format!("{API}/bot{token}/{method}"))
            .json(&body)
            .timeout(timeout)
            .send()
            .await
            .map_err(|e| TgError(network_message(&e)))?;
        read_answer(resp).await
    }

    /// the bot's @name (`getMe`): checks the token without sending anything
    pub async fn verify(&self) -> Result<String, TgError> {
        let token = Self::token()?;
        let me = self
            .call(&token, "getMe", json!({}), Duration::from_secs(20))
            .await?;
        let name = me["username"]
            .as_str()
            .map(|u| format!("@{u}"))
            .unwrap_or_else(|| "bot".into());
        self.lock().bot = Some(name.clone());
        Ok(name)
    }

    fn chat_allowed(&self, chat_id: i64) -> bool {
        self.lock().saved.users.iter().any(|u| u.chat_id == chat_id)
    }

    /// a text message (plain text; longer ones are cut, the bridge splits them first)
    /// a text message: plain, or Telegram HTML (`<b> <i> <code> <pre> <a> <blockquote>`); HTML that
    /// Telegram cannot parse is sent again as plain text, so a message is never lost
    pub async fn send(
        &self,
        chat_id: i64,
        text: &str,
        buttons: Option<Vec<Vec<TgButton>>>,
        html: bool,
    ) -> Result<i64, TgError> {
        if !self.chat_allowed(chat_id) {
            return Err(TgError("That chat is not paired with RealmNest.".into()));
        }
        let token = Self::token()?;
        let keys = keyboard(buttons)?;
        let body = |text: String, html: bool| {
            let mut b =
                json!({ "chat_id": chat_id, "text": text, "disable_web_page_preview": true });
            if html {
                b["parse_mode"] = json!("HTML");
            }
            if let Some(k) = &keys {
                b["reply_markup"] = k.clone();
            }
            b
        };
        let sent = self
            .call(
                &token,
                "sendMessage",
                body(cut(text, MAX_TEXT), html),
                Duration::from_secs(30),
            )
            .await;
        let m = match sent {
            Err(TgError(e)) if html && e.contains("parse") => {
                self.call(
                    &token,
                    "sendMessage",
                    body(cut(&plain(text), MAX_TEXT), false),
                    Duration::from_secs(30),
                )
                .await?
            }
            other => other?,
        };
        Ok(m["message_id"].as_i64().unwrap_or(0))
    }

    /// a picture with an optional caption and buttons (the agents' portraits)
    pub async fn send_photo(
        &self,
        chat_id: i64,
        bytes: Vec<u8>,
        caption: Option<&str>,
        buttons: Option<Vec<Vec<TgButton>>>,
        html: bool,
    ) -> Result<i64, TgError> {
        if !self.chat_allowed(chat_id) {
            return Err(TgError("That chat is not paired with RealmNest.".into()));
        }
        if bytes.is_empty() || bytes.len() > 10 * 1024 * 1024 {
            return Err(TgError("Telegram takes photos up to 10 MB.".into()));
        }
        let token = Self::token()?;
        let markup = keyboard(buttons)?.map(|k| k.to_string());
        let (boundary, body) = form(
            chat_id,
            "photo",
            "agents.png",
            "image/png",
            &bytes,
            &[
                ("caption", caption.map(|c| cut(c, 1024))),
                ("parse_mode", html.then(|| "HTML".to_string())),
                ("reply_markup", markup),
            ],
        );
        let resp = self
            .http
            .post(format!("{API}/bot{token}/sendPhoto"))
            .header(
                "Content-Type",
                format!("multipart/form-data; boundary={boundary}"),
            )
            .body(body)
            .timeout(Duration::from_secs(120))
            .send()
            .await
            .map_err(|e| TgError(network_message(&e)))?;
        let m = read_answer(resp).await?;
        Ok(m["message_id"].as_i64().unwrap_or(0))
    }

    pub async fn edit(
        &self,
        chat_id: i64,
        message_id: i64,
        text: &str,
        buttons: Option<Vec<Vec<TgButton>>>,
        html: bool,
    ) -> Result<(), TgError> {
        if !self.chat_allowed(chat_id) {
            return Err(TgError("That chat is not paired with RealmNest.".into()));
        }
        let token = Self::token()?;
        let mut body =
            json!({ "chat_id": chat_id, "message_id": message_id, "text": cut(text, MAX_TEXT) });
        if html {
            body["parse_mode"] = json!("HTML");
        }
        body["reply_markup"] =
            keyboard(buttons)?.unwrap_or_else(|| json!({ "inline_keyboard": [] }));
        self.call(&token, "editMessageText", body, Duration::from_secs(30))
            .await
            .map(|_| ())
    }

    pub async fn answer(&self, callback_id: &str, text: Option<&str>) -> Result<(), TgError> {
        if callback_id.is_empty() || callback_id.len() > 128 {
            return Err(TgError("Invalid button answer.".into()));
        }
        let token = Self::token()?;
        let mut body = json!({ "callback_query_id": callback_id });
        if let Some(t) = text {
            body["text"] = json!(cut(t, 200));
        }
        self.call(&token, "answerCallbackQuery", body, Duration::from_secs(20))
            .await
            .map(|_| ())
    }

    pub async fn typing(&self, chat_id: i64) -> Result<(), TgError> {
        if !self.chat_allowed(chat_id) {
            return Err(TgError("That chat is not paired with RealmNest.".into()));
        }
        let token = Self::token()?;
        self.call(
            &token,
            "sendChatAction",
            json!({ "chat_id": chat_id, "action": "typing" }),
            Duration::from_secs(20),
        )
        .await
        .map(|_| ())
    }

    /// a file as a document (multipart/form-data, built here: no extra crate)
    pub async fn send_document(
        &self,
        chat_id: i64,
        name: &str,
        bytes: Vec<u8>,
        caption: Option<&str>,
    ) -> Result<i64, TgError> {
        if !self.chat_allowed(chat_id) {
            return Err(TgError("That chat is not paired with RealmNest.".into()));
        }
        if bytes.is_empty() || bytes.len() > 50 * 1024 * 1024 {
            return Err(TgError("Telegram takes documents up to 50 MB.".into()));
        }
        let token = Self::token()?;
        let (boundary, body) = multipart(chat_id, &safe_file_name(name), &bytes, caption);
        let resp = self
            .http
            .post(format!("{API}/bot{token}/sendDocument"))
            .header(
                "Content-Type",
                format!("multipart/form-data; boundary={boundary}"),
            )
            .body(body)
            .timeout(Duration::from_secs(180))
            .send()
            .await
            .map_err(|e| TgError(network_message(&e)))?;
        let m = read_answer(resp).await?;
        Ok(m["message_id"].as_i64().unwrap_or(0))
    }

    /// a file a paired user sent the bot (`getFile`, then the download), at most 20 MB
    pub async fn fetch_file(&self, file_id: &str) -> Result<Vec<u8>, TgError> {
        if file_id.is_empty()
            || file_id.len() > 256
            || !file_id
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
        {
            return Err(TgError("Invalid file.".into()));
        }
        let token = Self::token()?;
        let f = self
            .call(
                &token,
                "getFile",
                json!({ "file_id": file_id }),
                Duration::from_secs(30),
            )
            .await?;
        if f["file_size"].as_u64().unwrap_or(0) as usize > MAX_FILE {
            return Err(TgError(
                "The file is larger than 20 MB, the most a bot can download.".into(),
            ));
        }
        let path = f["file_path"].as_str().unwrap_or_default();
        if path.is_empty()
            || path.len() > 512
            || path.contains("..")
            || !path
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '/' | '_' | '-' | '.'))
        {
            return Err(TgError("Telegram gave no usable file.".into()));
        }
        let resp = self
            .http
            .get(format!("{API}/file/bot{token}/{path}"))
            .timeout(Duration::from_secs(120))
            .send()
            .await
            .map_err(|e| TgError(network_message(&e)))?;
        if !resp.status().is_success() {
            return Err(TgError(format!(
                "Telegram answered {} for the file.",
                resp.status().as_u16()
            )));
        }
        read_limited(resp, MAX_FILE)
            .await
            .map_err(|_| TgError("The file is too large or was cut off.".into()))
    }

    // ── pairing ──────────────────────────────────────────────

    pub fn pair_begin(&self) -> PairCode {
        let code = format!("{:06}", random_u64() % 1_000_000);
        let expires = now_ms() + PAIR_TTL_MS;
        self.lock().pairing = Some(Pairing {
            code: code.clone(),
            expires,
            fails: 0,
        });
        PairCode {
            code,
            expires_at: expires,
        }
    }

    pub fn pair_cancel(&self) {
        self.lock().pairing = None;
    }

    pub fn remove_user(&self, user_id: i64) -> bool {
        let mut i = self.lock();
        let before = i.saved.users.len();
        i.saved.users.retain(|u| u.user_id != user_id);
        let changed = i.saved.users.len() != before;
        if changed {
            self.save(&i);
        }
        changed
    }

    /// One update from Telegram → what to do with it. Unpaired senders get nothing but pairing.
    pub fn handle(&self, u: &Value, now: u64) -> Outcome {
        let (from, chat, msg) = if let Some(m) = u.get("message") {
            (&m["from"], &m["chat"], Some(m))
        } else if let Some(c) = u.get("callback_query") {
            (&c["from"], &c["message"]["chat"], None)
        } else {
            return Outcome::Ignore;
        };
        let (Some(user_id), Some(chat_id)) = (from["id"].as_i64(), chat["id"].as_i64()) else {
            return Outcome::Ignore;
        };
        // private chats only (no groups or channels in v1)
        if chat["type"].as_str() != Some("private") || from["is_bot"].as_bool() == Some(true) {
            return Outcome::Ignore;
        }
        let mut i = self.lock();
        let paired = i.saved.users.iter().any(|x| x.user_id == user_id);
        if !paired {
            let text = msg.and_then(|m| m["text"].as_str()).unwrap_or_default();
            let Some(code) = text.strip_prefix("/start ").map(str::trim) else {
                return Outcome::Ignore;
            };
            let Some(p) = i.pairing.as_mut() else {
                return Outcome::Ignore;
            };
            if p.expires <= now {
                i.pairing = None;
                return Outcome::Ignore;
            }
            if code != p.code {
                p.fails += 1;
                if p.fails >= PAIR_TRIES {
                    i.pairing = None;
                }
                return Outcome::Refused { chat_id };
            }
            let name = [from["first_name"].as_str(), from["last_name"].as_str()]
                .into_iter()
                .flatten()
                .collect::<Vec<_>>()
                .join(" ");
            let user = TgUser {
                user_id,
                chat_id,
                name: cut(
                    if name.trim().is_empty() {
                        "Telegram"
                    } else {
                        name.trim()
                    },
                    80,
                ),
                role: if i.saved.users.is_empty() {
                    "owner".into()
                } else {
                    "user".into()
                },
                paired_at: now,
            };
            i.saved.users.push(user.clone());
            i.pairing = None;
            self.save(&i);
            return Outcome::Paired(user);
        }
        drop(i);
        if let Some(m) = msg {
            let text = m["text"]
                .as_str()
                .or_else(|| m["caption"].as_str())
                .map(|t| cut(t, 16_000));
            let file = file_of(m);
            if text.is_none() && file.is_none() {
                return Outcome::Ignore;
            }
            return Outcome::Event(TgEvent::Message {
                chat_id,
                user_id,
                message_id: m["message_id"].as_i64().unwrap_or(0),
                text,
                file,
            });
        }
        let c = &u["callback_query"];
        let (Some(id), Some(data)) = (c["id"].as_str(), c["data"].as_str()) else {
            return Outcome::Ignore;
        };
        Outcome::Event(TgEvent::Callback {
            id: id.to_string(),
            chat_id,
            user_id,
            message_id: c["message"]["message_id"].as_i64().unwrap_or(0),
            data: cut(data, MAX_BUTTON_DATA),
        })
    }

    // ── polling ──────────────────────────────────────────────

    pub fn running(&self) -> bool {
        self.lock().running
    }

    /// Starts the long-polling loop (replacing a running one); every outcome goes to `emit`.
    pub fn start(
        self: &Arc<Self>,
        emit: Arc<dyn Fn(TgEvent) + Send + Sync>,
    ) -> Result<(), TgError> {
        let token = Self::token()?;
        let (tx, mut rx) = watch::channel(false);
        {
            let mut i = self.lock();
            if let Some(old) = i.stop.take() {
                let _ = old.send(true);
            }
            i.stop = Some(tx);
            i.running = true;
            i.error = None;
        }
        emit(TgEvent::Status {
            running: true,
            error: None,
        });
        let me = self.clone();
        tauri::async_runtime::spawn(async move {
            let mut backoff = 2u64;
            loop {
                if *rx.borrow() {
                    break;
                }
                let offset = me.lock().saved.offset;
                let body = json!({ "offset": offset, "timeout": POLL_SECONDS, "allowed_updates": ["message", "callback_query"] });
                let got = tokio::select! {
                    r = me.call(&token, "getUpdates", body, Duration::from_secs(POLL_SECONDS + 20)) => r,
                    _ = rx.changed() => break,
                };
                match got {
                    Ok(list) => {
                        backoff = 2;
                        if me.lock().error.take().is_some() {
                            emit(TgEvent::Status {
                                running: true,
                                error: None,
                            });
                        }
                        for u in list.as_array().cloned().unwrap_or_default() {
                            let id = u["update_id"].as_i64().unwrap_or(0);
                            match me.handle(&u, now_ms()) {
                                Outcome::Event(e) => emit(e),
                                Outcome::Paired(user) => {
                                    let _ = me.send(user.chat_id, "<b>Collegato a RealmNest.</b>\nScrivi /help per vedere cosa puoi fare.", None, true).await;
                                    emit(TgEvent::Paired { user });
                                }
                                Outcome::Refused { chat_id } => {
                                    // an unpaired sender: a plain answer, sent outside the paired-chat rule on purpose
                                    let _ = me.call(&token, "sendMessage", json!({ "chat_id": chat_id, "text": "Codice non valido." }), Duration::from_secs(20)).await;
                                }
                                Outcome::Ignore => {}
                            }
                            let mut i = me.lock();
                            if id >= i.saved.offset {
                                i.saved.offset = id + 1;
                                me.save(&i);
                            }
                        }
                    }
                    Err(TgError(message)) => {
                        // a rejected token or another poller: stop and say why; anything else: retry later
                        let fatal = message.contains("rejected the bot token")
                            || message.contains("another");
                        {
                            let mut i = me.lock();
                            i.error = Some(message.clone());
                            if fatal {
                                i.running = false;
                            }
                        }
                        emit(TgEvent::Status {
                            running: !fatal,
                            error: Some(message),
                        });
                        if fatal {
                            return;
                        }
                        tokio::select! {
                            _ = tokio::time::sleep(Duration::from_secs(backoff)) => {},
                            _ = rx.changed() => break,
                        }
                        backoff = (backoff * 2).min(60);
                    }
                }
            }
            me.lock().running = false;
            emit(TgEvent::Status {
                running: false,
                error: None,
            });
        });
        Ok(())
    }

    pub fn stop(&self) {
        let mut i = self.lock();
        if let Some(tx) = i.stop.take() {
            let _ = tx.send(true);
        }
        i.running = false;
    }

    /// forget everything: stop, paired users and offset (the token is deleted by the caller)
    pub fn reset(&self) {
        self.stop();
        let mut i = self.lock();
        i.saved = Saved::default();
        i.pairing = None;
        i.bot = None;
        i.error = None;
        self.save(&i);
    }
}

// ── helpers ──────────────────────────────────────────────────

fn file_of(m: &Value) -> Option<TgFile> {
    let pick = |v: &Value, kind: &str| -> Option<TgFile> {
        Some(TgFile {
            file_id: v["file_id"].as_str()?.chars().take(256).collect(),
            kind: kind.into(),
            name: v["file_name"].as_str().map(|n| cut(n, 200)),
            mime: v["mime_type"].as_str().map(|n| cut(n, 100)),
            size: v["file_size"].as_u64(),
        })
    };
    if let Some(d) = m.get("document") {
        return pick(d, "document");
    }
    // photos come in sizes: the largest
    if let Some(p) = m["photo"].as_array().and_then(|a| a.last()) {
        return pick(p, "photo");
    }
    for kind in ["voice", "audio", "video"] {
        if let Some(v) = m.get(kind) {
            return pick(v, kind);
        }
    }
    None
}

fn keyboard(buttons: Option<Vec<Vec<TgButton>>>) -> Result<Option<Value>, TgError> {
    let Some(rows) = buttons.filter(|r| !r.is_empty()) else {
        return Ok(None);
    };
    if rows.len() > 8 || rows.iter().any(|r| r.is_empty() || r.len() > 4) {
        return Err(TgError("Too many buttons.".into()));
    }
    let mut out = Vec::new();
    for r in rows {
        let mut row = Vec::new();
        for b in r {
            if b.text.trim().is_empty() || b.data.is_empty() || b.data.len() > MAX_BUTTON_DATA {
                return Err(TgError("Invalid button.".into()));
            }
            row.push(json!({ "text": cut(&b.text, 64), "callback_data": b.data }));
        }
        out.push(Value::Array(row));
    }
    Ok(Some(json!({ "inline_keyboard": out })))
}

/// at most `max` characters (whole characters)
fn cut(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        s.chars()
            .take(max.saturating_sub(1))
            .chain(std::iter::once('…'))
            .collect()
    }
}

fn safe_file_name(name: &str) -> String {
    let n: String = name
        .chars()
        .filter(|c| !c.is_control() && !matches!(c, '"' | '\\' | '/' | '\r' | '\n'))
        .take(120)
        .collect();
    if n.trim().is_empty() {
        "file".into()
    } else {
        n
    }
}

/// HTML → the same text without tags (for the plain-text retry)
fn plain(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut in_tag = false;
    for c in html.chars() {
        match c {
            '<' => in_tag = true,
            '>' if in_tag => in_tag = false,
            c if !in_tag => out.push(c),
            _ => {}
        }
    }
    out.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&amp;", "&")
}

/// multipart/form-data with text fields and one file
fn form(
    chat_id: i64,
    field: &str,
    name: &str,
    mime: &str,
    bytes: &[u8],
    extra: &[(&str, Option<String>)],
) -> (String, Vec<u8>) {
    let boundary = format!("realmnest{:016x}", random_u64());
    let mut b = Vec::with_capacity(bytes.len() + 1024);
    let mut text = |k: &str, v: &str| {
        b.extend_from_slice(
            format!("--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n")
                .as_bytes(),
        );
    };
    text("chat_id", &chat_id.to_string());
    for (k, v) in extra {
        if let Some(v) = v {
            text(k, v);
        }
    }
    b.extend_from_slice(format!("--{boundary}\r\nContent-Disposition: form-data; name=\"{field}\"; filename=\"{name}\"\r\nContent-Type: {mime}\r\n\r\n").as_bytes());
    b.extend_from_slice(bytes);
    b.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    (boundary, b)
}

fn multipart(chat_id: i64, name: &str, bytes: &[u8], caption: Option<&str>) -> (String, Vec<u8>) {
    let boundary = format!("realmnest{:016x}", random_u64());
    let mut b = Vec::with_capacity(bytes.len() + 512);
    let mut field = |name: &str, value: &str| {
        b.extend_from_slice(format!("--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n").as_bytes());
    };
    field("chat_id", &chat_id.to_string());
    if let Some(c) = caption {
        field("caption", &cut(c, 1024));
    }
    b.extend_from_slice(format!("--{boundary}\r\nContent-Disposition: form-data; name=\"document\"; filename=\"{name}\"\r\nContent-Type: application/octet-stream\r\n\r\n").as_bytes());
    b.extend_from_slice(bytes);
    b.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    (boundary, b)
}

/// random from the OS (the hasher's keys are seeded by the system's random source)
fn random_u64() -> u64 {
    let mut h = std::collections::hash_map::RandomState::new().build_hasher();
    h.write_u128(now_ms() as u128);
    h.finish()
}

async fn read_limited(mut resp: reqwest::Response, max: usize) -> Result<Vec<u8>, ()> {
    let mut out = Vec::new();
    while let Some(chunk) = resp.chunk().await.map_err(|_| ())? {
        out.extend_from_slice(&chunk);
        if out.len() > max {
            return Err(());
        }
    }
    Ok(out)
}

/// the Bot API's `{ok, result}` / `{ok:false, error_code, description}`, without ever echoing a URL
async fn read_answer(resp: reqwest::Response) -> Result<Value, TgError> {
    let status = resp.status().as_u16();
    let body = read_limited(resp, MAX_RESPONSE)
        .await
        .map_err(|_| TgError("Telegram's answer was too large.".into()))?;
    let j: Value = serde_json::from_slice(&body).unwrap_or(Value::Null);
    if j["ok"].as_bool() == Some(true) {
        return Ok(j["result"].clone());
    }
    let said = j["description"]
        .as_str()
        .map(|d| cut(d, 200))
        .unwrap_or_default();
    Err(TgError(match status {
        401 | 404 => "Telegram rejected the bot token: create it again with BotFather.".into(),
        409 => "another program or a webhook is already reading this bot's updates.".into(),
        429 => "Telegram is limiting this bot; it will retry shortly.".into(),
        _ if said.is_empty() => format!("Telegram answered {status}."),
        _ => format!("Telegram: {said}"),
    }))
}

fn network_message(e: &reqwest::Error) -> String {
    if e.is_timeout() {
        "Telegram did not answer in time.".into()
    } else if e.is_connect() {
        "Could not reach Telegram (network or firewall).".into()
    } else {
        "The connection to Telegram failed.".into()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tg() -> Arc<Telegram> {
        Telegram::new(None)
    }
    fn msg(user: i64, text: &str) -> Value {
        json!({ "update_id": 1, "message": { "message_id": 9, "from": { "id": user, "is_bot": false, "first_name": "Alex" }, "chat": { "id": user, "type": "private" }, "text": text } })
    }

    #[test]
    fn strangers_are_ignored_and_pairing_needs_the_open_code() {
        let t = tg();
        assert_eq!(t.handle(&msg(42, "ciao"), 1), Outcome::Ignore);
        assert_eq!(
            t.handle(&msg(42, "/start 123456"), 1),
            Outcome::Ignore,
            "no code open"
        );
        let code = t.pair_begin().code;
        let now = now_ms();
        let wrong = if code == "000000" { "111111" } else { "000000" };
        assert_eq!(
            t.handle(&msg(42, &format!("/start {wrong}")), now),
            Outcome::Refused { chat_id: 42 }
        );
        match t.handle(&msg(42, &format!("/start {code}")), now) {
            Outcome::Paired(u) => assert_eq!(
                (u.user_id, u.chat_id, u.role.as_str(), u.name.as_str()),
                (42, 42, "owner", "Alex")
            ),
            o => panic!("expected pairing, got {o:?}"),
        }
        // paired: messages reach the app; the code is spent
        assert!(matches!(
            t.handle(&msg(42, "ciao"), now),
            Outcome::Event(TgEvent::Message { .. })
        ));
        assert_eq!(
            t.handle(&msg(7, &format!("/start {code}")), now),
            Outcome::Ignore
        );
    }

    #[test]
    fn a_code_expires_and_closes_after_five_wrong_tries() {
        let t = tg();
        let code = t.pair_begin().code;
        assert_eq!(
            t.handle(
                &msg(1, &format!("/start {code}")),
                now_ms() + PAIR_TTL_MS + 1
            ),
            Outcome::Ignore
        );
        let code = t.pair_begin().code;
        let wrong = if code == "000000" { "111111" } else { "000000" };
        for _ in 0..PAIR_TRIES {
            assert_eq!(
                t.handle(&msg(1, &format!("/start {wrong}")), now_ms()),
                Outcome::Refused { chat_id: 1 }
            );
        }
        assert_eq!(
            t.handle(&msg(1, &format!("/start {code}")), now_ms()),
            Outcome::Ignore,
            "closed after the tries"
        );
    }

    #[test]
    fn groups_bots_and_empty_updates_are_ignored_callbacks_and_files_pass() {
        let t = tg();
        let code = t.pair_begin().code;
        assert!(matches!(
            t.handle(&msg(5, &format!("/start {code}")), now_ms()),
            Outcome::Paired(_)
        ));
        let group = json!({ "update_id": 2, "message": { "message_id": 1, "from": { "id": 5 }, "chat": { "id": -100, "type": "group" }, "text": "hi" } });
        assert_eq!(t.handle(&group, 1), Outcome::Ignore);
        let cb = json!({ "update_id": 3, "callback_query": { "id": "cb1", "from": { "id": 5 }, "data": "ok:1", "message": { "message_id": 77, "chat": { "id": 5, "type": "private" } } } });
        assert_eq!(
            t.handle(&cb, 1),
            Outcome::Event(TgEvent::Callback {
                id: "cb1".into(),
                chat_id: 5,
                user_id: 5,
                message_id: 77,
                data: "ok:1".into()
            })
        );
        let doc = json!({ "update_id": 4, "message": { "message_id": 2, "from": { "id": 5 }, "chat": { "id": 5, "type": "private" }, "caption": "leggi", "document": { "file_id": "AbC_1-2", "file_name": "brief.pdf", "mime_type": "application/pdf", "file_size": 1200 } } });
        match t.handle(&doc, 1) {
            Outcome::Event(TgEvent::Message {
                text,
                file: Some(f),
                ..
            }) => {
                assert_eq!(text.as_deref(), Some("leggi"));
                assert_eq!(
                    (f.kind.as_str(), f.name.as_deref(), f.size),
                    ("document", Some("brief.pdf"), Some(1200))
                );
            }
            o => panic!("got {o:?}"),
        }
    }

    #[test]
    fn buttons_and_texts_are_bounded() {
        assert!(keyboard(Some(vec![vec![TgButton {
            text: "ok".into(),
            data: "x".repeat(65)
        }]]))
        .is_err());
        assert!(keyboard(Some(vec![vec![TgButton {
            text: "ok".into(),
            data: "a:1".into()
        }]]))
        .unwrap()
        .is_some());
        assert_eq!(cut("abcdef", 4), "abc…");
        assert_eq!(safe_file_name("../\"x\".pdf"), "..x.pdf");
        let (b, body) = multipart(5, "r.md", b"hi", Some("cap"));
        let s = String::from_utf8(body).unwrap();
        assert!(s.contains(&format!(
            "--{b}\r\nContent-Disposition: form-data; name=\"chat_id\"\r\n\r\n5\r\n"
        )));
        assert!(s.contains("filename=\"r.md\"") && s.ends_with(&format!("--{b}--\r\n")));
    }

    #[test]
    fn only_listed_methods() {
        assert!(
            METHODS.contains(&"getUpdates")
                && !METHODS.contains(&"deleteWebhook")
                && !METHODS.contains(&"setWebhook")
        );
    }
}
