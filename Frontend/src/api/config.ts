// Re-export from centralized config for backward compatibility
import { buildUrl } from '../config/api';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:3000';
export { buildUrl };
