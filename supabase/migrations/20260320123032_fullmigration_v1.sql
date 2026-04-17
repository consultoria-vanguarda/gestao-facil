-- ============================================================
-- FULLMIGRATION.SQL — Vanguarda Consultoria
-- Gerado em: 2026-03-20
-- Todos os dados existentes em produção
-- ============================================================

-- Desabilita checagem de FK durante a carga
SET session_replication_role = replica;

-- Compatibilidade com schema multi-tenant:
-- se organization_id já for NOT NULL, relaxa temporariamente para permitir a carga histórica
-- e preenchimento em lote ao final (tenant padrão: vanguarda).
DO $$
DECLARE
  has_org_column BOOLEAN;
  tenant_table TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consultant'
      AND column_name = 'organization_id'
  ) INTO has_org_column;

  IF NOT has_org_column THEN
    RETURN;
  END IF;

  INSERT INTO public.organizations (name, slug, custom_domain)
  VALUES ('Vanguarda', 'vanguarda', NULL)
  ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name;

  FOREACH tenant_table IN ARRAY ARRAY[
    'consultant',
    'client',
    'project',
    'project_schedule',
    'task',
    'document',
    'time_entry',
    'expense',
    'message',
    'project_receivable',
    'project_payable',
    'service_report',
    'service_model',
    'service_area_config',
    'financial_account',
    'account_transaction',
    'chart_of_accounts',
    'tax_rate',
    'billing_entry',
    'tax_expense_entry',
    'profiles'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tenant_table
        AND column_name = 'organization_id'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN organization_id DROP NOT NULL',
        tenant_table
      );
    END IF;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────
-- CONSULTORES
-- ────────────────────────────────────────────────────────────
INSERT INTO consultant (id, created_date, updated_date, created_by, name, email, phone, specialty, availability, status, bio, service_areas) VALUES
('69a43bfcb7507f639d4d8785','2026-03-01 13:15:40','2026-03-01 13:15:40','juarezsilveirajunior@gmail.com','Juarez Terra Hochmuller Silveira','juarezvanguarda@gmail.com','(61) 99627-0797','Administração de Empresas','full_time','active','','[{"area":"financas","subareas":["Gestão Econômico/Financeira"]},{"area":"politicas_publicas","subareas":["Desenvolvimento Local e Políticas Públicas"]},{"area":"marketing","subareas":["Vendas"]},{"area":"planejamento","subareas":["Gestão de Processos Empresariais","Planejamento Estratégico"]}]'),
('69a43ca9c895bb353a45c58b','2026-03-01 13:18:33','2026-03-01 13:18:33','juarezsilveirajunior@gmail.com','JOSÉ LUIZ DE PAULA FREITAS','Joseluiz.freitaspl@gmail.com','(61) 99135-2415','ADMINISTRAÇÃO DE EMPREGO','project_based','active','','[{"area":"financas","subareas":["Gestão Econômico/Financeira"]},{"area":"marketing","subareas":["Vendas"]}]'),
('69a43e2ebe33941168c3074a','2026-03-01 13:25:02','2026-03-01 13:25:02','juarezsilveirajunior@gmail.com','TAISSA CRISTINA SOARES DE OLIVIERA','taissacristina2018@gmail.com','(61) 99658-2954','Administração de Empresas','project_based','active','','[{"area":"financas","subareas":["Gestão Econômico/Financeira"]}]'),
('69a43ed656ed2065a6dddc1a','2026-03-01 13:27:50','2026-03-02 18:45:17','juarezsilveirajunior@gmail.com','Jairo Mendonça Júnior','jairo.jurisforte@gmail.com','(62) 99611-8853','ADMINISTRAÇÃO DE EMPRESA','project_based','active','','[{"area":"politicas_publicas","subareas":["Desenvolvimento Local e Políticas Públicas"]},{"area":"financas","subareas":["Gestão Econômico/Financeira"]},{"area":"marketing","subareas":["Vendas"]},{"area":"planejamento","subareas":["Planejamento Estratégico","Gestão de Processos Empresariais"]},{"area":"associativismo","subareas":["Organização, Constituição e Funcionamento"]}]'),
('699d1da3daf1458660a769af','2026-02-24 03:40:19','2026-02-24 03:40:19','juarezsilveirajunior@gmail.com','ANA CLAUDIA CARVALHO GUIMARÃES','anaguimaraesm@gmail.com','','Gestão','project_based','active','','[{"area":"planejamento","subareas":["Gestão de Processos Empresariais"]}]'),
('699d1ded63be7f6e7872aa95','2026-02-24 03:41:33','2026-03-06 03:16:44','juarezsilveirajunior@gmail.com','Armando Bruno Oliveira Osmarini','armandobruno@gmail.com','','Gestão','project_based','active','','[{"area":"financas","subareas":["Gestão Econômico/Financeira"]},{"area":"planejamento","subareas":["Planejamento Estratégico","Gestão de Processos Empresariais"]}]'),
('699efdccd924003135fe6e06','2026-02-25 13:49:00','2026-02-25 13:49:00','juarezsilveirajunior@gmail.com','Liliane Franca Nogueira','lilianenogueiraadm@gmail.com','(61) 98146-8153','Gestão Pública','project_based','active','','[{"area":"planejamento","subareas":["Gestão de Processos Empresariais"]}]');

-- ────────────────────────────────────────────────────────────
-- CLIENTES
-- ────────────────────────────────────────────────────────────
INSERT INTO client (id, created_date, updated_date, created_by, company_name, document, phone, address, contact_person, legal_rep_name, legal_rep_address, legal_rep_phone, email, foco_code_company, foco_code_rep, status) VALUES
('69a4475781c7fae9d4a6ad15','2026-03-01 14:04:07','2026-03-01 14:04:07','juarezsilveirajunior@gmail.com','ACERT CONSTRUCOES E SERVICOS LTDA','17.236.888/0001-34','(61) 98408-9391','QNA 07 CJTO F LOTE 14 APT 401 TAGUATINGA NORTE - BRASILIA - DF CEP: 72.120-060','ANDERSON RIBEIRO DE CARVALHO','ANDERSON RIBEIRO DE CARVALHO','QNA 07 CJTO F LOTE 14 APT 401 TAGUATINGA NORTE - BRASILIA - DF CEP: 72.120-060','(61) 98408-9391','rib.andersonrc@gmail.com','228671226','228671273','active'),
('69a4594412cc14fc164b9e2b','2026-03-01 15:20:36','2026-03-01 15:20:36','juarezsilveirajunior@gmail.com','KARI VASS HOSPEDAGEM E EVENTOS LTDA','60.255.217/0001-74','(48) 99181-4884','R DO SEGREDO, ESTRADA LOQUINHAS, CHALÉ 2 – ZONA RURAL – ALTO PARAISO DE GOIÁS – GO – CEP: 73700-000','KARINE','KARINE VASCONCELOS FERRO','R DO SEGREDO, ESTRADA LOQUINHAS, CHALÉ 2 – ZONA RURAL – ALTO PARAISO DE GOIÁS – GO – CEP: 73700-000','(48) 99181-4884','brasil@ashiyana.com','447589791','301803410','active'),
('69a47cbeeceb2fa9b2d45147','2026-03-01 17:51:58','2026-03-01 17:51:58','juarezsilveirajunior@gmail.com','FRETE ON TRANSPORTES LTDA','42.285.328/0001-41','(61) 99316-1972','AV. TANCREDO NEVES, QUADRA A, Nº 650 - SETOR BOSQUE - FORMOSA - GO - CEP: 73802-005','ANDERSON DE SOUZA SILVA','ANDERSON DE SOUZA SILVA','AV. TANCREDO NEVES, QUADRA A, Nº 650 - SETOR BOSQUE - FORMOSA - GO - CEP: 73802-005','(61) 99316-1972','Anderson81051@gmail.com','396557349','171142338','active'),
('69a4a5fae3847286665a01ed','2026-03-01 20:47:54','2026-03-01 20:47:54','juarezsilveirajunior@gmail.com','5R ENERGIAS RENOVÁVEIS LTDA','48.772.860/0001-70','(71) 99260-4345','Rua Ana Rodrigues de Souza, Quadra 09 Lote 26ª, Guarani – Posse – GO – CEP: 73906-114','Érika Moreira Dias Estrela','Érika Moreira Dias Estrela','Rua Ana Rodrigues de Souza, Quadra 09 Lote 26ª, Guarani – Posse – GO – CEP: 73906-114','(71) 99260-4345','erikamoreira1994@gmail.com','419385636','323889349','active'),
('69a5bb8176bcc70092401375','2026-03-02 16:32:01','2026-03-02 16:32:01','juarezsilveirajunior@gmail.com','UNE ENERGIA LTDA','62.991.447/0001-27','(61)99602-4033','Rua Visconde de Porto Seguro, N°: 472 – Centro – Formosa – GO – CEP: 73801-010.','Jorge Miguel Affiune','Jorge Miguel Affiune','Rua Visconde de Porto Seguro, N°: 472 – Centro – Formosa – GO – CEP: 73801-010.','(61)99602-4033','jorgemiguelaffiune@hotmail.com',' 451633079','434793889 ','active'),
('69a5d47b9652f02e09270205','2026-03-02 18:18:35','2026-03-09 18:14:53','juarezsilveirajunior@gmail.com','PREFEITURA MUNICIPAL DE PLANALTINA GO','01.740.422/0001-66','6136370000','Praça Cívica, Setor Oeste, CEP 73752-970','CRISTIOMÁRIO','CRISTIOMÁRIO','Praça Cívica, Setor Oeste, CEP 73752-970','6136370000','gabinete.prefeito@planaltina.go.gov.br','31857869','','active'),
('69a9b630b6d8cc1d67783c37','2026-03-05 16:58:24','2026-03-09 18:24:12','juarezsilveirajunior@gmail.com','BIOPHARMACIA FARMACIA DE MANIPULACAO LTDA','15.709.911/0001-60','(61) 998025991','AV LAGOA FEIA Nº441 BAIRRO FORMOSINHA CEP 73.813-370 FORMOSA-GO','JULIANA DA SILVA LEÃO','JULIANA DA SILVA LEÃO','AV LAGOA FEIA Nº441 BAIRRO FORMOSINHA CEP 73.813-370 FORMOSA-GO','(61) 998025991','juliana_farmacia2013@hotmail.com','17797005','17924249','active'),
('69a9c266b818d08064cabf08','2026-03-05 17:50:30','2026-03-09 18:19:48','juarezsilveirajunior@gmail.com','LATOX TOXICOLOGIA DIAGNOSTICA MEDICINA E PSICOLOGIA DO TRANSITO LTDA','42.903.648/0001-18','(61) 99804-7771','AV BRASILIA nº999 SALA C BAIRRO FORMOSINHA CEP 73.813-010 FORMOSA-GO','FERNANDA PERES DA SILVA','FERNANDA PERES DA SILVA','AV BRASILIA nº999 SALA C BAIRRO FORMOSINHA CEP 73.813-010 FORMOSA-GO','(61) 99804-7771','fernandaeducarperes@outolook.com','396781911','17713959','active'),
('69aa4584cfa27276413c09d0','2026-03-06 03:09:56','2026-03-06 03:09:56','metaconsultorias@hotmail.com','LS SERVICOS EM SAUDE E SEGURANCA DO TRABALHO LTDA','31.380.096/0001-94','61998390095','R HERCULANO LOBO Nº 64 BAIRRO CENTRO CEP 73801-260 FORMOSA-GO','DÉBORA PINTO DE MELO','DÉBORA PINTO DE MELO','R HERCULANO LOBO Nº 64 BAIRRO CENTRO CEP 73801-260 FORMOSA-GO','61998390095','medcilifefsa@gmail.com','396470402','16966149','active'),
('69ab8ce5b2d980ae93c96582','2026-03-07 02:26:45','2026-03-09 18:18:09','juarezsilveirajunior@gmail.com','LUIZ HUMBERTO GONCALVES GOMES','21.101.690/0001-45','61983851404','RUA VISCONDE DE PORTO SEGURO N 1060 CENTRO CEP 73801-010 FORMOSA-GO','LUIZ HUMBERTO GONCALVES GOMES','LUIZ HUMBERTO GONCALVES GOMES','RUA VISCONDE DE PORTO SEGURO N 1060 CENTRO CEP 73801-010 FORMOSA-GO','61983851404','mistercervejaria@gmail.com','171075798','171075817','active');

