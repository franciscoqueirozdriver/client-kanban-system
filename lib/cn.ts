export type ClassValue =
  | string
  | number
  | null
  | boolean
  | undefined
  | ClassDictionary
  | ClassArray;

type ClassDictionary = Record<string, boolean | string | number | null | undefined>;
type ClassArray = ClassValue[];

function toArray(input: ClassValue): string[] {
  if (!input) return [];
  if (typeof input === 'string' || typeof input === 'number') {
    return [String(input)];
  }
  if (Array.isArray(input)) {
    return input.flatMap((item) => toArray(item));
  }
  if (typeof input === 'object') {
    return Object.entries(input)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key);
  }
  return [];
}

export function cn(...inputs: ClassValue[]): string {
  return inputs.flatMap((input) => toArray(input)).join(' ').trim();
}
