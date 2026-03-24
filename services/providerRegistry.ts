import type { AICapability } from '../types';

const GLOBAL_KEY_STORAGE = 'global_api_key';

export const HARDCODED_MODELS = {
  text: 'gpt-5.2',
  image: 'gemini-3-pro-image-edit',
  textToImage: 'gemini-3-pro',
  video: 'kling-v2.6-pro-i2v',
} as const;

export function getGlobalApiKey(): string {
  return (localStorage.getItem(GLOBAL_KEY_STORAGE) || '').trim();
}

export function setGlobalApiKey(key: string): void {
  if (key.trim()) {
    localStorage.setItem(GLOBAL_KEY_STORAGE, key.trim());
  } else {
    localStorage.removeItem(GLOBAL_KEY_STORAGE);
  }
}

export function getApiKey(_providerId?: string): string {
  return getGlobalApiKey();
}

export function setCapabilityVerified(capability: AICapability, verified: boolean): void {
  if (verified) {
    localStorage.setItem(`verified_${capability}`, '1');
  } else {
    localStorage.removeItem(`verified_${capability}`);
  }
}

export function getCapabilityVerified(capability: AICapability): boolean {
  return localStorage.getItem(`verified_${capability}`) === '1' && !!getGlobalApiKey();
}