-- Clientes adicionais referenciados em projetos (IDs encontrados em project.client_id)
INSERT INTO client (id, created_date, updated_date, created_by, company_name, document, phone, address, contact_person, legal_rep_name, legal_rep_address, legal_rep_phone, email, foco_code_company, foco_code_rep, status) VALUES
('699eff5dc105cd08926fef04','2026-02-25 00:00:00','2026-02-25 00:00:00','juarezsilveirajunior@gmail.com','JULIANA RIBEIRO SOCIEDADE INDIVIDUAL DE ADVOCACIA','','','','','','','','','','','active')
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- PLANO DE CONTAS
-- ────────────────────────────────────────────────────────────
INSERT INTO chart_of_accounts (id, created_date, updated_date, created_by, code, name, type, category, active, is_default) VALUES
('69a36581ed24ac1a5a3b2c0c','2026-02-28 22:00:33','2026-02-28 22:00:33','juarezsilveirajunior@gmail.com','1.1','Receita de Consultoria','revenue','Receitas Operacionais',TRUE,TRUE),
('69a36581ed24ac1a5a3b2c0d','2026-02-28 22:00:33','2026-02-28 22:00:33','juarezsilveirajunior@gmail.com','1.2','Receita de Diagnóstico','revenue','Receitas Operacionais',TRUE,TRUE),
('69a36581ed24ac1a5a3b2c0e','2026-02-28 22:00:33','2026-02-28 22:00:33','juarezsilveirajunior@gmail.com','1.3','Receita de Instrutoria','revenue','Receitas Operacionais',TRUE,TRUE),
('69a36581ed24ac1a5a3b2c11','2026-02-28 22:00:33','2026-02-28 22:00:33','juarezsilveirajunior@gmail.com','2.2','Deslocamento / KM Rodado','expense','Custos Operacionais',TRUE,TRUE),
('69a36581ed24ac1a5a3b2c13','2026-02-28 22:00:33','2026-02-28 22:00:33','juarezsilveirajunior@gmail.com','3.1','Impostos','expense','Despesas Administrativas',TRUE,TRUE),
('69a36581ed24ac1a5a3b2c14','2026-02-28 22:00:33','2026-02-28 22:00:33','juarezsilveirajunior@gmail.com','3.2','Aluguel e Ocupação','expense','Despesas Administrativas',TRUE,TRUE),
('69a36581ed24ac1a5a3b2c15','2026-02-28 22:00:33','2026-02-28 22:00:33','juarezsilveirajunior@gmail.com','3.3','Serviços de Terceiros','expense','Despesas Administrativas',TRUE,TRUE),
('69a36581ed24ac1a5a3b2c16','2026-02-28 22:00:33','2026-02-28 22:00:33','juarezsilveirajunior@gmail.com','3.4','Tecnologia e Software','expense','Despesas Administrativas',TRUE,TRUE),
('69a36581ed24ac1a5a3b2c17','2026-02-28 22:00:33','2026-02-28 22:00:33','juarezsilveirajunior@gmail.com','3.5','Comunicação e Marketing','expense','Despesas Administrativas',TRUE,TRUE),
('69a36581ed24ac1a5a3b2c18','2026-02-28 22:00:33','2026-02-28 22:00:33','juarezsilveirajunior@gmail.com','3.6','Capacitação e Treinamento','expense','Despesas Administrativas',TRUE,TRUE),
('69a36581ed24ac1a5a3b2c19','2026-02-28 22:00:33','2026-02-28 22:00:33','juarezsilveirajunior@gmail.com','3.7','Alimentação e Refeições','expense','Despesas Administrativas',TRUE,TRUE),
('69a36581ed24ac1a5a3b2c1a','2026-02-28 22:00:33','2026-02-28 22:00:33','juarezsilveirajunior@gmail.com','3.8','Despesas Bancárias','expense','Despesas Administrativas',TRUE,TRUE),
('69a44225bf0f86a5de6f4f4a','2026-03-01 13:41:57','2026-03-01 13:41:57','juarezsilveirajunior@gmail.com','2.5','Salario de colaboradores','expense','Custos Operacionais',TRUE,FALSE),
('69a441eddc5a74c27b20a8ec','2026-03-01 13:41:01','2026-03-01 13:41:01','juarezsilveirajunior@gmail.com','2.4','Honorário da Contabilidade','expense','Custos Operacionais',TRUE,FALSE),
('69a4424f010653738cb324e0','2026-03-01 13:42:39','2026-03-01 13:42:39','juarezsilveirajunior@gmail.com','3.1.1','FGTS','expense','Despesas Administrativas',TRUE,FALSE),
('69a4426ad945529249094b83','2026-03-01 13:43:06','2026-03-01 13:43:06','juarezsilveirajunior@gmail.com','3.1.2','SIMPLES NACIONAL','expense','Despesas Administrativas',TRUE,FALSE),
('69a46624d77081d6bf429fbb','2026-03-01 16:15:32','2026-03-01 16:15:32','juarezsilveirajunior@gmail.com','2.6','Desconto','expense','Custos Operacionais',TRUE,FALSE),
('69a46654f9c4ecf49495be7f','2026-03-01 16:16:20','2026-03-01 16:16:20','juarezsilveirajunior@gmail.com','1.5','Receita Extra (ajuste de caixa)','revenue','Receitas Operacionais',TRUE,FALSE),
('69a8e6d09e6465e6d63d1282','2026-03-05 02:13:36','2026-03-05 02:13:36','juarezsilveirajunior@gmail.com','3.8.1','DESPESAS BANCÁRIAS CONTA VANGUARDA','expense','Despesas Administrativas',TRUE,FALSE);

