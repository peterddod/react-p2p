import { hash as hashIt } from 'hash-it';
import { type Delta, diff as jsonDiff, patch as jsonPatch } from 'jsondiffpatch';

function diff<T extends object = object>(a: T, b: T): Delta {
  return jsonDiff(a, b);
}

function patch<T extends object = object>(a: T, b: Delta): T {
  return jsonPatch(a, b) as T;
}

function hash<T=unknown>(a: T): number {
  return hashIt(a);
}

export { diff, patch, hash };
