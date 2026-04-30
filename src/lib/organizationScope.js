let currentOrganizationId = null;
let currentOrganizationWritable = true;
let currentReadOnlyReason = null;
export const READ_ONLY_BLOCKED_EVENT = 'organization:read-only-blocked';

export const setCurrentOrganizationId = (organizationId) => {
  currentOrganizationId = organizationId || null;
};

export const getCurrentOrganizationId = () => currentOrganizationId;
export const isCurrentOrganizationWritable = () => currentOrganizationWritable;
export const getCurrentReadOnlyReason = () => currentReadOnlyReason;

export const setCurrentOrganizationAccess = ({ writable, reason } = {}) => {
  currentOrganizationWritable = Boolean(writable);
  currentReadOnlyReason = reason || null;
};

export const requireCurrentOrganizationId = () => {
  if (!currentOrganizationId) {
    throw new Error('organization_id não definido no escopo atual.');
  }
  return currentOrganizationId;
};

export const requireCurrentOrganizationWritable = () => {
  if (!currentOrganizationWritable) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(READ_ONLY_BLOCKED_EVENT, {
          detail: { reason: currentReadOnlyReason || null },
        })
      );
    }
    const suffix = currentReadOnlyReason ? ` (${currentReadOnlyReason})` : '';
    throw new Error(`Organização em modo somente leitura${suffix}.`);
  }
  return true;
};