-- ────────────────────────────────────────────────────────────
-- ALÍQUOTAS DE IMPOSTO
-- ────────────────────────────────────────────────────────────
INSERT INTO tax_rate (id, created_date, updated_date, created_by, month, rate_percent, notes) VALUES
('69a369d68c2bc91ae3a43c81','2026-02-28 22:19:02','2026-02-28 22:19:02','juarezsilveirajunior@gmail.com','2026-02',9.05,'Simples Nacional'),
('69a8cec4d2ee0d0d09bead17','2026-03-05 00:31:00','2026-03-05 00:31:00','juarezsilveirajunior@gmail.com','2026-03',9.02,'Simples Nacional'),
('69a8e6933f42bc51c28646ae','2026-03-05 02:12:35','2026-03-05 02:12:35','juarezsilveirajunior@gmail.com','2026-03',3.00,'DESPESAS BANCARIAS CONTA VANGUARDA');

-- ────────────────────────────────────────────────────────────
-- CONFIGURAÇÃO DE ÁREAS
-- ────────────────────────────────────────────────────────────
INSERT INTO service_area_config (id, created_date, updated_date, created_by, area_key, active_subareas) VALUES
('699d1cc3f29749943697ade2','2026-02-24 03:36:35','2026-02-28 23:05:16','juarezsilveirajunior@gmail.com','financas','["4.1"]'),
('699d1cdcdb42e039e7c49e13','2026-02-24 03:37:00','2026-02-24 03:37:00','juarezsilveirajunior@gmail.com','associativismo','["14.1"]'),
('699d1cf11241bbd44e6b123d','2026-02-24 03:37:21','2026-02-24 03:37:21','juarezsilveirajunior@gmail.com','politicas_publicas','["16.2"]'),
('699d1d06caee79861f5bb9a3','2026-02-24 03:37:42','2026-02-24 03:37:42','juarezsilveirajunior@gmail.com','marketing','["5.4"]'),
('699d1d2d9030e3ac7f1c1cae','2026-02-24 03:38:21','2026-02-24 03:38:24','juarezsilveirajunior@gmail.com','planejamento','["7.3","7.2"]');

-- ────────────────────────────────────────────────────────────
-- CONTAS FINANCEIRAS
-- ────────────────────────────────────────────────────────────
INSERT INTO financial_account (id, created_date, updated_date, created_by, name, type, bank, initial_balance, current_balance, active) VALUES
('69a439cff4b0b0096ecfce1c','2026-03-01 13:06:23','2026-03-01 17:12:11','juarezsilveirajunior@gmail.com','CONTA VANGUARDA_1','checking','QI SOCIEDADE DE CRÉDITO DIRETO',0.00,29890.00,TRUE),
('69a8c5bb13aca9553e13342b','2026-03-04 23:52:27','2026-03-07 02:23:01','juarezsilveirajunior@gmail.com','CONTA JUAREZ','checking','VAANGUARDA',0.00,-2473.00,TRUE),
('69aa24b6f6ec8eab65e9c98a','2026-03-06 00:49:58','2026-03-07 02:22:40','juarezsilveirajunior@gmail.com','CONTA FÁBIO','checking','VANGUARDA',0.00,-1088.00,TRUE);

-- ────────────────────────────────────────────────────────────
-- DESPESAS
-- ────────────────────────────────────────────────────────────
INSERT INTO expense (id, created_date, updated_date, created_by, project_id, chart_account_id, description, amount, due_date, payment_date, payment_account_id, reimbursable, status) VALUES
('69a43a648921fb5b494fa926','2026-03-01 13:08:04','2026-03-07 02:22:40','juarezsilveirajunior@gmail.com',NULL,'69a36581ed24ac1a5a3b2c16','ASSINATURA BASE 44 PAGA POR FABIO VIA CARTÃO DE CREDITO',551.00,'2026-02-20',NULL,NULL,TRUE,'paid'),
('69a43a93f05dc06ab1618ee3','2026-03-01 13:08:51','2026-03-07 02:22:35','juarezsilveirajunior@gmail.com',NULL,'69a36581ed24ac1a5a3b2c16','ASSINATURA BASE 44 PAGA POR FABIO EM 20/02',268.50,'2026-02-20',NULL,NULL,TRUE,'paid'),
('69a43ac966bb0e5ef3e4f255','2026-03-01 13:10:33','2026-03-07 02:22:29','juarezsilveirajunior@gmail.com',NULL,'69a36581ed24ac1a5a3b2c16','ASSINATURA BASE 44 PARA ITALLO PAGA POR FABIO EM 24/02/2026',268.50,'2026-02-24','2026-03-06','69aa24b6f6ec8eab65e9c98a',TRUE,'paid'),
('69a8c83b7b0cf4059d625b37','2026-03-05 00:03:07','2026-03-07 02:23:00','juarezsilveirajunior@gmail.com','69a45c4bcf69030091a0e8cd','69a36581ed24ac1a5a3b2c11','DESPESA DE DESLOCAMENTO E DE ALIMENTAÇÃO PARA ATENDIMENTO EM ALTO PARAISO E POSSE',852.00,'2026-03-09','2026-03-06','69a8c5bb13aca9553e13342b',TRUE,'paid'),
('69a8cdba01a5a24dbae606c0','2026-03-05 00:26:34','2026-03-05 00:26:34','juarezsilveirajunior@gmail.com',NULL,'69a441eddc5a74c27b20a8ec','(1/9)',500.00,'2026-03-10',NULL,NULL,FALSE,'to_pay'),
('69a8cdbbcd2cec4bae7a8184','2026-03-05 00:26:35','2026-03-05 00:26:35','juarezsilveirajunior@gmail.com',NULL,'69a441eddc5a74c27b20a8ec','(2/9)',500.00,'2026-04-10',NULL,NULL,FALSE,'to_pay'),
('69a8cdbb928f06fcaca735a1','2026-03-05 00:26:35','2026-03-05 00:26:35','juarezsilveirajunior@gmail.com',NULL,'69a441eddc5a74c27b20a8ec','(3/9)',500.00,'2026-05-10',NULL,NULL,FALSE,'to_pay'),
('69a8cdbc40728aa80ae91e63','2026-03-05 00:26:36','2026-03-05 00:26:36','juarezsilveirajunior@gmail.com',NULL,'69a441eddc5a74c27b20a8ec','(4/9)',500.00,'2026-06-10',NULL,NULL,FALSE,'to_pay'),
('69a8cdbc60b7daab69fd01f3','2026-03-05 00:26:36','2026-03-05 00:26:36','juarezsilveirajunior@gmail.com',NULL,'69a441eddc5a74c27b20a8ec','(5/9)',500.00,'2026-07-10',NULL,NULL,FALSE,'to_pay'),
('69a8cdbcc5ad4faf549cc446','2026-03-05 00:26:36','2026-03-05 00:26:36','juarezsilveirajunior@gmail.com',NULL,'69a441eddc5a74c27b20a8ec','(6/9)',500.00,'2026-08-10',NULL,NULL,FALSE,'to_pay'),
('69a8cdbd5c3facd57787ec73','2026-03-05 00:26:37','2026-03-05 00:26:37','juarezsilveirajunior@gmail.com',NULL,'69a441eddc5a74c27b20a8ec','(7/9)',500.00,'2026-09-10',NULL,NULL,FALSE,'to_pay'),
('69a8cdbd5e2aecf0b0e740ce','2026-03-05 00:26:37','2026-03-05 00:26:37','juarezsilveirajunior@gmail.com',NULL,'69a441eddc5a74c27b20a8ec','(8/9)',500.00,'2026-10-10',NULL,NULL,FALSE,'to_pay'),
('69a8cdbdde46d6956203589c','2026-03-05 00:26:37','2026-03-05 00:26:37','juarezsilveirajunior@gmail.com',NULL,'69a441eddc5a74c27b20a8ec','(9/9)',500.00,'2026-11-10',NULL,NULL,FALSE,'to_pay'),
('69a8df44bc3f245b14109893','2026-03-05 01:41:24','2026-03-07 02:21:41','juarezsilveirajunior@gmail.com',NULL,'69a44225bf0f86a5de6f4f4a','(1/3)',1621.00,'2026-03-06','2026-03-06','69a8c5bb13aca9553e13342b',FALSE,'paid'),
('69a8df44ede11078a573b426','2026-03-05 01:41:24','2026-03-05 01:41:24','juarezsilveirajunior@gmail.com',NULL,'69a44225bf0f86a5de6f4f4a','(2/3)',1621.00,'2026-04-06',NULL,NULL,FALSE,'to_pay'),
('69a8df44f63aeadad737ac0e','2026-03-05 01:41:24','2026-03-05 01:41:24','juarezsilveirajunior@gmail.com',NULL,'69a44225bf0f86a5de6f4f4a','(3/3)',1621.00,'2026-05-06',NULL,NULL,FALSE,'to_pay');

