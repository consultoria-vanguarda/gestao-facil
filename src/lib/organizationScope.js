let currentOrganizationId = null;

export const setCurrentOrganizationId = (organizationId) => {
  currentOrganizationId = organizationId || null;
};

export const getCurrentOrganizationId = () => currentOrganizationId;

export const requireCurrentOrganizationId = () => {
  if (!currentOrganizationId) {
    throw new Error('organization_id não definido no escopo atual.');
  }
  return currentOrganizationId;
};
