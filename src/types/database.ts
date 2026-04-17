export interface TenantScopedRow {
  id: string;
  organization_id: string;
}

export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  user_type: 'admin' | 'consultant' | 'client' | 'saas_admin';
  consultant_id: string | null;
  client_id: string | null;
  organization_id: string;
}

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
}

export interface OrganizationSettingsRow {
  organization_id: string;
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
}

export interface ViabilityCostConfigRow extends TenantScopedRow {
  created_date: string;
  updated_date: string;
  created_by: string | null;
  valor_hora_consultor: number;
  custo_hospedagem_diaria: number;
  custo_alimentacao_diaria: number;
  custo_por_km: number;
  cep_origem: string;
  limite_km_bate_volta: number;
}