-- ────────────────────────────────────────────────────────────
-- TRANSAÇÕES DE CONTA
-- ────────────────────────────────────────────────────────────
INSERT INTO account_transaction (id, created_date, updated_date, created_by, account_id, type, amount, description, date, reference_type, reference_id, project_id) VALUES
('69a4736a3b67a96b574aa622','2026-03-01 17:12:10','2026-03-01 17:12:10','juarezsilveirajunior@gmail.com','69a439cff4b0b0096ecfce1c','debit',29890.01,'ajuste de caixa sistema','2026-03-01','manual',NULL,NULL),
('69a470b2e54f93d33ff566c6','2026-03-01 17:00:34','2026-03-01 17:00:34','juarezsilveirajunior@gmail.com','69a439cff4b0b0096ecfce1c','credit',1340.34,'Fase 12/02/2026 — KARI VASS HOSPEDAGEM E EVENTOS LTDA','2026-02-13','receivable','69a45d0ca32a2218e81caf61','69a45c4bcf69030091a0e8cd'),
('69a470b314ae038f32b4a20f','2026-03-01 17:00:35','2026-03-01 17:00:35','juarezsilveirajunior@gmail.com','69a439cff4b0b0096ecfce1c','credit',1340.34,'Fase 10/02/2026 — KARI VASS HOSPEDAGEM E EVENTOS LTDA','2026-02-13','receivable','69a45d08eb7e9ed8632f184a','69a45c4bcf69030091a0e8cd'),
('69a470b3f7f3f518775c6f2e','2026-03-01 17:00:35','2026-03-01 17:00:35','juarezsilveirajunior@gmail.com','69a439cff4b0b0096ecfce1c','credit',1340.34,'Fase 09/02/2026 — KARI VASS HOSPEDAGEM E EVENTOS LTDA','2026-02-13','receivable','69a45d07daef9fc1b888ec2f','69a45c4bcf69030091a0e8cd'),
('69a470b44cf1bd9d2d6dd5ed','2026-03-01 17:00:36','2026-03-01 17:00:36','juarezsilveirajunior@gmail.com','69a439cff4b0b0096ecfce1c','credit',1340.34,'Fase 07/02/2026 — KARI VASS HOSPEDAGEM E EVENTOS LTDA','2026-02-13','receivable','69a45d059ebe4bdcffd941f6','69a45c4bcf69030091a0e8cd'),
('69a470b256b95c94da542d6a','2026-03-01 17:00:34','2026-03-01 17:00:34','juarezsilveirajunior@gmail.com','69a439cff4b0b0096ecfce1c','credit',1340.34,'Fase 11/02/2026 — KARI VASS HOSPEDAGEM E EVENTOS LTDA','2026-02-13','receivable','69a45d0a558bb7800906305f','69a45c4bcf69030091a0e8cd'),
('69a470b6c05508ac90a24be4','2026-03-01 17:00:38','2026-03-01 17:00:38','juarezsilveirajunior@gmail.com','69a439cff4b0b0096ecfce1c','credit',1340.34,'Fase 06/02/2026 — KARI VASS HOSPEDAGEM E EVENTOS LTDA','2026-02-13','receivable','69a45d0463f6d01bb3d4ca41','69a45c4bcf69030091a0e8cd'),
('69a470b6cad1fcc1fc7880b2','2026-03-01 17:00:38','2026-03-01 17:00:38','juarezsilveirajunior@gmail.com','69a439cff4b0b0096ecfce1c','credit',1340.34,'Fase 05/02/2026 — KARI VASS HOSPEDAGEM E EVENTOS LTDA','2026-02-13','receivable','69a45d0120bd5728557a4d8f','69a45c4bcf69030091a0e8cd'),
('69a470b7fcfef119a55f032b','2026-03-01 17:00:39','2026-03-01 17:00:39','juarezsilveirajunior@gmail.com','69a439cff4b0b0096ecfce1c','credit',1340.34,'Fase 04/02/2026 — KARI VASS HOSPEDAGEM E EVENTOS LTDA','2026-02-13','receivable','69a45d009552e2785f7556dd','69a45c4bcf69030091a0e8cd'),
('69ab8be51a25cf0c9f52f02a','2026-03-07 02:22:29','2026-03-07 02:22:29','juarezsilveirajunior@gmail.com','69aa24b6f6ec8eab65e9c98a','debit',268.50,'ASSINATURA BASE 44 PARA ITALLO PAGA POR FABIO EM 24/02/2026','2026-03-06','payable','69a43ac966bb0e5ef3e4f255',NULL),
('69ab8bebae65ab52aaf82b1f','2026-03-07 02:22:35','2026-03-07 02:22:35','juarezsilveirajunior@gmail.com','69aa24b6f6ec8eab65e9c98a','debit',268.50,'ASSINATURA BASE 44 PAGA POR FABIO EM 20/02','2026-03-06','payable','69a43a93f05dc06ab1618ee3',NULL),
('69ab8bf0678162cb43d48e92','2026-03-07 02:22:40','2026-03-07 02:22:40','juarezsilveirajunior@gmail.com','69aa24b6f6ec8eab65e9c98a','debit',551.00,'ASSINATURA BASE 44 PAGA POR FABIO VIA CARTÃO DE CREDITO','2026-03-06','payable','69a43a648921fb5b494fa926',NULL),
('69ab8bb6730ade1ad1ceaf65','2026-03-07 02:21:42','2026-03-07 02:21:42','juarezsilveirajunior@gmail.com','69a8c5bb13aca9553e13342b','debit',1621.00,'(1/3)','2026-03-06','payable','69a8df44bc3f245b14109893',NULL),
('69ab8c053ec693dff5af8f16','2026-03-07 02:23:01','2026-03-07 02:23:01','juarezsilveirajunior@gmail.com','69a8c5bb13aca9553e13342b','debit',852.00,'DESPESA DE DESLOCAMENTO E DE ALIMENTAÇÃO PARA ATENDIMENTO EM ALTO PARAISO E POSSE','2026-03-06','payable','69a8c83b7b0cf4059d625b37','69a45c4bcf69030091a0e8cd');

-- ────────────────────────────────────────────────────────────
-- RELATÓRIOS DE SERVIÇO
-- ────────────────────────────────────────────────────────────
INSERT INTO service_report (id, created_date, updated_date, created_by, project_id, report_types, solutions, results, results_images, consultant_notes) VALUES
('69a34c5d49d92de438fe09b2','2026-02-28 20:13:17','2026-02-28 20:13:17','juarezsilveirajunior@gmail.com','699f44c97bf16c87206d93aa','["presencial","final"]',
'Informamos que todas as etapas previstas na proposta de consultoria foram concluídas com sucesso.',
'Diante da proposta e todas as ações tomadas, podemos dizer que os objetivos propostos pelas etapas deste planejamento foram alcançados.',
'["https://base44.app/api/apps/695ebd99a400611ea331a00a/files/public/695ebd99a400611ea331a00a/243665e74_ANALISESWOTMOGLOBAL_28012026.png"]',
'Tudo transcorreu bem e sem maiores dificuldades.'),
('69a487c16ee8e5bd9196e352','2026-03-01 18:38:57','2026-03-01 18:38:57','juarezsilveirajunior@gmail.com','69a4849e13d7dd07ddf91833','["presencial","final"]',
'Informamos que todas as etapas previstas na proposta de consultoria foram concluídas com sucesso.',
'Diante da proposta e todas as ações tomadas, podemos dizer que os objetivos propostos pelas etapas deste planejamento foram alcançados.',
'["https://base44.app/api/apps/695ebd99a400611ea331a00a/files/public/695ebd99a400611ea331a00a/4474e5b2e_ANALISESWOTMOGLOBAL_28012026.png"]',
'Tudo transcorreu bem e sem maiores dificuldades.');

-- ────────────────────────────────────────────────────────────
-- PROJETOS
-- (Resumido por volume — campos JSONB grandes omitidos ou truncados)
-- Inclui todos os projetos encontrados na base
-- ────────────────────────────────────────────────────────────

-- Projetos referenciados mas não listados diretamente (IDs de FK):
-- 699f44c97bf16c87206d93aa, 69a4849e13d7dd07ddf91833, 69a45c4bcf69030091a0e8cd
-- 69a9dcc64696200bfaa83f93, 69a9bdf9c97ce12914660daf, 69a9c2eb93699c6dd72b11a8
-- 69aa53f5c3781b858abdddf5

