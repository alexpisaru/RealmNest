// Validates a tool's input against its JSON Schema. Native tools use a small
// subset; MCP servers send full JSON Schema, so the keywords that matter for
// safety are checked (type and type unions, null, properties, required,
// additionalProperties, enum, const, ranges, lengths, items, anyOf / oneOf /
// allOf) and the rest (format, default, $schema…) is passed through untouched.
// Strict on purpose: unknown properties are refused unless a schema allows
// them, so a model cannot smuggle arguments a tool does not declare.
// Bounded: depth and the number of subschemas are capped, so a hostile schema
// cannot make validation expensive.

import type { JsonSchema, JsonType } from '../../domain/tool';

const MAX_DEPTH = 12;
/** subschemas in one tool's input schema */
export const MAX_SUBSCHEMAS = 2_000;
const TYPES: JsonType[] = ['object', 'string', 'number', 'integer', 'boolean', 'array', 'null'];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function typeOf(value: unknown): JsonType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  if (typeof value === 'object') return 'object';
  return typeof value as JsonType;
}

const matchesType = (t: JsonType, value: unknown) => {
  const actual = typeOf(value);
  if (actual === t) return true;
  return t === 'number' && actual === 'integer';
};

const listTypes = (t: JsonType | JsonType[] | undefined): JsonType[] | undefined => (t === undefined ? undefined : Array.isArray(t) ? t : [t]);

const describe = (types: JsonType[]) => types.map((t) => (t === 'integer' ? 'a whole number' : t === 'null' ? 'null' : t === 'array' ? 'a list' : t === 'boolean' ? 'true or false' : t === 'object' ? 'an object' : `a ${t}`)).join(' or ');

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** the first problem found, as a short sentence for the model; undefined when valid */
export function validateInput(schema: JsonSchema, value: unknown, path = 'input', depth = 0): string | undefined {
  if (depth > MAX_DEPTH) return `${path} is nested too deeply`;
  if (!isObject(schema)) return undefined; // `true`-like schema: anything goes

  const types = listTypes(schema.type);
  if (types && !types.some((t) => matchesType(t, value))) return `${path} must be ${describe(types)}`;
  if (schema.const !== undefined && !same(schema.const, value)) return `${path} must be ${JSON.stringify(schema.const)}`;
  if (Array.isArray(schema.enum) && !schema.enum.some((e) => same(e, value))) return `${path} must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}`;

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) return `${path} must have at least ${schema.minLength} characters`;
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) return `${path} must have at most ${schema.maxLength} characters`;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return `${path} must be a finite number`;
    if (typeof schema.minimum === 'number' && value < schema.minimum) return `${path} must be at least ${schema.minimum}`;
    if (typeof schema.maximum === 'number' && value > schema.maximum) return `${path} must be at most ${schema.maximum}`;
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) return `${path} must have at least ${schema.minItems} items`;
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) return `${path} must have at most ${schema.maxItems} items`;
    if (isObject(schema.items))
      for (let i = 0; i < value.length; i++) {
        const problem = validateInput(schema.items, value[i], `${path}[${i}]`, depth + 1);
        if (problem) return problem;
      }
  }
  if (isObject(value)) {
    for (const key of Array.isArray(schema.required) ? schema.required : []) if (value[key] === undefined) return `${path}.${key} is required`;
    const props = isObject(schema.properties) ? (schema.properties as Record<string, JsonSchema>) : undefined;
    for (const [key, v] of Object.entries(value)) {
      const sub = props?.[key];
      if (sub) {
        const problem = validateInput(sub, v, `${path}.${key}`, depth + 1);
        if (problem) return problem;
        continue;
      }
      if (schema.additionalProperties === false || (schema.additionalProperties === undefined && props && schema.type !== undefined && !hasComposition(schema) && isStrict(schema)))
        return `${path}.${key} is not a known parameter`;
      if (isObject(schema.additionalProperties)) {
        const problem = validateInput(schema.additionalProperties as JsonSchema, v, `${path}.${key}`, depth + 1);
        if (problem) return problem;
      }
    }
  }

  if (Array.isArray(schema.allOf))
    for (const s of schema.allOf) {
      const problem = validateInput(s, value, path, depth + 1);
      if (problem) return problem;
    }
  const alternatives = Array.isArray(schema.anyOf) ? schema.anyOf : Array.isArray(schema.oneOf) ? schema.oneOf : undefined;
  if (alternatives?.length) {
    const problems = alternatives.map((s) => validateInput(s, value, path, depth + 1));
    // oneOf is checked like anyOf: exclusivity is the server's business, not a safety check
    if (problems.every(Boolean)) return problems[0];
  }
  return undefined;
}

