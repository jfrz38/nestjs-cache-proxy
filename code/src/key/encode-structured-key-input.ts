import { InvalidCacheKeyInputError } from './cache-key-validation-error.js';
import type { StructuredKeyInput } from './structured-key.types.js';

type TaggedKeyValue =
  | { readonly t: 'array'; readonly v: readonly TaggedKeyValue[] }
  | { readonly t: 'boolean'; readonly v: boolean }
  | { readonly t: 'null' }
  | { readonly t: 'number'; readonly v: string }
  | {
      readonly t: 'object';
      readonly v: readonly (readonly [string, TaggedKeyValue])[];
    }
  | { readonly t: 'string'; readonly v: string };

/** Uses property descriptors so validation never executes input accessors. */
export function encodeStructuredKeyInput(
  input: StructuredKeyInput,
): TaggedKeyValue {
  return visit(input, new Set<object>());
}

function visit(input: unknown, ancestors: Set<object>): TaggedKeyValue {
  if (input === null) {
    return { t: 'null' };
  }

  switch (typeof input) {
    case 'boolean':
      return { t: 'boolean', v: input };
    case 'number':
      if (!Number.isFinite(input)) {
        throw invalidInput('must be a finite number');
      }
      return { t: 'number', v: Object.is(input, -0) ? '-0' : String(input) };
    case 'string':
      return { t: 'string', v: input };
    case 'object':
      return visitObject(input, ancestors);
    default:
      throw invalidInput('has an unsupported value type');
  }
}

function visitObject(input: object, ancestors: Set<object>): TaggedKeyValue {
  if (ancestors.has(input)) {
    throw invalidInput('contains a cycle');
  }

  ancestors.add(input);
  try {
    return Array.isArray(input)
      ? visitArray(input, ancestors)
      : visitPlainObject(input, ancestors);
  } finally {
    ancestors.delete(input);
  }
}

function visitArray(
  input: readonly unknown[],
  ancestors: Set<object>,
): TaggedKeyValue {
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const values: TaggedKeyValue[] = [];

  for (let index = 0; index < input.length; index += 1) {
    const key = String(index);
    const descriptor = descriptors[key];

    if (descriptor === undefined) {
      throw invalidInput('must not be sparse');
    }

    if (!('value' in descriptor)) {
      throw invalidInput('must not be an accessor');
    }

    const value = descriptor.value as unknown;
    values.push(visit(value, ancestors));
  }

  for (const key of Reflect.ownKeys(descriptors)) {
    if (key !== 'length' && !isArrayIndex(key, input.length)) {
      throw invalidInput('must not have extra properties');
    }
  }

  return { t: 'array', v: values };
}

function visitPlainObject(
  input: object,
  ancestors: Set<object>,
): TaggedKeyValue {
  const prototype = Object.getPrototypeOf(input) as object | null;
  if (prototype !== Object.prototype && prototype !== null) {
    throw invalidInput('must be a plain object');
  }

  const descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== 'string')) {
    throw invalidInput('must not have symbol properties');
  }

  const stringKeys = keys as string[];
  const values: (readonly [string, TaggedKeyValue])[] = [];
  for (const key of stringKeys.sort(compareStringKeys)) {
    const descriptor = descriptors[key];
    if (descriptor === undefined || !descriptor.enumerable) {
      throw invalidInput('must be enumerable');
    }
    if (!('value' in descriptor)) {
      throw invalidInput('must not be an accessor');
    }

    values.push([key, visit(descriptor.value, ancestors)]);
  }

  return { t: 'object', v: values };
}

function isArrayIndex(key: PropertyKey, length: number): boolean {
  if (typeof key !== 'string' || !/^(0|[1-9]\d*)$/u.test(key)) {
    return false;
  }

  const index = Number(key);
  return Number.isSafeInteger(index) && index >= 0 && index < length;
}

function compareStringKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function invalidInput(reason: string): InvalidCacheKeyInputError {
  return new InvalidCacheKeyInputError(`Cache key input ${reason}.`);
}