-- Inserir projetos conhecidos (dados parciais para FK integrity)
INSERT INTO project (id, created_date, updated_date, created_by, name, client_id, consultant_id, project_type, status, start_date, contracted_value, estimated_hours, subsidy_percent, progress) VALUES
('699f44c97bf16c87206d93aa','2026-02-25 00:00:00','2026-02-25 00:00:00','juarezsilveirajunior@gmail.com','Projeto MO GLOBAL','69a4594412cc14fc164b9e2b','69a43bfcb7507f639d4d8785','consulting','completed','2025-11-01',0,0,70,100),
('69a4849e13d7dd07ddf91833','2026-03-01 18:00:00','2026-03-01 18:00:00','juarezsilveirajunior@gmail.com','Projeto ACERT','69a4475781c7fae9d4a6ad15','69a43bfcb7507f639d4d8785','consulting','completed','2025-11-01',0,0,70,100),
('69a45c4bcf69030091a0e8cd','2026-03-01 15:30:00','2026-03-01 15:30:00','juarezsilveirajunior@gmail.com','KARI VASS HOSPEDAGEM E EVENTOS LTDA - 24/11/2025','69a4594412cc14fc164b9e2b','69a43bfcb7507f639d4d8785','consulting','completed','2025-11-24',0,0,70,100),
('69a9dcc64696200bfaa83f93','2026-03-05 20:00:00','2026-03-05 20:00:00','juarezsilveirajunior@gmail.com','Projeto Liliane 2','69a9b630b6d8cc1d67783c37','699efdccd924003135fe6e06','consulting','in_progress','2026-04-01',0,0,70,0),
('69a9bdf9c97ce12914660daf','2026-03-05 18:00:00','2026-03-05 18:00:00','juarezsilveirajunior@gmail.com','BIOPHARMACIA FARMACIA DE MANIPULACAO LTDA - 19/03/2026','69a9b630b6d8cc1d67783c37','69a43ed656ed2065a6dddc1a','consulting','in_progress','2026-03-19',0,0,70,0),
('69a9c2eb93699c6dd72b11a8','2026-03-05 18:00:00','2026-03-05 18:00:00','juarezsilveirajunior@gmail.com','LATOX TOXICOLOGIA DIAGNOSTICA MEDICINA E PSICOLOGIA DO TRANSITO LTDA - 19/03/2026','69a9c266b818d08064cabf08','699d1da3daf1458660a769af','consulting','in_progress','2026-03-19',0,0,70,0),
('69aa53f5c3781b858abdddf5','2026-03-06 00:00:00','2026-03-19 00:00:00','metaconsultorias@hotmail.com','LS SERVICOS EM SAUDE E SEGURANCA DO TRABALHO LTDA - 25/02/2026','69aa4584cfa27276413c09d0','699d1ded63be7f6e7872aa95','consulting','in_progress','2026-02-25',23000,200,70,0)
ON CONFLICT (id) DO NOTHING;

-- Projetos com dados completos
INSERT INTO project (id, created_date, updated_date, created_by, name, client_id, consultant_id, project_type, pricing_mode, area, subarea, objective, client_needs, service_detail, produto_final, activities, schedule_config, contracted_value, estimated_hours, hourly_rate, km_rodado, start_date, end_date, hours_per_day, consider_sundays, consider_holidays, days_off, days_off_position, schedule_generated, status, progress, subsidy_percent, payment_method, sebrae_manager_name, sebrae_manager_phone, sebrae_regional_name, sebrae_regional_phone, notes) VALUES
('69ab9941eb8664a37d60f190','2026-03-07 03:19:29','2026-03-19 14:16:33','juarezsilveirajunior@gmail.com',
 'LUIZ HUMBERTO GONCALVES GOMES - 07/03/2026',
 '69ab8ce5b2d980ae93c96582','699d1ded63be7f6e7872aa95','consulting','fixed',
 'financas','Gestão Econômico/Financeira',
 'Prestação de serviços de consultoria na área de Finanças, auxiliando a empresa continuar progredindo, viabilizando robustez ao Controle Financeiro.',
 'A MISTER MALTE atua na produção de cerveja e chopp, possuindo conhecimento consolidado em processos produtivos.',
 'A prestação de serviço de consultoria prevê o desenvolvimento de Controle Financeiro.',
 'PRODUTO FINAL A SER DISPONIBILIZADO PARA O CLIENTE: 1 (um) Modelo de Gestão Financeira',
 '[]','[]',
 20700.00,180,115.00,0,'2026-03-07',NULL,10,'no','no',0,'end',TRUE,'in_progress',0,70,'avista_cartao',
 'RAFAELA INGRID PINHEIRO DE ANDRADE',' (62) 99947-7133','CLEBER CHAGAS','(61)3601-5300',''),
('69af27b0c851bef91c6b701b','2026-03-09 20:04:00','2026-03-18 17:29:17','juarezsilveirajunior@gmail.com',
 'JULIANA RIBEIRO SOCIEDADE INDIVIDUAL DE ADVOCACIA - 20/03/2026',
 '699eff5dc105cd08926fef04','699efdccd924003135fe6e06','consulting','fixed',
 'planejamento','Gestão de Processos Empresariais',
 'Prestação de serviços de consultoria na área de Planejamento, auxiliando o empresário na estruturação de um Modelo de Gestão na area de Processos.',
 'A Juliana Ribeiro Sociedade Individual de Advocacia identificou a necessidade de estruturar de forma mais robusta o planejamento empresarial.',
 'A prestação de serviço de consultoria prevê o desenvolvimento de Padronização dos Processos gerenciais.',
 'PRODUTO FINAL A SER DISPONIBILIZADO PARA O CLIENTE: 1 (um) Modelo de Gestão Empresarial para área de processos',
 '[]','[]',
 12075.00,105,115.00,0,'2026-03-20','2026-04-01',10,'no','no',0,'middle',TRUE,'in_progress',0,70,'avista_cartao',
 'RAFAELA INGRID PINHEIRO DE ANDRADE',' (62) 99947-7133','CLEBER CHAGAS','(61)3601-5300','')
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- AGENDA DO PROJETO (project_schedule)
-- Apenas uma amostra representativa — base completa tem ~500 registros
-- Para migração completa exporte via: SELECT * FROM project_schedule ORDER BY date
-- ────────────────────────────────────────────────────────────
-- Fase projeto JULIANA RIBEIRO (69af27b0c851bef91c6b701b)
INSERT INTO project_schedule (id, created_date, updated_date, created_by, project_id, consultant_id, date, hours, status, approved) VALUES
('69b321730892ee2e29736319','2026-03-12 20:26:27','2026-03-12 20:26:27','juarezsilveirajunior@gmail.com','69af27b0c851bef91c6b701b','699efdccd924003135fe6e06','2026-03-20',10,'scheduled',FALSE),
('69b321730892ee2e2973631a','2026-03-12 20:26:27','2026-03-12 20:26:27','juarezsilveirajunior@gmail.com','69af27b0c851bef91c6b701b','699efdccd924003135fe6e06','2026-03-21',10,'scheduled',FALSE),
('69b321730892ee2e2973631b','2026-03-12 20:26:27','2026-03-12 20:26:27','juarezsilveirajunior@gmail.com','69af27b0c851bef91c6b701b','699efdccd924003135fe6e06','2026-03-23',10,'scheduled',FALSE),
('69b321730892ee2e2973631c','2026-03-12 20:26:27','2026-03-12 20:26:27','juarezsilveirajunior@gmail.com','69af27b0c851bef91c6b701b','699efdccd924003135fe6e06','2026-03-24',10,'scheduled',FALSE),
('69b321730892ee2e2973631d','2026-03-12 20:26:27','2026-03-12 20:26:27','juarezsilveirajunior@gmail.com','69af27b0c851bef91c6b701b','699efdccd924003135fe6e06','2026-03-25',10,'scheduled',FALSE),
('69b321730892ee2e2973631e','2026-03-12 20:26:27','2026-03-12 20:26:27','juarezsilveirajunior@gmail.com','69af27b0c851bef91c6b701b','699efdccd924003135fe6e06','2026-03-26',10,'scheduled',FALSE),
('69b321730892ee2e2973631f','2026-03-12 20:26:27','2026-03-12 20:26:27','juarezsilveirajunior@gmail.com','69af27b0c851bef91c6b701b','699efdccd924003135fe6e06','2026-03-27',10,'scheduled',FALSE),
('69b321730892ee2e29736320','2026-03-12 20:26:27','2026-03-12 20:26:27','juarezsilveirajunior@gmail.com','69af27b0c851bef91c6b701b','699efdccd924003135fe6e06','2026-03-28',10,'scheduled',FALSE),
('69b321730892ee2e29736321','2026-03-12 20:26:27','2026-03-12 20:26:27','juarezsilveirajunior@gmail.com','69af27b0c851bef91c6b701b','699efdccd924003135fe6e06','2026-03-30',10,'scheduled',FALSE),
('69b321730892ee2e29736322','2026-03-12 20:26:27','2026-03-12 20:26:27','juarezsilveirajunior@gmail.com','69af27b0c851bef91c6b701b','699efdccd924003135fe6e06','2026-03-31',10,'scheduled',FALSE),
('69b321730892ee2e29736323','2026-03-12 20:26:27','2026-03-12 20:26:27','juarezsilveirajunior@gmail.com','69af27b0c851bef91c6b701b','699efdccd924003135fe6e06','2026-04-01',5,'scheduled',FALSE);

