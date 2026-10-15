//! OpenRouter embeddings (`POST /embeddings`, `GET /embeddings/models`).
//! The key stays here, as for chat. Inputs are checked (count, sizes, model
//! id), the answer is checked (one vector per input, one dimension for all),
//! and vectors go back to the page as float32 little-endian base64, with the
//! provider's own usage and cost when it reports them (never estimated).

use super::{http_error, network_message, read_limited, Client, Flavor, OrError};
use serde::{Deserialize, Serialize};
use std::time::Duration;

pub const MAX_INPUTS: usize = 128;
pub const MAX_INPUT_CHARS: usize = 32_000;
pub const MAX_TOTAL_CHARS: usize = 400_000;
const MAX_RESPONSE_BYTES: usize = 96 * 1024 * 1024;
const MAX_DIMENSIONS: usize = 8_192;

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddingModel {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_length: Option<u64>,
    /// USD per input token, as the catalogue says
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price_prompt: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Embedded {
    pub model: String,
    pub dimensions: usize,
    pub count: usize,
    /// count × dimensions float32, little-endian, base64
    pub vectors: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt_tokens: Option<u64>,
    /// what OpenRouter reported (credits = USD); absent when it did not say
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost: Option<f64>,
}

#[derive(Deserialize)]
struct RawModels {
    data: Vec<RawModel>,
}
#[derive(Deserialize)]
struct RawModel {
    id: String,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    context_length: Option<u64>,
    #[serde(default)]
    pricing: Option<RawPricing>,
}
#[derive(Deserialize)]
struct RawPricing {
    #[serde(default)]
    prompt: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct RawEmbeddings {
    data: Vec<RawVector>,
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    usage: Option<RawUsage>,
}
#[derive(Deserialize)]
struct RawVector {
    embedding: Vec<f32>,
    #[serde(default)]
    index: Option<usize>,
}
#[derive(Deserialize)]
struct RawUsage {
    #[serde(default)]
    prompt_tokens: Option<u64>,
    #[serde(default)]
    cost: Option<f64>,
}

pub fn is_embedding_model(v: &str) -> bool {
    !v.is_empty()
        && v.len() <= 120
        && v.bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'/' | b'-' | b'_' | b'.' | b':'))
}

/// The inputs a request may carry, or why not.
pub fn check_inputs(inputs: &[String]) -> Result<(), OrError> {
    if inputs.is_empty() || inputs.len() > MAX_INPUTS {
        return Err(OrError::new(
            "bad_request",
            format!("1 to {MAX_INPUTS} texts per request."),
            None,
        ));
    }
    let mut total = 0;
    for t in inputs {
        let n = t.chars().count();
        if n == 0 || n > MAX_INPUT_CHARS {
            return Err(OrError::new(
                "bad_request",
                format!("each text must have 1 to {MAX_INPUT_CHARS} characters."),
                None,
            ));
        }
        total += n;
    }
    if total > MAX_TOTAL_CHARS {
        return Err(OrError::new(
            "bad_request",
            "too much text in one request.",
            None,
        ));
    }
    Ok(())
}

/// The answer, checked: one vector per input in input order, one dimension for all.
pub fn parse_embeddings(body: &[u8], expected: usize) -> Result<Embedded, OrError> {
    parse_embeddings_from(Flavor::OpenRouter, body, expected)
}

/// [`parse_embeddings`] for any flavor (its name in the message).
pub fn parse_embeddings_from(
    flavor: Flavor,
    body: &[u8],
    expected: usize,
) -> Result<Embedded, OrError> {
    let raw: RawEmbeddings = serde_json::from_slice(body).map_err(|_| {
        OrError::new(
            "malformed",
            format!("{} sent embeddings RealmNest cannot read.", flavor.name()),
            None,
        )
    })?;
    if raw.data.len() != expected {
        return Err(OrError::new(
            "malformed",
            format!("expected {expected} vectors, got {}.", raw.data.len()),
            None,
        ));
    }
    let mut data = raw.data;
    if data.iter().all(|v| v.index.is_some()) {
        data.sort_by_key(|v| v.index.unwrap_or(0));
    }
    let dims = data.first().map(|v| v.embedding.len()).unwrap_or(0);
    if dims == 0 || dims > MAX_DIMENSIONS || data.iter().any(|v| v.embedding.len() != dims) {
        return Err(OrError::new(
            "malformed",
            "the vectors do not all have the same size.",
            None,
        ));
    }
    let mut bytes = Vec::with_capacity(expected * dims * 4);
    for v in &data {
        for x in &v.embedding {
            if !x.is_finite() {
                return Err(OrError::new(
                    "malformed",
                    "a vector holds a non-number.",
                    None,
                ));
            }
            bytes.extend_from_slice(&x.to_le_bytes());
        }
    }
    Ok(Embedded {
        model: raw.model.unwrap_or_default(),
        dimensions: dims,
        count: expected,
        vectors: crate::skills::b64_encode(&bytes),
        prompt_tokens: raw.usage.as_ref().and_then(|u| u.prompt_tokens),
        cost: raw.usage.as_ref().and_then(|u| u.cost),
    })
}

