-- ============================================================
-- SCHEMA.SQL — Vanguarda Consultoria
-- Gerado em: 2026-03-20
-- Banco: PostgreSQL (compatível)
-- ============================================================

-- Extensão para UUID (opcional, IDs são strings aqui)
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- CONSULTORES
-- ────────────────────────────────────────────────────────────
CREATE TABLE consultant (
    id                VARCHAR(32)  PRIMARY KEY,
    created_date      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_date      TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by        VARCHAR(100),
    name              VARCHAR(255) NOT NULL,
    email             VARCHAR(255),
    phone             VARCHAR(50),
    specialty         VARCHAR(255),
    availability      VARCHAR(30),   -- full_time | part_time | project_based
    status            VARCHAR(20)  DEFAULT 'active',  -- active | inactive
    bio               TEXT,
    photo_url         TEXT,
    service_areas     JSONB        -- [{ area, subareas[] }]
);

-- ────────────────────────────────────────────────────────────
-- CLIENTES
-- ────────────────────────────────────────────────────────────
CREATE TABLE client (
    id                        VARCHAR(32)  PRIMARY KEY,
    created_date              TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_date              TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by                VARCHAR(100),
    company_name              VARCHAR(255) NOT NULL,
    document                  VARCHAR(30),   -- CNPJ
    phone                     VARCHAR(50),
    address                   TEXT,
    contact_person            VARCHAR(255),
    legal_rep_name            VARCHAR(255),
    legal_rep_address         TEXT,
    legal_rep_phone           VARCHAR(50),
    email                     VARCHAR(255),
    foco_code_company         VARCHAR(50),
    foco_code_rep             VARCHAR(50),
    status                    VARCHAR(20)  DEFAULT 'active',  -- active | inactive | prospect
    doc_cnpj_url              TEXT,
    doc_contrato_social_url   TEXT,
    doc_comprovante_endereco_url TEXT,
    doc_identidade_rep_url    TEXT
);

-- ────────────────────────────────────────────────────────────
-- PROJETOS / ATENDIMENTOS
-- ────────────────────────────────────────────────────────────
CREATE TABLE project (
    id                    VARCHAR(32)  PRIMARY KEY,
    created_date          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_date          TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by            VARCHAR(100),
    name                  VARCHAR(512),
    client_id             VARCHAR(32)  REFERENCES client(id),
    consultant_id         VARCHAR(32)  REFERENCES consultant(id),
    project_type          VARCHAR(30),  -- diagnostic | consulting | instructional | lecture | public_policies | other
    pricing_mode          VARCHAR(20)  DEFAULT 'fixed',  -- fixed | hourly
    area                  VARCHAR(100),
    subarea               VARCHAR(255),
    custom_area           VARCHAR(255),
    custom_subarea        VARCHAR(255),
    objective             TEXT,
    client_needs          TEXT,
    service_detail        TEXT,
    produto_final         TEXT,
    activities            JSONB,        -- [{ description, days, hours, modality, delivery }]
    activity_groups       JSONB,        -- { groupId: [{ activityIdx, hours }] }
    schedule_config       JSONB,        -- [{ date, activity, hours, modality, delivery, isDayOff, phase_value }]
    scope                 TEXT,
    contracted_value      NUMERIC(15,2),
    estimated_hours       NUMERIC(10,2),
    hourly_rate           NUMERIC(10,2),
    km_rodado             NUMERIC(10,2) DEFAULT 0,
    start_date            DATE,
    end_date              DATE,
    hours_per_day         NUMERIC(5,2)  DEFAULT 4,
    consider_sundays      VARCHAR(5)    DEFAULT 'no',
    consider_holidays     VARCHAR(5)    DEFAULT 'no',
    days_off              INTEGER       DEFAULT 0,
    days_off_position     VARCHAR(10)   DEFAULT 'end',  -- start | middle | end
    schedule_generated    BOOLEAN       DEFAULT FALSE,
    status                VARCHAR(20)   DEFAULT 'planning',  -- planning | in_progress | completed
    progress              NUMERIC(5,2)  DEFAULT 0,
    subsidy_percent       NUMERIC(5,2)  DEFAULT 70,
    payment_method        VARCHAR(30),
    sebrae_manager_name   VARCHAR(255),
    sebrae_manager_phone  VARCHAR(50),
    sebrae_regional_name  VARCHAR(255),
    sebrae_regional_phone VARCHAR(50),
    phases                JSONB,
    notes                 TEXT,
    proposal_file_url     TEXT,
    public_policies_data  JSONB
);