-- Fases LS SERVICOS (69aa53f5c3781b858abdddf5) — amostra
INSERT INTO project_schedule (id, created_date, updated_date, created_by, project_id, consultant_id, date, hours, status, approved) VALUES
('69aa53fd8305d0eb61d89ea8','2026-03-06 00:00:00','2026-03-06 00:00:00','metaconsultorias@hotmail.com','69aa53f5c3781b858abdddf5','699d1ded63be7f6e7872aa95','2026-02-25',10,'completed',FALSE),
('69aa53fd8305d0eb61d89ea9','2026-03-06 00:00:00','2026-03-06 00:00:00','metaconsultorias@hotmail.com','69aa53f5c3781b858abdddf5','699d1ded63be7f6e7872aa95','2026-02-26',10,'completed',FALSE),
('69aa53fd8305d0eb61d89eab','2026-03-06 00:00:00','2026-03-06 00:00:00','metaconsultorias@hotmail.com','69aa53f5c3781b858abdddf5','699d1ded63be7f6e7872aa95','2026-02-28',10,'completed',FALSE),
('69aa53fd8305d0eb61d89eac','2026-03-06 00:00:00','2026-03-06 00:00:00','metaconsultorias@hotmail.com','69aa53f5c3781b858abdddf5','699d1ded63be7f6e7872aa95','2026-03-02',10,'completed',FALSE),
('69aa53fd8305d0eb61d89ead','2026-03-06 00:00:00','2026-03-06 00:00:00','metaconsultorias@hotmail.com','69aa53f5c3781b858abdddf5','699d1ded63be7f6e7872aa95','2026-03-03',10,'completed',FALSE),
('69aa53fd8305d0eb61d89eae','2026-03-06 00:00:00','2026-03-06 00:00:00','metaconsultorias@hotmail.com','69aa53f5c3781b858abdddf5','699d1ded63be7f6e7872aa95','2026-03-04',10,'completed',FALSE),
('69aa53fd8305d0eb61d89eaf','2026-03-06 00:00:00','2026-03-06 00:00:00','metaconsultorias@hotmail.com','69aa53f5c3781b858abdddf5','699d1ded63be7f6e7872aa95','2026-03-05',10,'completed',FALSE),
('69aa53fd8305d0eb61d89eb0','2026-03-06 00:00:00','2026-03-06 00:00:00','metaconsultorias@hotmail.com','69aa53f5c3781b858abdddf5','699d1ded63be7f6e7872aa95','2026-03-06',10,'completed',FALSE),
('69aa53fd8305d0eb61d89eb1','2026-03-06 00:00:00','2026-03-06 00:00:00','metaconsultorias@hotmail.com','69aa53f5c3781b858abdddf5','699d1ded63be7f6e7872aa95','2026-03-07',10,'completed',FALSE),
('69aa53fd8305d0eb61d89eb2','2026-03-06 00:00:00','2026-03-06 00:00:00','metaconsultorias@hotmail.com','69aa53f5c3781b858abdddf5','699d1ded63be7f6e7872aa95','2026-03-09',10,'completed',FALSE),
('69aa53fd8305d0eb61d89eb3','2026-03-06 00:00:00','2026-03-13 00:00:00','metaconsultorias@hotmail.com','69aa53f5c3781b858abdddf5','699d1ded63be7f6e7872aa95','2026-03-10',10,'completed',FALSE),
('69aa53fd8305d0eb61d89eb4','2026-03-06 00:00:00','2026-03-13 00:00:00','metaconsultorias@hotmail.com','69aa53f5c3781b858abdddf5','699d1ded63be7f6e7872aa95','2026-03-11',10,'completed',FALSE),
('69aa53fd8305d0eb61d89eb5','2026-03-06 00:00:00','2026-03-13 00:00:00','metaconsultorias@hotmail.com','69aa53f5c3781b858abdddf5','699d1ded63be7f6e7872aa95','2026-03-12',10,'completed',FALSE),
('69aa53fd8305d0eb61d89eb6','2026-03-06 00:00:00','2026-03-16 00:00:00','metaconsultorias@hotmail.com','69aa53f5c3781b858abdddf5','699d1ded63be7f6e7872aa95','2026-03-13',10,'completed',FALSE),
('69aa53fd8305d0eb61d89eb7','2026-03-06 00:00:00','2026-03-16 00:00:00','metaconsultorias@hotmail.com','69aa53f5c3781b858abdddf5','699d1ded63be7f6e7872aa95','2026-03-14',10,'completed',FALSE),
('69aa53fd8305d0eb61d89eb8','2026-03-06 00:00:00','2026-03-19 00:00:00','metaconsultorias@hotmail.com','69aa53f5c3781b858abdddf5','699d1ded63be7f6e7872aa95','2026-03-16',10,'completed',FALSE),
('69aa53fd8305d0eb61d89eb9','2026-03-06 00:00:00','2026-03-19 00:00:00','metaconsultorias@hotmail.com','69aa53f5c3781b858abdddf5','699d1ded63be7f6e7872aa95','2026-03-17',10,'completed',FALSE),
('69aa5579fb43551898a8357e','2026-03-06 01:00:00','2026-03-19 00:00:00','lyndabatista2007@gmail.com','69a9bdf9c97ce12914660daf','69a43ed656ed2065a6dddc1a','2026-03-19',3,'completed',FALSE),
('69aa555a4cea2eb047c689eb','2026-03-06 01:00:00','2026-03-19 00:00:00','lyndabatista2007@gmail.com','69a9c2eb93699c6dd72b11a8','699d1da3daf1458660a769af','2026-03-19',3,'completed',FALSE);

-- ────────────────────────────────────────────────────────────
-- FATURAMENTO (BillingEntry) — amostra LS SERVICOS + outros
-- ────────────────────────────────────────────────────────────
INSERT INTO billing_entry (id, created_date, updated_date, created_by, project_id, phase_id, amount, hours, status, description, phase_date) VALUES
('69af2033aa20f969f533ff16','2026-03-09 19:32:03','2026-03-09 19:32:03','lyndabatista2007@gmail.com','69aa53f5c3781b858abdddf5','69aa53fd8305d0eb61d89eaf',1150.00,10,'to_bill','Fase 8 — 05/03/2026 — LS SERVICOS EM SAUDE E SEGURANCA DO TRABALHO LTDA','2026-03-05'),
('69af20362d52aa3140850a4c','2026-03-09 19:32:06','2026-03-09 19:32:06','lyndabatista2007@gmail.com','69aa53f5c3781b858abdddf5','69aa53fd8305d0eb61d89eb0',1150.00,10,'to_bill','Fase 9 — 06/03/2026 — LS SERVICOS EM SAUDE E SEGURANCA DO TRABALHO LTDA','2026-03-06'),
('69af20385d6ba65d88709ff5','2026-03-09 19:32:08','2026-03-09 19:32:08','lyndabatista2007@gmail.com','69aa53f5c3781b858abdddf5','69aa53fd8305d0eb61d89eb1',1150.00,10,'to_bill','Fase 10 — 07/03/2026 — LS SERVICOS EM SAUDE E SEGURANCA DO TRABALHO LTDA','2026-03-07'),
('69b410e8e616c3be1ab561d1','2026-03-13 13:28:08','2026-03-13 13:28:08','lyndabatista2007@gmail.com','69aa53f5c3781b858abdddf5','69aa53fd8305d0eb61d89eb2',1150.00,10,'to_bill','Fase 11 — 09/03/2026 — LS SERVICOS EM SAUDE E SEGURANCA DO TRABALHO LTDA','2026-03-09'),
('69b410ea5585fd84d77aee77','2026-03-13 13:28:10','2026-03-13 13:28:10','lyndabatista2007@gmail.com','69aa53f5c3781b858abdddf5','69aa53fd8305d0eb61d89eb3',1150.00,10,'to_bill','Fase 12 — 10/03/2026 — LS SERVICOS EM SAUDE E SEGURANCA DO TRABALHO LTDA','2026-03-10'),
('69b412675182c1e99ed8263e','2026-03-13 13:34:31','2026-03-13 13:34:31','lyndabatista2007@gmail.com','69aa53f5c3781b858abdddf5','69aa53fd8305d0eb61d89eb4',1150.00,10,'to_bill','Fase 13 — 11/03/2026 — LS SERVICOS EM SAUDE E SEGURANCA DO TRABALHO LTDA','2026-03-11'),
('69b412f165b8c940fc30b0d8','2026-03-13 13:36:49','2026-03-13 13:36:49','lyndabatista2007@gmail.com','69aa53f5c3781b858abdddf5','69aa53fd8305d0eb61d89eb5',1150.00,10,'to_bill','Fase 14 — 12/03/2026 — LS SERVICOS EM SAUDE E SEGURANCA DO TRABALHO LTDA','2026-03-12'),
('69b857a4f7161978c6bbad8c','2026-03-16 19:19:00','2026-03-16 19:19:00','lyndabatista2007@gmail.com','69aa53f5c3781b858abdddf5','69aa53fd8305d0eb61d89eb6',1150.00,10,'to_bill','Fase 15 — 13/03/2026 — LS SERVICOS EM SAUDE E SEGURANCA DO TRABALHO LTDA','2026-03-13'),
('69b857a66ab0f2e56e8928e9','2026-03-16 19:19:02','2026-03-16 19:19:02','lyndabatista2007@gmail.com','69aa53f5c3781b858abdddf5','69aa53fd8305d0eb61d89eb7',1150.00,10,'to_bill','Fase 16 — 14/03/2026 — LS SERVICOS EM SAUDE E SEGURANCA DO TRABALHO LTDA','2026-03-14'),
('69bb6318545990cf07112740','2026-03-19 02:44:40','2026-03-19 02:44:40','lyndabatista2007@gmail.com','69aa53f5c3781b858abdddf5','69aa53fd8305d0eb61d89eb8',1150.00,10,'to_bill','Fase 17 — 16/03/2026 — LS SERVICOS EM SAUDE E SEGURANCA DO TRABALHO LTDA','2026-03-16'),
('69bb642fdf04df2af0bb7271','2026-03-19 02:49:19','2026-03-19 02:49:19','lyndabatista2007@gmail.com','69aa53f5c3781b858abdddf5','69aa53fd8305d0eb61d89eb9',1150.00,10,'to_bill','Fase 18 — 17/03/2026 — LS SERVICOS EM SAUDE E SEGURANCA DO TRABALHO LTDA','2026-03-17'),
('69bc226c78c62688c0572104','2026-03-19 16:21:00','2026-03-19 16:21:00','lyndabatista2007@gmail.com','69a9c2eb93699c6dd72b11a8','69aa555a4cea2eb047c689eb',361.00,3,'to_bill','Fase 1 — 19/03/2026 — LATOX TOXICOLOGIA DIAGNOSTICA','2026-03-19'),
('69bc2788307a2ddb51830041','2026-03-19 16:42:48','2026-03-19 16:42:48','lyndabatista2007@gmail.com','69a9bdf9c97ce12914660daf','69aa5579fb43551898a8357e',361.00,3,'to_bill','Fase 1 — 19/03/2026 — BIOPHARMACIA FARMACIA DE MANIPULACAO LTDA','2026-03-19');

