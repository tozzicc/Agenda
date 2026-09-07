# AI Context — Agenda

Contexto técnico de continuidade. Estado observado após a ET-09; alterações de ET-07 a ET-09 ainda estão sem commit.

## 1. Stack

- Frontend: React 19, TypeScript, Vite 7, React Router 7, Tailwind CSS 4, date-fns, Lucide.
- Backend: Node.js ES modules, Express 5, PostgreSQL (`pg`), JWT, bcryptjs, Nodemailer, Multer e express-rate-limit.
- Testes: `node:test`; lint: ESLint 9.

## 2. Estrutura principal

- `src/pages`: fluxo público, autenticação, agendamentos e administração.
- `src/components`: calendário, horários, formulário, confirmação, navegação e layout do catálogo.
- `src/context`: autenticação e configurações/white-label.
- `src/lib`: utilitários e cliente/tipos do catálogo administrativo.
- `server/server.js`: API HTTP; `server/db.js`: schema/migrações idempotentes.
- `server/availability.js`, `demo-mode.js`, `mailer.js`, `password-policy.js`, `environment.js`: regras isoladas.
- `server/*.test.js`: testes unitários, banco e integração.

## 3. ETs concluídas

- **ET-01:** disponibilidade básica validada no backend e prevenção de dois agendamentos ativos no mesmo `date + time`.
- **ET-02:** configuração de produção endurecida; variáveis obrigatórias falham de forma explícita e sem expor segredos.
- **ET-03:** segurança de autenticação/agendamentos consolidada: senhas, reset, rate limiting, escaping e autorização de exclusão.
- **ET-04:** white-label por configurações, incluindo nome, logo e WhatsApp.
- **ET-05:** criação segura e explícita do primeiro administrador, sem credenciais padrão nem promoção implícita.
- **ET-06:** ambiente demo: seed técnico protegido e modo integrado fictício, temporário e isolado dos dados reais.
- **ET-07:** modelo de catálogo criado (`professionals`, `services`, `professional_services`) e referências opcionais adicionadas a `appointments`.
- **ET-08:** CRUD administrativo de serviços/profissionais, status ativo e associações N:N, bloqueado para usuários comuns e para mutações no modo demo.
- **ET-09:** fluxo público Serviço → Profissional → Data → Horário → Dados → Confirmação, persistência/edição e exibição do catálogo nos agendamentos.

## 4. Estado consolidado após ET-09

- Catálogo administrativo e público integrado de ponta a ponta.
- APIs públicas retornam apenas serviços com associação disponível e profissionais ativos associados.
- Criação exige IDs válidos e uma associação ativa; edição pode trocar ambos.
- “Meus Agendamentos” e a visão administrativa “Todos os Agendamentos” exibem serviço/profissional.
- Modo demo oferece catálogo e agendamentos fictícios em memória; dados reais permanecem isolados.
- Não há alterações commitadas de ET-07/08/09 no estado atual do workspace.

## 5. Funcionalidades principais

Cadastro/login, recuperação e troca de senha; agendar, listar, editar e cancelar; exclusão definitiva apenas por admin; configurações de agenda/identidade; logo; WhatsApp; catálogo e associações; criação do primeiro admin; seed demo; modo demo integrado e restaurável.

## 6. Entidades/tabelas

- `users`: identidade, e-mail único, hash de senha e papel (`user`/`admin`).
- `appointments`: usuário, data, hora, cliente, telefone, observações, status e FKs opcionais `service_id`/`professional_id`.
- `settings`: pares `key/value` para agenda, white-label e modo demo.
- `professionals`: nome, especialidade, ativo e timestamps.
- `services`: nome, descrição, duração em minutos, ativo e timestamps.
- `professional_services`: associação N:N por PK composta (`professional_id`, `service_id`).

## 7. Regras consolidadas

- JWT obrigatório nas rotas privadas; papel `admin` exigido nas rotas administrativas e exclusão definitiva.
- Senhas têm mínimo de 6 caracteres e são armazenadas com bcrypt.
- Login, registro, esqueci a senha e reset possuem rate limiting.
- Token de reset é curto e de uso único, vinculado ao hash atual da senha.
- Conteúdo inserido por usuários é escapado em e-mails HTML.
- White-label usa `company_name`, `app_logo` e `whatsapp_number` em `settings`.
- Modo demo integrado usa dados fictícios em memória e não lê/grava agendamentos reais; mutações operacionais reais ficam bloqueadas.
- `create-admin` exige variáveis explícitas e não altera usuário preexistente.
- `seed-demo` exige banco identificado como demo, `DEMO_MODE=true` e senha explícita; é transacional e idempotente.
- O índice `appointments_active_date_time_unique` é global em `(date, time) WHERE status = 'active'`.

## 8. Fluxo público e legado

Fluxo atual: **Serviço → Profissional → Data → Horário → Dados → Confirmação**.

Agendamentos antigos podem ter `service_id` e `professional_id` nulos. As listagens usam `LEFT JOIN`, mostram “não informado” e a edição de data/horário preserva esses valores nulos. Ao escolher novo catálogo, serviço e profissional devem ser enviados juntos e formar associação ativa.

## 9. Limite atual de disponibilidade

`appointments_active_date_time_unique` ainda bloqueia globalmente qualquer segundo agendamento ativo no mesmo dia/horário, independentemente do profissional ou da duração. **Disponibilidade avançada por profissional e duração NÃO foi implementada; pertence à ET-10.**

## 10. Ambiente local e comandos