-- ────────────────────────────────────────────────────────────
-- AGENDA DO PROJETO (fases)
-- ────────────────────────────────────────────────────────────
CREATE TABLE project_schedule (
    id             VARCHAR(32)  PRIMARY KEY,
    created_date   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_date   TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by     VARCHAR(100),
    project_id     VARCHAR(32)  REFERENCES project(id),
    consultant_id  VARCHAR(32)  REFERENCES consultant(id),
    date           DATE         NOT NULL,
    start_time     VARCHAR(10),
    end_time       VARCHAR(10),
    hours          NUMERIC(5,2) DEFAULT 0,
    phase_value    NUMERIC(15,2),
    description    TEXT,
    status         VARCHAR(20)  DEFAULT 'scheduled',  -- scheduled | completed | cancelled
    approved       BOOLEAN      DEFAULT FALSE,
    location       VARCHAR(255)
);

-- ────────────────────────────────────────────────────────────
-- TAREFAS
-- ────────────────────────────────────────────────────────────
CREATE TABLE task (
    id              VARCHAR(32)  PRIMARY KEY,
    created_date    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_date    TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(100),
    title           VARCHAR(512) NOT NULL,
    project_id      VARCHAR(32)  REFERENCES project(id),
    assigned_to     VARCHAR(32)  REFERENCES consultant(id),
    description     TEXT,
    estimated_hours NUMERIC(10,2) DEFAULT 0,
    actual_hours    NUMERIC(10,2) DEFAULT 0,
    due_date        DATE,
    status          VARCHAR(20)  DEFAULT 'todo',  -- todo | in_progress | review | completed
    priority        VARCHAR(20)  DEFAULT 'medium',  -- low | medium | high | urgent
    is_deliverable  BOOLEAN      DEFAULT FALSE,
    deliverable_url TEXT,
    completion_date DATE
);

-- ────────────────────────────────────────────────────────────
-- DOCUMENTOS
-- ────────────────────────────────────────────────────────────
CREATE TABLE document (
    id                VARCHAR(32)  PRIMARY KEY,
    created_date      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_date      TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by        VARCHAR(100),
    name              VARCHAR(512) NOT NULL,
    project_id        VARCHAR(32)  REFERENCES project(id),
    file_url          TEXT         NOT NULL,
    type              VARCHAR(30)  DEFAULT 'other',  -- contract | report | presentation | spreadsheet | other
    uploaded_by       VARCHAR(100),
    description       TEXT,
    visible_to_client BOOLEAN      DEFAULT TRUE
);

-- ────────────────────────────────────────────────────────────
-- APONTAMENTO DE HORAS
-- ────────────────────────────────────────────────────────────
CREATE TABLE time_entry (
    id             VARCHAR(32)  PRIMARY KEY,
    created_date   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_date   TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by     VARCHAR(100),
    project_id     VARCHAR(32)  REFERENCES project(id),
    consultant_id  VARCHAR(32)  REFERENCES consultant(id),
    date           DATE         NOT NULL,
    hours          NUMERIC(5,2) NOT NULL,
    description    TEXT,
    billable       BOOLEAN      DEFAULT TRUE
);

-- ────────────────────────────────────────────────────────────
-- DESPESAS
-- ────────────────────────────────────────────────────────────
CREATE TABLE expense (
    id                 VARCHAR(32)  PRIMARY KEY,
    created_date       TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_date       TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by         VARCHAR(100),
    project_id         VARCHAR(32)  REFERENCES project(id),
    chart_account_id   VARCHAR(32),
    category           VARCHAR(30),  -- travel | materials | tools | administrative | meals | software | other
    description        TEXT,
    amount             NUMERIC(15,2) NOT NULL,
    due_date           DATE,
    payment_date       DATE,
    payment_account_id VARCHAR(32),
    receipt_url        TEXT,
    consultant_id      VARCHAR(32)  REFERENCES consultant(id),
    reimbursable       BOOLEAN      DEFAULT FALSE,
    status             VARCHAR(20)  DEFAULT 'to_pay'  -- to_pay | paid
);

-- ────────────────────────────────────────────────────────────
-- MENSAGENS
-- ────────────────────────────────────────────────────────────
CREATE TABLE message (
    id           VARCHAR(32)  PRIMARY KEY,
    created_date TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_date TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by   VARCHAR(100),
    project_id   VARCHAR(32)  REFERENCES project(id),
    sender_type  VARCHAR(20),  -- consultant | client | admin
    sender_name  VARCHAR(255),
    content      TEXT         NOT NULL,
    read         BOOLEAN      DEFAULT FALSE
);