-- Reabilita checagem de FK
SET session_replication_role = DEFAULT;

-- ════════════════════════════════════════════════════════════
-- FIM DA MIGRAÇÃO
-- Total de tabelas: 19
-- Gerado em: 2026-03-20 | Vanguarda Consultoria
-- ════════════════════════════════════════════════════════════

-- ======================================================================
-- Correções/Normalizações (compatibilidade com o front atual)
-- ======================================================================

-- Garantir `expense.date` (o seed original preenche apenas `due_date`)
UPDATE public.expense
SET date = due_date
WHERE date IS NULL
  AND due_date IS NOT NULL;

-- Normalizar status para a UI (pending/approved/rejected/reimbursed)
UPDATE public.expense
SET status = CASE
  WHEN status = 'to_pay' THEN 'pending'
  WHEN status = 'paid' THEN 'reimbursed'
  ELSE status
END;

-- ======================================================================
-- RLS (Row Level Security) + Policies
-- ======================================================================

-- Grants amplos para o front (CRUD via authenticated)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultant TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_schedule TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entry TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_receivable TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_payable TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_report TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_model TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_area_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_account TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_transaction TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_of_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_rate TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_entry TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_expense_entry TO authenticated;

-- ------------------------------
-- consultant
-- ------------------------------
ALTER TABLE public.consultant ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS consultant_select ON public.consultant;
CREATE POLICY consultant_select
ON public.consultant
FOR SELECT
TO authenticated
USING (
  public.current_user_type() IN ('admin', 'consultant')
  OR (
    public.current_user_type() = 'client'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.consultant_id = id
        AND p.client_id = public.current_client_id()
    )
  )
);
DROP POLICY IF EXISTS consultant_admin_write ON public.consultant;
CREATE POLICY consultant_admin_write
ON public.consultant
FOR ALL
TO authenticated
USING (public.current_user_type() = 'admin')
WITH CHECK (public.current_user_type() = 'admin');

-- ------------------------------
-- client
-- ------------------------------
ALTER TABLE public.client ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS client_select ON public.client;
CREATE POLICY client_select
ON public.client
FOR SELECT
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'client'
    AND id = public.current_client_id()
  )
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.client_id = id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
);
DROP POLICY IF EXISTS client_admin_write ON public.client;
CREATE POLICY client_admin_write
ON public.client
FOR ALL
TO authenticated
USING (public.current_user_type() = 'admin')
WITH CHECK (public.current_user_type() = 'admin');

-- ------------------------------
-- project
-- ------------------------------
ALTER TABLE public.project ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_select ON public.project;
CREATE POLICY project_select
ON public.project
FOR SELECT
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND consultant_id = public.current_consultant_id()
  )
  OR (
    public.current_user_type() = 'client'
    AND client_id = public.current_client_id()
  )
);
DROP POLICY IF EXISTS project_consultant_write ON public.project;
CREATE POLICY project_consultant_write
ON public.project
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND (consultant_id IS NULL OR consultant_id = public.current_consultant_id())
  )
);
DROP POLICY IF EXISTS project_update_consultant_write ON public.project;
CREATE POLICY project_update_consultant_write
ON public.project
FOR UPDATE
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND consultant_id = public.current_consultant_id()
  )
)
WITH CHECK (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND (consultant_id IS NULL OR consultant_id = public.current_consultant_id())
  )
);
DROP POLICY IF EXISTS project_delete_admin ON public.project;
CREATE POLICY project_delete_admin
ON public.project
FOR DELETE
TO authenticated
USING (public.current_user_type() = 'admin');

-- ------------------------------
-- project_schedule
-- ------------------------------
ALTER TABLE public.project_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_schedule_select ON public.project_schedule;
CREATE POLICY project_schedule_select
ON public.project_schedule
FOR SELECT
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
);
DROP POLICY IF EXISTS project_schedule_write ON public.project_schedule;
CREATE POLICY project_schedule_write
ON public.project_schedule
FOR ALL
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
)
WITH CHECK (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
);

-- ------------------------------
-- task
-- ------------------------------
ALTER TABLE public.task ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS task_select ON public.task;
CREATE POLICY task_select
ON public.task
FOR SELECT
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
  OR (
    public.current_user_type() = 'client'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.client_id = public.current_client_id()
    )
  )
);
DROP POLICY IF EXISTS task_write ON public.task;
CREATE POLICY task_write
ON public.task
FOR ALL
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
)
WITH CHECK (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
);

-- ------------------------------
-- document
-- ------------------------------
ALTER TABLE public.document ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS document_select ON public.document;
CREATE POLICY document_select
ON public.document
FOR SELECT
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
  OR (
    public.current_user_type() = 'client'
    AND visible_to_client = true
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.client_id = public.current_client_id()
    )
  )
);
DROP POLICY IF EXISTS document_write_consultant_admin ON public.document;
CREATE POLICY document_write_consultant_admin
ON public.document
FOR ALL
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
)
WITH CHECK (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
);

-- Inserção de documento pelo client (upload)
DROP POLICY IF EXISTS document_client_insert ON public.document;
CREATE POLICY document_client_insert
ON public.document
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'client'
    AND visible_to_client = true
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.client_id = public.current_client_id()
    )
  )
);

-- ------------------------------
-- message
-- ------------------------------
ALTER TABLE public.message ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS message_select ON public.message;
CREATE POLICY message_select
ON public.message
FOR SELECT
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
  OR (
    public.current_user_type() = 'client'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.client_id = public.current_client_id()
    )
  )
);
DROP POLICY IF EXISTS message_client_insert_consultant_insert ON public.message;
CREATE POLICY message_insert
ON public.message
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
  OR (
    public.current_user_type() = 'client'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.client_id = public.current_client_id()
    )
  )
);
DROP POLICY IF EXISTS message_admin_write ON public.message;
CREATE POLICY message_admin_write
ON public.message
FOR UPDATE
TO authenticated
USING (public.current_user_type() = 'admin')
WITH CHECK (public.current_user_type() = 'admin');
DROP POLICY IF EXISTS message_admin_delete ON public.message;
CREATE POLICY message_admin_delete
ON public.message
FOR DELETE
TO authenticated
USING (public.current_user_type() = 'admin');

-- ------------------------------
-- time_entry
-- ------------------------------
ALTER TABLE public.time_entry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS time_entry_select ON public.time_entry;
CREATE POLICY time_entry_select
ON public.time_entry
FOR SELECT
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
);
DROP POLICY IF EXISTS time_entry_write ON public.time_entry;
CREATE POLICY time_entry_write
ON public.time_entry
FOR ALL
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
)
WITH CHECK (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
);

-- ------------------------------
-- expense
-- ------------------------------
ALTER TABLE public.expense ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS expense_select ON public.expense;
CREATE POLICY expense_select
ON public.expense
FOR SELECT
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND (
      consultant_id = public.current_consultant_id()
      OR (
        project_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.project p
          WHERE p.id = project_id
            AND p.consultant_id = public.current_consultant_id()
        )
      )
    )
  )
);
DROP POLICY IF EXISTS expense_write ON public.expense;
CREATE POLICY expense_write
ON public.expense
FOR ALL
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND (
      consultant_id = public.current_consultant_id()
      OR (
        project_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.project p
          WHERE p.id = project_id
            AND p.consultant_id = public.current_consultant_id()
        )
      )
    )
  )
)
WITH CHECK (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND (
      consultant_id = public.current_consultant_id()
      OR (
        project_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.project p
          WHERE p.id = project_id
            AND p.consultant_id = public.current_consultant_id()
        )
      )
    )
  )
);

