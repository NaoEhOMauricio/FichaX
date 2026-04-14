# FichaX - Guia de Segurança Supabase

## 📋 Ordem de Execução

### 1. Executar o SQL

1. Acesse **Dashboard Supabase** → **SQL Editor** → **New Query**
2. Cole o conteúdo do arquivo `supabase-seguranca.sql`
3. **Execute os Passos 1 e 4-7** primeiro (ALTER TABLE + RLS + Policies + Índices)
4. Depois de criar pelo menos 1 usuário, volte e execute os Passos 2 e 3

> ⚠️ **IMPORTANTE**: No Passo 2, substitua `'SEU_USER_ID_AQUI'` pelo UUID real do seu usuário (veja abaixo como encontrar).

---

### 2. Encontrar seu User ID

1. Dashboard → **Authentication** → **Users**
2. Localize seu usuário na lista
3. Copie o **UUID** (formato: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

---

### 3. Configurar Autenticação

#### Senha Mínima
1. Dashboard → **Authentication** → **Providers** → **Email**
2. Em **Minimum password length**, altere para **8** (mínimo recomendado)
3. Clique **Save**

#### Proteção contra Senhas Vazadas
1. Dashboard → **Authentication** → **Attack Protection**
2. Ative **Enable Leaked Password Protection** (HaveIBeenPwned)
3. Clique **Save**

#### Rate Limiting
1. Na mesma tela **Attack Protection**
2. Configure **Rate limit for sending emails** para um valor adequado (ex: 4 por hora)
3. Clique **Save**

---

### 4. Verificar RLS no Table Editor

1. Dashboard → **Table Editor**
2. Clique na tabela **ingredients** s
3. No topo, verifique se aparece **"RLS Enabled"** (badge verde)
4. Clique em **"View Policies"** para confirmar que as 4 policies existem (SELECT, INSERT, UPDATE, DELETE)
5. Repita para a tabela **recipes**

> Se aparecer "RLS Disabled", volte ao SQL Editor e execute o Passo 4 novamente.

---

### 5. Configurar SSL (se disponível no seu plano)

1. Dashboard → **Settings** → **Database**
2. Em **SSL Configuration**, ative **Enforce SSL**
3. Clique **Save**

---

### 6. Revisar API Keys

1. Dashboard → **Settings** → **API**
2. Verifique que você está usando a **anon key** (pública) no app
3. **NUNCA** coloque a **service_role key** no código do app
4. A service_role key deve ser usada **apenas** em servidores backend seguros

---

### 7. Configurar MFA (Opcional, Recomendado)

1. Dashboard → **Authentication** → **Multi-Factor Authentication**
2. Ative **TOTP** (Time-based One-Time Password)
3. Isso permite que usuários configurem autenticação em 2 fatores

---

### 8. Checklist Final

- [x] SQL executado (Passos 1, 4-7)
- [x] Dados existentes vinculados ao user_id (Passo 2)
- [x] user_id obrigatório (Passo 3)
- [x] Senha mínima = 8 caracteres
- [ ] Proteção contra senhas vazadas ativa (requer plano Pro)
- [x] RLS ativo em `ingredients`
- [x] RLS ativo em `recipes`
- [x] 4 policies em cada tabela
- [x] Usando apenas anon key no app
- [x] SSL ativo (HTTPS habilitado por padrão)

---

### Testando a Segurança

Após configurar tudo:

1. **Crie um novo usuário** no app
2. **Adicione ingredientes/receitas** com esse usuário
3. **Crie outro usuário** no app
4. **Verifique** que o segundo usuário NÃO vê os dados do primeiro
5. Se ambos veem os mesmos dados, algo deu errado — verifique as policies no Table Editor
