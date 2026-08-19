/**
 * Number and distance formatting utilities.
 */

export function formatDistanceMetres(metres: number, decimals: number = 1): string {
  return `${formatNumber(metres, decimals)} m`;
}

export function formatDistanceKilometres(metres: number, decimals: number = 4): string {
  return `${formatNumber(metres / 1000, decimals)} km`;
}

export function formatNumber(value: number, decimals: number = 1): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCoordinate(value: number): string {
  return value.toFixed(5);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function generateUid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
