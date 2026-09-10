import { CacheKeyVersion } from '../key/cache-key-version.js';
import { TimeToLive } from './time-to-live.js';

const resourceFields = new Set(['key', 'method', 'ttl', 'version']);
const cacheRuleFields = new Set(['cache']);
const mutationRuleFields = new Set(['effects']);
const invalidateFields = new Set(['invalidate']);
const writeThroughFields = new Set(['writeThrough']);
const invalidateDefinitionFields = new Set(['keyArgs', 'resource']);
const writeThroughDefinitionFields = new Set(['keyArgs', 'resource', 'value']);

/** Raised when a cache policy cannot be interpreted safely. */
export class InvalidCachePolicyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidCachePolicyError';
  }
}

/**
 * Validates only structure available at policy-definition time. Provider method shapes are
 * erased at runtime and are instead constrained by TypeScript and later registration.
 */
export function validateCachePolicy(policy: unknown): void {
  if (!isRecord(policy)) {
    throw invalid('Policy must be an object.');
  }

  const { methods, resources } = policy;

  if (!isRecord(resources)) {
    throw invalid('Policy resources must be an object.');
  }

  if (!isRecord(methods)) {
    throw invalid('Policy methods must be an object.');
  }

  for (const [name, resource] of Object.entries(resources)) {
    validateResource(name, resource);
  }

  for (const [method, rule] of Object.entries(methods)) {
    validateMethodRule(method, rule, resources);
  }
}

function validateResource(name: string, resource: unknown): void {
  if (name.trim().length === 0) {
    throw invalid('Resource names must not be empty.');
  }

  if (!isRecord(resource) || !hasOnlyFields(resource, resourceFields)) {
    throw invalid(`Resource "${name}" has an unsupported definition.`);
  }

  if (
    typeof resource.method !== 'string' ||
    resource.method.trim().length === 0
  ) {
    throw invalid(`Resource "${name}" must declare a method name.`);
  }

  try {
    TimeToLive.fromMilliseconds(resource.ttl);
  } catch {
    throw invalid(
      `Resource "${name}" must declare a positive integer TTL in milliseconds.`,
    );
  }

  try {
    CacheKeyVersion.from(resource.version);
  } catch {
    throw invalid(
      `Resource "${name}" must declare a positive integer version.`,
    );
  }

  if (typeof resource.key !== 'function') {
    throw invalid(`Resource "${name}" must declare a key builder.`);
  }
}

function validateMethodRule(
  method: string,
  rule: unknown,
  resources: Record<string, unknown>,
): void {
  if (method.trim().length === 0) {
    throw invalid('Method names must not be empty.');
  }

  if (!isRecord(rule)) {
    throw invalid(`Method "${method}" must declare one rule.`);
  }

  const hasCache = Object.hasOwn(rule, 'cache');
  const hasEffects = Object.hasOwn(rule, 'effects');

  if (hasCache === hasEffects) {
    throw invalid(`Method "${method}" must declare either cache or effects.`);
  }

  if (hasCache) {
    if (
      !hasOnlyFields(rule, cacheRuleFields) ||
      !isKnownResource(rule.cache, resources)
    ) {
      throw invalid(
        `Method "${method}" references an unknown or invalid resource.`,
      );
    }

    return;
  }

  if (
    !hasOnlyFields(rule, mutationRuleFields) ||
    !Array.isArray(rule.effects)
  ) {
    throw invalid(`Method "${method}" must declare an effects array.`);
  }

  if (rule.effects.length === 0) {
    throw invalid(`Method "${method}" must declare at least one effect.`);
  }

  for (const effect of rule.effects) {
    validateEffect(method, effect, resources);
  }
}

function validateEffect(
  method: string,
  effect: unknown,
  resources: Record<string, unknown>,
): void {
  if (!isRecord(effect)) {
    throw invalid(`Method "${method}" has an invalid cache effect.`);
  }

  const hasInvalidate = Object.hasOwn(effect, 'invalidate');
  const hasWriteThrough = Object.hasOwn(effect, 'writeThrough');

  if (hasInvalidate === hasWriteThrough) {
    throw invalid(
      `Method "${method}" effects must declare invalidate or writeThrough.`,
    );
  }

  const definition = hasInvalidate ? effect.invalidate : effect.writeThrough;
  const fields = hasInvalidate ? invalidateFields : writeThroughFields;
  const definitionFields = hasInvalidate
    ? invalidateDefinitionFields
    : writeThroughDefinitionFields;

  if (
    !hasOnlyFields(effect, fields) ||
    !isRecord(definition) ||
    !hasOnlyFields(definition, definitionFields) ||
    !isKnownResource(definition.resource, resources) ||
    typeof definition.keyArgs !== 'function' ||
    (hasWriteThrough && typeof definition.value !== 'function')
  ) {
    throw invalid(`Method "${method}" has an invalid cache effect.`);
  }
}

function isKnownResource(
  value: unknown,
  resources: Record<string, unknown>,
): value is string {
  return typeof value === 'string' && Object.hasOwn(resources, value);
}

function hasOnlyFields(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((field) => allowed.has(field));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(message: string): InvalidCachePolicyError {
  return new InvalidCachePolicyError(message);
}