-- ------------------------------
-- project_receivable
-- ------------------------------
ALTER TABLE public.project_receivable ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_receivable_select ON public.project_receivable;
CREATE POLICY project_receivable_select
ON public.project_receivable
FOR SELECT
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
);
DROP POLICY IF EXISTS project_receivable_write ON public.project_receivable;
CREATE POLICY project_receivable_write
ON public.project_receivable
FOR ALL
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
)
WITH CHECK (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
);

-- ------------------------------
-- project_payable
-- ------------------------------
ALTER TABLE public.project_payable ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_payable_select ON public.project_payable;
CREATE POLICY project_payable_select
ON public.project_payable
FOR SELECT
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
);
DROP POLICY IF EXISTS project_payable_write ON public.project_payable;
CREATE POLICY project_payable_write
ON public.project_payable
FOR ALL
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
)
WITH CHECK (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
);

-- ------------------------------
-- service_report
-- ------------------------------
ALTER TABLE public.service_report ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_report_select ON public.service_report;
CREATE POLICY service_report_select
ON public.service_report
FOR SELECT
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
);
DROP POLICY IF EXISTS service_report_write ON public.service_report;
CREATE POLICY service_report_write
ON public.service_report
FOR ALL
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
)
WITH CHECK (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
);

-- ------------------------------
-- service_model / service_area_config (global)
-- ------------------------------
ALTER TABLE public.service_model ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_model_select ON public.service_model;
CREATE POLICY service_model_select
ON public.service_model
FOR SELECT
TO authenticated
USING (public.current_user_type() IN ('admin', 'consultant'));
DROP POLICY IF EXISTS service_model_admin_write ON public.service_model;
CREATE POLICY service_model_admin_write
ON public.service_model
FOR ALL
TO authenticated
USING (public.current_user_type() = 'admin')
WITH CHECK (public.current_user_type() = 'admin');

ALTER TABLE public.service_area_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_area_config_select ON public.service_area_config;
CREATE POLICY service_area_config_select
ON public.service_area_config
FOR SELECT
TO authenticated
USING (public.current_user_type() IN ('admin', 'consultant'));
DROP POLICY IF EXISTS service_area_config_admin_write ON public.service_area_config;
CREATE POLICY service_area_config_admin_write
ON public.service_area_config
FOR ALL
TO authenticated
USING (public.current_user_type() = 'admin')
WITH CHECK (public.current_user_type() = 'admin');

-- ------------------------------
-- financial_account / account_transaction / chart_of_accounts / tax_rate (global)
-- ------------------------------
ALTER TABLE public.financial_account ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS financial_account_select ON public.financial_account;
CREATE POLICY financial_account_select
ON public.financial_account
FOR SELECT
TO authenticated
USING (public.current_user_type() IN ('admin', 'consultant'));
DROP POLICY IF EXISTS financial_account_admin_write ON public.financial_account;
CREATE POLICY financial_account_admin_write
ON public.financial_account
FOR ALL
TO authenticated
USING (public.current_user_type() = 'admin')
WITH CHECK (public.current_user_type() = 'admin');

ALTER TABLE public.account_transaction ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_transaction_select ON public.account_transaction;
CREATE POLICY account_transaction_select
ON public.account_transaction
FOR SELECT
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND (
      project_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.project p
        WHERE p.id = project_id
          AND p.consultant_id = public.current_consultant_id()
      )
    )
  )
);
DROP POLICY IF EXISTS account_transaction_admin_write ON public.account_transaction;
CREATE POLICY account_transaction_admin_write
ON public.account_transaction
FOR ALL
TO authenticated
USING (public.current_user_type() = 'admin')
WITH CHECK (public.current_user_type() = 'admin');

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chart_of_accounts_select ON public.chart_of_accounts;
CREATE POLICY chart_of_accounts_select
ON public.chart_of_accounts
FOR SELECT
TO authenticated
USING (public.current_user_type() IN ('admin', 'consultant'));
DROP POLICY IF EXISTS chart_of_accounts_admin_write ON public.chart_of_accounts;
CREATE POLICY chart_of_accounts_admin_write
ON public.chart_of_accounts
FOR ALL
TO authenticated
USING (public.current_user_type() = 'admin')
WITH CHECK (public.current_user_type() = 'admin');

ALTER TABLE public.tax_rate ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tax_rate_select ON public.tax_rate;
CREATE POLICY tax_rate_select
ON public.tax_rate
FOR SELECT
TO authenticated
USING (public.current_user_type() IN ('admin', 'consultant'));
DROP POLICY IF EXISTS tax_rate_admin_write ON public.tax_rate;
CREATE POLICY tax_rate_admin_write
ON public.tax_rate
FOR ALL
TO authenticated
USING (public.current_user_type() = 'admin')
WITH CHECK (public.current_user_type() = 'admin');

-- ------------------------------
-- billing_entry / tax_expense_entry (global por projeto)
-- ------------------------------
ALTER TABLE public.billing_entry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS billing_entry_select ON public.billing_entry;
CREATE POLICY billing_entry_select
ON public.billing_entry
FOR SELECT
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
);
DROP POLICY IF EXISTS billing_entry_admin_write ON public.billing_entry;
CREATE POLICY billing_entry_admin_write
ON public.billing_entry
FOR ALL
TO authenticated
USING (public.current_user_type() = 'admin')
WITH CHECK (public.current_user_type() = 'admin');

ALTER TABLE public.tax_expense_entry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tax_expense_entry_select ON public.tax_expense_entry;
CREATE POLICY tax_expense_entry_select
ON public.tax_expense_entry
FOR SELECT
TO authenticated
USING (
  public.current_user_type() = 'admin'
  OR (
    public.current_user_type() = 'consultant'
    AND EXISTS (
      SELECT 1
      FROM public.project p
      WHERE p.id = project_id
        AND p.consultant_id = public.current_consultant_id()
    )
  )
);
DROP POLICY IF EXISTS tax_expense_entry_admin_write ON public.tax_expense_entry;
CREATE POLICY tax_expense_entry_admin_write
ON public.tax_expense_entry
FOR ALL
TO authenticated
USING (public.current_user_type() = 'admin')
WITH CHECK (public.current_user_type() = 'admin');

-- ======================================================================
-- Storage: policies (uploads / leitura) no bucket base44-prod
-- ======================================================================

-- Não mexe em ENABLE ROW LEVEL SECURITY aqui (o storage já está com RLS ligado no Supabase).
-- Só garantimos as policies para que uploads/leitura funcionem.

DROP POLICY IF EXISTS storage_objects_select_base44_prod ON storage.objects;
DROP POLICY IF EXISTS storage_objects_select_base44_prod_auth ON storage.objects;
DROP POLICY IF EXISTS storage_objects_insert_base44_prod ON storage.objects;
DROP POLICY IF EXISTS storage_objects_update_base44_prod ON storage.objects;
DROP POLICY IF EXISTS storage_objects_delete_base44_prod ON storage.objects;

CREATE POLICY storage_objects_select_base44_prod
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'base44-prod');

CREATE POLICY storage_objects_select_base44_prod_auth
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'base44-prod');

CREATE POLICY storage_objects_insert_base44_prod
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'base44-prod');

CREATE POLICY storage_objects_update_base44_prod
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'base44-prod')
WITH CHECK (bucket_id = 'base44-prod');

CREATE POLICY storage_objects_delete_base44_prod
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'base44-prod');

-- Compatibilidade com schema multi-tenant:
-- preenche organization_id nulo com tenant padrão e restaura NOT NULL.
DO $$
DECLARE
  has_org_column BOOLEAN;
  vanguarda_org_id UUID;
  tenant_table TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'consultant'
      AND column_name = 'organization_id'
  ) INTO has_org_column;

  IF NOT has_org_column THEN
    RETURN;
  END IF;

  SELECT id
    INTO vanguarda_org_id
  FROM public.organizations
  WHERE slug = 'vanguarda'
  LIMIT 1;

  IF vanguarda_org_id IS NULL THEN
    RAISE EXCEPTION 'Organização padrão "vanguarda" não encontrada.';
  END IF;

  FOREACH tenant_table IN ARRAY ARRAY[
    'consultant',
    'client',
    'project',
    'project_schedule',
    'task',
    'document',
    'time_entry',
    'expense',
    'message',
    'project_receivable',
    'project_payable',
    'service_report',
    'service_model',
    'service_area_config',
    'financial_account',
    'account_transaction',
    'chart_of_accounts',
    'tax_rate',
    'billing_entry',
    'tax_expense_entry',
    'profiles'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tenant_table
        AND column_name = 'organization_id'
    ) THEN
      EXECUTE format(
        'UPDATE public.%I SET organization_id = $1 WHERE organization_id IS NULL',
        tenant_table
      ) USING vanguarda_org_id;

      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL',
        tenant_table
      );
    END IF;
  END LOOP;
END $$;

-- Reativa comportamento normal de constraints/triggers.
SET session_replication_role = origin;

