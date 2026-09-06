# 📅 Agenda | Appointment Management System

> 🇺🇸 Web application for appointment scheduling and management.  
> 🇧🇷 Aplicação web para gerenciamento de agendas e agendamentos.

🌐 **Live Demo | Demonstração:**  
https://agenda-seven-ruby.vercel.app/

---

## 🇺🇸 English

### 📌 About the Project

**Agenda** is a full-stack web application designed to support appointment scheduling and management through a simple and practical interface.

The project was developed as a real-world application, combining frontend development, backend services, database integration, authentication and production deployment.

It represents the evolution from a frontend project into a complete web solution with persistent data and server-side functionality.

### ✨ Main Features

- Appointment scheduling and management
- User authentication
- Administrative access
- Persistent data storage
- Backend API integration
- Environment-based configuration
- Production deployment
- Responsive web interface
- Authentication and application security controls

### 🛠 Technologies

**Frontend**

- React
- TypeScript
- Vite
- HTML
- CSS

**Backend**

- Node.js
- REST API

**Database**

- PostgreSQL

**Infrastructure & Deployment**

- Vercel
- Environment variables
- Git / GitHub

### 🏗 Project Structure

```text
Agenda/
├── api/             # API / serverless endpoints
├── public/          # Public assets
├── server/          # Backend services
├── src/             # React application
├── .env.example     # Environment configuration example
├── package.json
├── tsconfig.json
├── vercel.json
└── vite.config.ts
```

---

## 🇧🇷 Português

### 📌 Sobre o Projeto

**Agenda** é uma aplicação web full-stack desenvolvida para gerenciamento de agendas e agendamentos por meio de uma interface simples e prática.

O projeto foi desenvolvido como uma aplicação real, combinando desenvolvimento frontend, serviços de backend, integração com banco de dados, autenticação e publicação em ambiente de produção.

Ele representa a evolução de um projeto inicialmente focado no frontend para uma solução web completa, com persistência de dados e funcionalidades processadas no servidor.

### ✨ Principais Funcionalidades

- Gerenciamento de agendas e agendamentos
- Autenticação de usuários
- Acesso administrativo
- Persistência de dados
- Integração com API backend
- Configuração por variáveis de ambiente
- Publicação em ambiente de produção
- Interface web responsiva
- Controles de autenticação e segurança da aplicação

### 🛠 Tecnologias

**Frontend**

- React
- TypeScript
- Vite
- HTML
- CSS

**Backend**

- Node.js
- REST API

**Banco de Dados**

- PostgreSQL

**Infraestrutura e Deploy**

- Vercel
- Variáveis de ambiente
- Git / GitHub

### 🏗 Estrutura do Projeto

```text
Agenda/
├── api/             # API / endpoints serverless
├── public/          # Arquivos públicos
├── server/          # Serviços de backend
├── src/             # Aplicação React
├── .env.example     # Exemplo de configuração do ambiente
├── package.json
├── tsconfig.json
├── vercel.json
└── vite.config.ts
```

---

## 🌐 Live Demo | Demonstração Online

**Agenda:**  
https://agenda-seven-ruby.vercel.app/

---

## 👨‍💻 Author | Autor

**Camilo Tozzi**

IT Professional focused on ERP, SQL Server, web development and business solutions.

Profissional de TI com foco em ERP, SQL Server, desenvolvimento web e soluções para negócios.
# Agenda

## Instalação de uma nova instância

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie um banco PostgreSQL vazio e um usuário com acesso a ele.
3. Copie `.env.example` para `.env`.
4. Preencha `DATABASE_URL` com a conexão do PostgreSQL.
5. Gere um `JWT_SECRET` forte, longo e exclusivo para a instância.
6. Configure `APP_URL` com a origem do frontend e defina `NODE_ENV`.
7. Prepare as tabelas, configurações e índices iniciando o backend:
   ```bash
   npm run server
   ```
   Após a mensagem de conexão, encerre-o com `Ctrl+C` se precisar usar o mesmo terminal.
8. Preencha `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`, depois crie o primeiro administrador:
   ```bash
   npm run create-admin
   ```
9. Inicie o frontend:
   ```bash
   npm run dev
   ```
10. Acesse a URL mostrada pelo Vite, entre com o administrador criado e abra **Configurações**.
11. Configure nome comercial, logo, horários e os demais parâmetros da instância.
12. Quando e-mails forem necessários, preencha as variáveis `SMTP_*`, reinicie o backend e teste recuperação de senha e confirmação de agendamento. SMTP não é obrigatório para a inicialização básica.
13. Valide a entrega:
   ```bash
   npm run build
   npm test
   ```

O backend falha com uma mensagem clara quando `DATABASE_URL`, `JWT_SECRET` ou `APP_URL` não estão configuradas. O comando `create-admin` nunca usa credenciais padrão e não altera usuários já existentes.

## Ambiente de demonstração

Use exclusivamente um banco PostgreSQL separado, vazio e descartável. Nunca aponte o seed para o banco operacional.

1. Configure uma `DATABASE_URL` específica cujo nome do banco contenha `demo`.
2. Defina `DEMO_MODE=true`.
3. Defina `DEMO_PASSWORD` com a senha temporária dos usuários fictícios.
4. Prepare a estrutura com `npm run server` e execute explicitamente:
   ```bash
   npm run seed-demo
   ```

O seed cria `admin@demo.local`, `mariana@demo.local`, `lucas@demo.local` e `juliana@demo.local`; todos usam a senha informada em `DEMO_PASSWORD`, que não é registrada em logs. A carga é transacional e uma segunda execução é detectada sem duplicar dados.

Não existe `reset-demo`: o modelo atual não identifica propriedade de cada registro com segurança suficiente para remoção automática. Para recomeçar, descarte somente o banco exclusivo da demo e crie outro banco demo vazio.

## Dois modos de demonstração

O **modo demonstração integrado** é ativado somente por um administrador em **Configurações**. O toggle troca a identidade para **Espaço Bem-Estar** e usa clientes e agendamentos fictícios mantidos apenas na memória do backend. Enquanto ele estiver ativo, consultas e alterações de agenda não leem nem gravam agendamentos reais do PostgreSQL. O botão **Restaurar dados fictícios** recompõe imediatamente o conjunto original; reiniciar o backend também descarta todas as alterações temporárias. Desative o toggle para voltar à identidade, configuração e agenda reais, que permanecem preservadas.

Esse recurso é independente do `DEMO_MODE=true` usado pelo `npm run seed-demo`. O **seed técnico** da seção anterior grava dados em um banco PostgreSQL demo separado e descartável; o **modo integrado** não executa o seed e não deve ser confundido com ele.
