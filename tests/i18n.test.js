import { describe, it, expect } from 'vitest';
import en from '../i18n/en.json';
import ru from '../i18n/ru.json';
import ko from '../i18n/ko.json';

describe('translations', () => {
  it('keeps the same keys in every language', () => {
    const keys = Object.keys(en).sort();
    expect(Object.keys(ru).sort()).toEqual(keys);
    expect(Object.keys(ko).sort()).toEqual(keys);
  });
});
