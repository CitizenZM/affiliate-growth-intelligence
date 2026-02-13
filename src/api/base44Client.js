import { createClient } from '@base44/sdk';
import { appParams, isBase44Configured } from '@/lib/app-params';
import { createLocalBase44Client } from '@/lib/localBase44Fallback';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

export const base44 = isBase44Configured
  ? createClient({
      appId,
      token,
      functionsVersion,
      serverUrl: '',
      requiresAuth: false,
      appBaseUrl
    })
  : createLocalBase44Client();
