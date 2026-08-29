import bizbuysell from './bizbuysell.mjs';
import bizquest from './bizquest.mjs';

export const providers = {
  bizbuysell,
  bizquest,
};

export function getProvider(id) {
  return providers[id] || null;
}

export function listProviders() {
  return Object.values(providers);
}

export default {
  providers,
  getProvider,
  listProviders,
};