- Frontend: URL padrão conhecida `http://localhost:5173` (ou a porta informada pelo Vite).
- Backend: `http://127.0.0.1:3000`; proxy `/api` configurado no Vite.
- Não registrar valores de `.env`, tokens, senhas ou URLs privadas de banco.

```bash
npm install
npm test
npm run build
npm run create-admin
npm run seed-demo
```

Para desenvolvimento também existem `npm run server` e `npm run dev`.

## 11. Verificações conhecidas

- `npm test`: **35/35 aprovados** após ET-09.
- `npm run build`: **aprovado**; Vite apenas alerta sobre chunk acima de 500 kB.
- ESLint focalizado nos arquivos frontend da ET-09: **aprovado**.
- `npm run lint` global: ainda falha por débitos anteriores em `TimeSlots.tsx`, contextos e telas de autenticação; há também um warning em `AdminSettings.tsx`.
- `git diff --check`: aprovado; Git avisa sobre futura conversão LF→CRLF no Windows.

## 12. Pendências e próxima etapa

- Imediato: preservar e revisar o conjunto não commitado de ET-07/08/09; não confundir erros globais preexistentes de lint com regressão da ET-09.
- Próxima etapa planejada: **ET-10 — disponibilidade por profissional e duração do serviço**; deverá rever consulta de conflitos e o índice global atual.

## 13. Regras de continuidade

- Preservar integralmente as ETs anteriores e o worktree não commitado.
- Não repetir análise ou implementação já concluída.
- Não fazer commit ou push sem solicitação explícita.
- Não ler/expor `.env`, connection strings, tokens, senhas ou outros secrets.
- Manter prompts, relatórios e ETs econômicos em tokens e focados no delta técnico.

## 14. ET-10 concluída — disponibilidade por profissional e duração

- Regra final: horários são intervalos semiabertos `[início, fim)`. Há conflito somente quando `novo_início < existente_fim` e `novo_fim > existente_início`, para o mesmo profissional e apenas entre agendamentos ativos. Profissionais diferentes podem atender simultaneamente.
- A duração usada pelo backend é sempre `services.duration_minutes`, obtida após validar a associação ativa entre serviço e profissional. O valor não é aceito do frontend.
- O atendimento completo precisa respeitar início/fim do expediente, grade configurada, dias permitidos, períodos bloqueados e não pode intersectar o almoço.
- Endpoint público final: `GET /api/availability?date=AAAA-MM-DD&service_id=ID&professional_id=ID`; na edição aceita `ignore_appointment_id` para não bloquear o próprio registro.
- PostgreSQL: o índice global `appointments_active_date_time_unique` é removido. A função/trigger `prevent_appointment_overlap` usa `pg_advisory_xact_lock(hashtext(date))` por transação e repete a regra de sobreposição antes de `INSERT`/`UPDATE`, retornando SQLSTATE `23P01` com a constraint lógica `appointments_no_active_overlap`. A checagem antecipada da API melhora a resposta, mas a trigger é a proteção final contra concorrência.
- Legado: `service_id` e `professional_id` continuam anuláveis, listagens mantêm `LEFT JOIN` e exibição “não informado”. Edições sem nova seleção preservam os nulos; registros legados ativos continuam bloqueando o mesmo horário exato, sem inventar duração ou profissional retroativamente.
- Frontend: `TimeSlots` consulta o endpoint por serviço/profissional e não calcula duração nem disponibilidade localmente; criação e edição enviam `service_id` e `professional_id` quando selecionados.
- Modo demo: aplica duração, intervalos, almoço, expediente e isolamento por profissional em memória, sem acessar ou alterar agendamentos reais.
- Testes ao concluir a ET-10: `npm test` 38/38 aprovado; build aprovado com apenas o aviso conhecido de chunk acima de 500 kB; ESLint focalizado aprovado; `git diff --check` aprovado (avisos LF→CRLF no Windows não são erros).

## 15. ET-11 concluída — Dashboard Gerencial

- Dashboard administrativo disponível em `/admin/dashboard`, como primeira opção da navegação administrativa.
- Endpoint protegido: `GET /api/admin/dashboard`, exclusivo para `admin`, com filtros `today`, `7d`, `30d`, `month` e intervalo personalizado inclusivo por `start`/`end`; datas são validadas no backend e “Hoje” respeita `APP_TIME_ZONE` (padrão `America/Sao_Paulo`).
- KPIs: agendamentos hoje, total e cancelamentos no período, clientes distintos, profissionais ativos, serviços ativos e taxa de cancelamento.
- Visualizações: agendamentos por data, profissional, serviço, dia da semana e horário; clientes com mais agendamentos; distribuição por status.
- Total, rankings e distribuições incluem todos os status reais para análise histórica; cancelamentos e taxa usam `status = 'cancelled'`. Status adicionais são preservados, sem categorias inventadas.
- Registros legados sem profissional/serviço são agrupados como “Não informado”. Clientes são agregados por `user_id`, com fallback nominal apenas para legado.
- Modo demo agrega exclusivamente appointments e catálogo fictícios em memória; o dataset distribui serviços, profissionais, dias, horários e cancelamentos sem consultar appointments reais.
- Não foi adicionada biblioteca gráfica: barras responsivas usam React, Tailwind e CSS, mantendo o bundle e a identidade existentes.
- Verificação da ET-11: `npm test` 43/43 aprovado e ESLint focalizado aprovado; build, audit e `git diff --check` aprovados na validação final.
- Próxima etapa: não iniciada; aguardar definição explícita.