impl Client {
    /// The embedding models OpenRouter lists (public; no key needed).
    pub async fn embedding_models(&self) -> Result<Vec<EmbeddingModel>, OrError> {
        let resp = self
            .http
            .get(format!("{}/embeddings/models", self.base))
            .timeout(Duration::from_secs(30))
            .send()
            .await
            .map_err(|e| OrError::new("network", network_message(self.flavor, &e), None))?;
        let status = resp.status().as_u16();
        if status != 200 {
            return Err(OrError::new(
                "provider_unavailable",
                format!("OpenRouter answered {status} for the embedding models."),
                Some(status),
            ));
        }
        let body = read_limited(resp, 8 * 1024 * 1024)
            .await
            .map_err(|_| OrError::new("too_large", "The model list was too large.", None))?;
        let raw: RawModels = serde_json::from_slice(&body).map_err(|_| {
            OrError::new(
                "malformed",
                "OpenRouter sent a model list RealmNest cannot read.",
                None,
            )
        })?;
        Ok(raw
            .data
            .into_iter()
            .filter(|m| is_embedding_model(&m.id))
            .take(500)
            .map(|m| EmbeddingModel {
                name: m
                    .name
                    .unwrap_or_else(|| m.id.clone())
                    .chars()
                    .take(120)
                    .collect(),
                id: m.id,
                context_length: m.context_length,
                price_prompt: m.pricing.and_then(|p| p.prompt).map(|v| match v {
                    serde_json::Value::String(s) => s,
                    other => other.to_string(),
                }),
            })
            .collect())
    }

    /// Embed a batch of texts with a model.
    pub async fn embed(
        &self,
        key: Option<String>,
        model: &str,
        inputs: Vec<String>,
    ) -> Result<Embedded, OrError> {
        let flavor = self.flavor;
        if key.is_none() && flavor.needs_key() {
            return Err(OrError::new(
                "missing_key",
                "No API key is stored for this connection.",
                None,
            ));
        }
        if !is_embedding_model(model) {
            return Err(OrError::new("bad_request", "invalid model id.", None));
        }
        check_inputs(&inputs)?;
        let expected = inputs.len();
        let mut post = self
            .http
            .post(format!("{}{}", self.base, flavor.embed_path()));
        if let (true, Some(key)) = (flavor.needs_key(), key) {
            post = post.bearer_auth(key);
        }
        if flavor == Flavor::OpenRouter {
            post = post.header("X-Title", "RealmNest OS");
        }
        let resp = post
            .timeout(Duration::from_secs(90))
            .json(
                &serde_json::json!({ "model": model, "input": inputs, "encoding_format": "float" }),
            )
            .send()
            .await
            .map_err(|e| {
                OrError::new(
                    if e.is_timeout() { "timeout" } else { "network" },
                    network_message(flavor, &e),
                    None,
                )
            })?;
        let status = resp.status().as_u16();
        let body = read_limited(resp, MAX_RESPONSE_BYTES)
            .await
            .map_err(|_| OrError::new("too_large", "The embeddings were too large.", None))?;
        if status != 200 {
            return Err(http_error(flavor, status, &body));
        }
        parse_embeddings_from(flavor, &body, expected)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checks_inputs_and_answers() {
        assert!(check_inputs(&["a".into()]).is_ok());
        assert!(check_inputs(&[]).is_err());
        assert!(check_inputs(&["".into()]).is_err());
        assert!(check_inputs(&vec!["a".to_string(); MAX_INPUTS + 1]).is_err());
        assert!(check_inputs(&["x".repeat(MAX_INPUT_CHARS + 1)]).is_err());
        assert!(is_embedding_model("nvidia/nemotron-3-embed-1b:free"));
        assert!(!is_embedding_model("bad model"));

        let ok = br#"{"object":"list","data":[{"object":"embedding","embedding":[0.5,1.0],"index":1},{"object":"embedding","embedding":[1.0,0.0],"index":0}],"model":"m","usage":{"prompt_tokens":7,"total_tokens":7,"cost":0}}"#;
        let e = parse_embeddings(ok, 2).unwrap();
        assert_eq!(
            (e.dimensions, e.count, e.prompt_tokens, e.cost),
            (2, 2, Some(7), Some(0.0))
        );
        // index order restored: [1,0] first
        let bytes = crate::skills::b64_decode(&e.vectors).unwrap();
        assert_eq!(f32::from_le_bytes(bytes[0..4].try_into().unwrap()), 1.0);
        assert!(parse_embeddings(ok, 3).is_err());
        let ragged = br#"{"data":[{"embedding":[1.0,2.0]},{"embedding":[1.0]}]}"#;
        assert!(parse_embeddings(ragged, 2).is_err());
        assert!(parse_embeddings(b"not json", 1).is_err());
    }
}
