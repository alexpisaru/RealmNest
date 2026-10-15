//! The OpenRouter model catalogue (`GET /models`), reduced to what RealmNest uses.
//! Everything comes from the live catalogue; nothing is guessed from names.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelDescriptor {
    /// raw id used in requests, e.g. "anthropic/claude-…"
    pub id: String,
    pub label: String,
    /// the part before "/", e.g. "anthropic"
    pub provider_label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_length: Option<u64>,
    pub input_modalities: Vec<String>,
    pub output_modalities: Vec<String>,
    pub supported_parameters: Vec<String>,
    /// USD per token, as strings exactly as OpenRouter gives them ("-1" = variable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pricing: Option<Pricing>,
    /// present when OpenRouter marks the model as a reasoning model
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<ReasoningInfo>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ReasoningInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mandatory: Option<bool>,
    pub efforts: Vec<String>,
}

#[derive(Deserialize)]
struct RawReasoning {
    mandatory: Option<bool>,
    supported_efforts: Option<Vec<String>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Pricing {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completion: Option<String>,
}

#[derive(Deserialize)]
struct Catalog {
    data: Vec<RawModel>,
}

#[derive(Deserialize)]
struct RawModel {
    id: String,
    name: Option<String>,
    context_length: Option<u64>,
    architecture: Option<Architecture>,
    pricing: Option<Pricing>,
    supported_parameters: Option<Vec<String>>,
    reasoning: Option<RawReasoning>,
}

#[derive(Deserialize)]
struct Architecture {
    input_modalities: Option<Vec<String>>,
    output_modalities: Option<Vec<String>>,
}

const MAX_MODELS: usize = 5_000;

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "._:/~-".contains(c))
}

/// Parse and normalize the catalogue; entries with unusable ids are dropped.
pub fn normalize(body: &[u8]) -> Result<Vec<ModelDescriptor>, String> {
    let catalog: Catalog = serde_json::from_slice(body)
        .map_err(|_| "OpenRouter sent a model list RealmNest could not read".to_string())?;
    let mut out: Vec<ModelDescriptor> = catalog
        .data
        .into_iter()
        .filter(|m| valid_id(&m.id))
        .take(MAX_MODELS)
        .map(|m| {
            let arch = m.architecture;
            ModelDescriptor {
                provider_label: m.id.split('/').next().unwrap_or("").to_string(),
                label: m
                    .name
                    .filter(|n| !n.trim().is_empty())
                    .unwrap_or_else(|| m.id.clone()),
                context_length: m.context_length,
                input_modalities: arch
                    .as_ref()
                    .and_then(|a| a.input_modalities.clone())
                    .unwrap_or_default(),
                output_modalities: arch.and_then(|a| a.output_modalities).unwrap_or_default(),
                supported_parameters: m.supported_parameters.unwrap_or_default(),
                reasoning: m.reasoning.map(|r| ReasoningInfo {
                    mandatory: r.mandatory,
                    efforts: r.supported_efforts.unwrap_or_default(),
                }),
                pricing: m.pricing.map(|p| Pricing {
                    prompt: p.prompt,
                    completion: p.completion,
                }),
                id: m.id,
            }
        })
        .collect();
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

pub fn is_model_id(id: &str) -> bool {
    valid_id(id)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = include_str!("../../../src/tests/fixtures/openrouter/models.sample.json");

    #[test]
    fn normalizes_the_real_catalogue_shape() {
        let models = normalize(SAMPLE.as_bytes()).unwrap();
        assert_eq!(models.len(), 4);
        let auto = models.iter().find(|m| m.id == "openrouter/auto").unwrap();
        assert_eq!(auto.label, "Auto Router");
        assert_eq!(auto.provider_label, "openrouter");
        let image = models
            .iter()
            .find(|m| m.output_modalities.contains(&"image".to_string()))
            .unwrap();
        assert!(image.output_modalities.contains(&"text".to_string()));
        let tools = models
            .iter()
            .find(|m| m.id == "stepfun/step-5-preview")
            .unwrap();
        assert!(tools.supported_parameters.contains(&"tools".to_string()));
        assert_eq!(tools.context_length, Some(1_000_000));
        assert!(tools.pricing.as_ref().unwrap().prompt.is_some());
        // the reasoning object is kept when OpenRouter sends one
        let reasoning: Vec<_> = models.iter().filter(|m| m.reasoning.is_some()).collect();
        let raw: serde_json::Value = serde_json::from_str(SAMPLE).unwrap();
        let raw_count = raw["data"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|m| m["reasoning"].is_object())
            .count();
        assert_eq!(reasoning.len(), raw_count);
    }

    #[test]
    fn drops_odd_ids_and_rejects_garbage() {
        let body = br#"{"data":[{"id":"ok/model"},{"id":"bad id with spaces"},{"id":""}]}"#;
        let models = normalize(body).unwrap();
        assert_eq!(
            models.iter().map(|m| m.id.as_str()).collect::<Vec<_>>(),
            vec!["ok/model"]
        );
        assert_eq!(models[0].label, "ok/model");
        assert!(normalize(b"<html>").is_err());
    }
}
