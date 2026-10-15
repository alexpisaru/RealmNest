//! Server-sent events, as OpenRouter streams them: `data: <json>` lines,
//! `: comment` keep-alives, blank lines between events, `data: [DONE]` at the end.
//! Bytes may arrive split anywhere, including inside a UTF-8 character.

#[derive(Debug, PartialEq, Eq)]
pub enum SseItem {
    /// the text after `data:` (one JSON document)
    Data(String),
    Done,
}

pub struct SseParser {
    buf: Vec<u8>,
    max_line: usize,
}

#[derive(Debug, PartialEq, Eq)]
pub struct LineTooLong;

impl SseParser {
    pub fn new(max_line: usize) -> Self {
        SseParser {
            buf: Vec::new(),
            max_line,
        }
    }

    /// Feed bytes; returns the complete items they finish.
    pub fn push(&mut self, bytes: &[u8]) -> Result<Vec<SseItem>, LineTooLong> {
        self.buf.extend_from_slice(bytes);
        let mut out = Vec::new();
        while let Some(i) = self.buf.iter().position(|b| *b == b'\n') {
            let mut line: Vec<u8> = self.buf.drain(..=i).collect();
            line.pop(); // \n
            if line.last() == Some(&b'\r') {
                line.pop();
            }
            if let Some(item) = parse_line(&line) {
                out.push(item);
            }
        }
        if self.buf.len() > self.max_line {
            return Err(LineTooLong);
        }
        Ok(out)
    }
}

fn parse_line(line: &[u8]) -> Option<SseItem> {
    let text = String::from_utf8_lossy(line);
    // comments (": OPENROUTER PROCESSING"), event:/id:/retry: fields and blank lines carry nothing for us
    let data = text.strip_prefix("data:")?;
    let data = data.strip_prefix(' ').unwrap_or(data);
    if data == "[DONE]" {
        Some(SseItem::Done)
    } else if data.is_empty() {
        None
    } else {
        Some(SseItem::Data(data.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_data_skips_comments_and_ends_on_done() {
        let mut p = SseParser::new(1024);
        let items = p
            .push(b": OPENROUTER PROCESSING\n\ndata: {\"a\":1}\r\n\r\ndata: [DONE]\n\n")
            .unwrap();
        assert_eq!(
            items,
            vec![SseItem::Data("{\"a\":1}".into()), SseItem::Done]
        );
    }

    #[test]
    fn handles_lines_and_characters_split_across_chunks() {
        let mut p = SseParser::new(1024);
        let full = "data: {\"t\":\"caffè\"}\n".as_bytes();
        let mut items = Vec::new();
        for chunk in full.chunks(3) {
            items.extend(p.push(chunk).unwrap());
        }
        assert_eq!(items, vec![SseItem::Data("{\"t\":\"caffè\"}".into())]);
    }

    #[test]
    fn refuses_an_endless_line() {
        let mut p = SseParser::new(16);
        assert_eq!(p.push(&[b'x'; 40]), Err(LineTooLong));
    }
}