const hasComposition = (s: JsonSchema) => !!(s.anyOf || s.oneOf || s.allOf);
/**
 * Native tool schemas (no `$schema`) are strict by default: properties not
 * listed are refused even without `additionalProperties: false`. A schema
 * that declares a JSON Schema dialect follows the standard (allowed unless
 * it says otherwise).
 */
const isStrict = (s: JsonSchema) => s.$schema === undefined && s['x-realmnest-open'] !== true && s['x-nestra-open'] !== true;

/** a schema is well-formed enough to give a provider (registry check); undefined when fine */
export function checkSchema(schema: JsonSchema): string | undefined {
  if (!isObject(schema)) return 'the input schema must be an object';
  const root = listTypes(schema.type);
  if (!root || root.length !== 1 || root[0] !== 'object') return 'a tool input must be an object';
  let count = 0;
  const walk = (s: unknown, depth: number): string | undefined => {
    if (typeof s === 'boolean') return undefined;
    if (!isObject(s)) return 'a subschema is not an object';
    if (++count > MAX_SUBSCHEMAS) return `the schema has more than ${MAX_SUBSCHEMAS} parts`;
    if (depth > MAX_DEPTH) return 'schema is nested too deeply';
    const types = listTypes(s.type as JsonType | JsonType[] | undefined);
    if (types?.some((t) => !TYPES.includes(t))) return `unknown type ${JSON.stringify(s.type)}`;
    const props = s.properties;
    if (props !== undefined) {
      if (!isObject(props)) return 'properties must be an object';
      for (const [k, sub] of Object.entries(props)) {
        if (!/^[A-Za-z_$][A-Za-z0-9_.$-]{0,127}$/.test(k)) return `bad property name ${k}`;
        const p = walk(sub, depth + 1);
        if (p) return p;
      }
    }
    if (s.required !== undefined) {
      if (!Array.isArray(s.required) || s.required.some((r) => typeof r !== 'string')) return 'required must be a list of names';
      // a required name must exist when the object is closed
      if (s.additionalProperties === false || (s.$schema === undefined && depth === 0 && !hasComposition(s as JsonSchema)))
        for (const r of s.required as string[]) if (!isObject(props) || !(r in props)) return `required ${r} is not a property`;
    }
    for (const key of ['items', 'additionalProperties', 'not'] as const) {
      const sub = s[key];
      if (isObject(sub)) {
        const p = walk(sub, depth + 1);
        if (p) return p;
      }
    }
    for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
      const list = s[key];
      if (list === undefined) continue;
      if (!Array.isArray(list)) return `${key} must be a list`;
      for (const sub of list) {
        const p = walk(sub, depth + 1);
        if (p) return p;
      }
    }
    for (const key of ['$defs', 'definitions'] as const) {
      const defs = s[key];
      if (isObject(defs))
        for (const sub of Object.values(defs)) {
          const p = walk(sub, depth + 1);
          if (p) return p;
        }
    }
    // a $ref that leaves the document is never fetched (MCP spec): refuse it
    if (typeof s.$ref === 'string' && !s.$ref.startsWith('#')) return `external $ref ${s.$ref} is not allowed`;
    return undefined;
  };
  return walk(schema, 0);
}