-- ────────────────────────────────────────────────────────────
-- CONTAS A RECEBER DO PROJETO
-- ────────────────────────────────────────────────────────────
CREATE TABLE project_receivable (
    id             VARCHAR(32)  PRIMARY KEY,
    created_date   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_date   TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by     VARCHAR(100),
    project_id     VARCHAR(32)  REFERENCES project(id),
    description    TEXT         NOT NULL,
    due_date       DATE         NOT NULL,
    amount         NUMERIC(15,2) NOT NULL,
    status         VARCHAR(20)  DEFAULT 'open',  -- open | received | overdue
    received_at    DATE,
    payment_method VARCHAR(30)  -- pix | transfer | boleto | check | credit_card | debit_card | other
);

-- ────────────────────────────────────────────────────────────
-- CONTAS A PAGAR DO PROJETO
-- ────────────────────────────────────────────────────────────
CREATE TABLE project_payable (
    id             VARCHAR(32)  PRIMARY KEY,
    created_date   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_date   TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by     VARCHAR(100),
    project_id     VARCHAR(32)  REFERENCES project(id),
    consultant_id  VARCHAR(32)  REFERENCES consultant(id),
    description    TEXT         NOT NULL,
    due_date       DATE         NOT NULL,
    amount         NUMERIC(15,2) NOT NULL,
    status         VARCHAR(20)  DEFAULT 'open',  -- open | paid | overdue
    paid_at        DATE,
    category       VARCHAR(30)  -- travel | tools | commission | tax | supplier | consultant_fee | other
);

-- ────────────────────────────────────────────────────────────
-- RELATÓRIO DE SERVIÇO
-- ────────────────────────────────────────────────────────────
CREATE TABLE service_report (
    id               VARCHAR(32)  PRIMARY KEY,
    created_date     TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_date     TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by       VARCHAR(100),
    project_id       VARCHAR(32)  REFERENCES project(id),
    report_types     JSONB,       -- ["presencial", "final", ...]
    solutions        TEXT,
    results          TEXT,
    results_images   JSONB,       -- [url, ...]
    consultant_notes TEXT
);

-- ────────────────────────────────────────────────────────────
-- MODELOS DE SERVIÇO
-- ────────────────────────────────────────────────────────────
CREATE TABLE service_model (
    id              VARCHAR(32)  PRIMARY KEY,
    created_date    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_date    TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(100),
    name            VARCHAR(255) NOT NULL,
    type            VARCHAR(30),  -- diagnostic | implementation | training | consulting_package | mentoring | audit
    description     TEXT,
    base_price      NUMERIC(15,2),
    hourly_rate     NUMERIC(10,2),
    estimated_hours NUMERIC(10,2),
    deliverables    JSONB,        -- [{ name, estimated_hours }]
    document_url    TEXT,
    document_name   VARCHAR(255),
    status          VARCHAR(20)  DEFAULT 'active'
);

-- ────────────────────────────────────────────────────────────
-- CONFIGURAÇÃO DE ÁREAS DE ATUAÇÃO
-- ────────────────────────────────────────────────────────────
CREATE TABLE service_area_config (
    id               VARCHAR(32)  PRIMARY KEY,
    created_date     TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_date     TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by       VARCHAR(100),
    area_key         VARCHAR(100) NOT NULL,
    active_subareas  JSONB        -- ["4.1", "4.2", ...]
);

-- ────────────────────────────────────────────────────────────
-- CONTAS FINANCEIRAS
-- ────────────────────────────────────────────────────────────
CREATE TABLE financial_account (
    id              VARCHAR(32)  PRIMARY KEY,
    created_date    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_date    TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by      VARCHAR(100),
    name            VARCHAR(255) NOT NULL,
    type            VARCHAR(20),  -- checking | savings | cash | other
    bank            VARCHAR(100),
    initial_balance NUMERIC(15,2) DEFAULT 0,
    current_balance NUMERIC(15,2) DEFAULT 0,
    active          BOOLEAN       DEFAULT TRUE
);

-- ────────────────────────────────────────────────────────────
-- TRANSAÇÕES DE CONTA
-- ────────────────────────────────────────────────────────────
CREATE TABLE account_transaction (
    id             VARCHAR(32)  PRIMARY KEY,
    created_date   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_date   TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by     VARCHAR(100),
    account_id     VARCHAR(32)  REFERENCES financial_account(id),
    type           VARCHAR(10)  NOT NULL,  -- credit | debit
    amount         NUMERIC(15,2) NOT NULL,
    description    TEXT,
    date           DATE         NOT NULL,
    reference_type VARCHAR(20),  -- receivable | payable | manual
    reference_id   VARCHAR(32),
    project_id     VARCHAR(32)  REFERENCES project(id)
);

