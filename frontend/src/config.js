/**
 * Frontend configuration.
 *
 * Set NEXT_PUBLIC_API_BASE_URL at build time when the backend is ready.
 * See frontend/README.md for the full integration checklist.
 */
const configuredApiUrl = (
    process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL
)?.replace(/\/$/, '');
const configuredApiHost = process.env.NEXT_PUBLIC_API_HOST?.trim();

export const API_BASE_URL = configuredApiUrl ||
    (configuredApiHost ? `https://${configuredApiHost}` : 'http://localhost:8001');
export const USE_MOCK_DATA = false;