-- ────────────────────────────────────────────────────────────
-- PLANO DE CONTAS
-- ────────────────────────────────────────────────────────────
CREATE TABLE chart_of_accounts (
    id           VARCHAR(32)  PRIMARY KEY,
    created_date TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_date TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by   VARCHAR(100),
    code         VARCHAR(20)  NOT NULL,
    name         VARCHAR(255) NOT NULL,
    type         VARCHAR(20)  NOT NULL,  -- revenue | expense | asset | liability
    category     VARCHAR(100),
    active       BOOLEAN      DEFAULT TRUE,
    is_default   BOOLEAN      DEFAULT FALSE
);

-- ────────────────────────────────────────────────────────────
-- ALÍQUOTAS DE IMPOSTO
-- ────────────────────────────────────────────────────────────
CREATE TABLE tax_rate (
    id           VARCHAR(32)  PRIMARY KEY,
    created_date TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_date TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by   VARCHAR(100),
    month        VARCHAR(7)   NOT NULL,  -- YYYY-MM
    rate_percent NUMERIC(8,4) NOT NULL,
    notes        TEXT
);

-- ────────────────────────────────────────────────────────────
-- FATURAMENTO (BillingEntry)
-- ────────────────────────────────────────────────────────────
CREATE TABLE billing_entry (
    id             VARCHAR(32)  PRIMARY KEY,
    created_date   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_date   TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by     VARCHAR(100),
    project_id     VARCHAR(32)  REFERENCES project(id),
    phase_id       VARCHAR(32)  REFERENCES project_schedule(id),
    amount         NUMERIC(15,2) NOT NULL,
    hours          NUMERIC(10,2),
    status         VARCHAR(20)  DEFAULT 'to_bill',  -- to_bill | billed | received
    billed_date    DATE,
    due_date       DATE,
    received_date  DATE,
    account_id     VARCHAR(32)  REFERENCES financial_account(id),
    payment_method VARCHAR(30),
    description    TEXT,
    phase_date     DATE
);

-- ────────────────────────────────────────────────────────────
-- LANÇAMENTO DE IMPOSTO
-- ────────────────────────────────────────────────────────────
CREATE TABLE tax_expense_entry (
    id                 VARCHAR(32)  PRIMARY KEY,
    created_date       TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_date       TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by         VARCHAR(100),
    billing_entry_id   VARCHAR(32)  REFERENCES billing_entry(id),
    chart_account_code VARCHAR(20),
    reference_month    VARCHAR(7),
    billed_date        DATE,
    revenue_amount     NUMERIC(15,2),
    tax_rate_percent   NUMERIC(8,4),
    tax_amount         NUMERIC(15,2) NOT NULL,
    description        TEXT,
    project_id         VARCHAR(32)  REFERENCES project(id)
);

-- ────────────────────────────────────────────────────────────
-- ÍNDICES ÚTEIS
-- ────────────────────────────────────────────────────────────
CREATE INDEX idx_project_consultant   ON project(consultant_id);
CREATE INDEX idx_project_client       ON project(client_id);
CREATE INDEX idx_project_status       ON project(status);
CREATE INDEX idx_schedule_project     ON project_schedule(project_id);
CREATE INDEX idx_schedule_date        ON project_schedule(date);
CREATE INDEX idx_billing_project      ON billing_entry(project_id);
CREATE INDEX idx_billing_status       ON billing_entry(status);
CREATE INDEX idx_expense_project      ON expense(project_id);
CREATE INDEX idx_transaction_account  ON account_transaction(account_id);
CREATE INDEX idx_tax_entry_project    ON tax_expense_entry(project_id);

-- ────────────────────────────────────────────────────────────
-- MULTI-TENANT (addendum)
-- ────────────────────────────────────────────────────────────
CREATE TABLE organizations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    slug          TEXT NOT NULL UNIQUE,
    custom_domain TEXT UNIQUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles             ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.consultant           ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.client               ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.project              ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.project_schedule     ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.task                 ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.document             ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.time_entry           ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.expense              ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.message              ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.project_receivable   ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.project_payable      ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.service_report       ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.service_model        ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.service_area_config  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.financial_account    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.account_transaction  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.chart_of_accounts    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.tax_rate             ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.billing_entry        ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.tax_expense_entry    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

CREATE TABLE IF NOT EXISTS organization_settings (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    primary_color   TEXT,
    secondary_color TEXT,
    logo_url        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);