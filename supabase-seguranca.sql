-- ============================================
-- FICHAX - CONFIGURAÇÃO DE SEGURANÇA SUPABASE
-- ============================================
-- Execute cada bloco no SQL Editor do Supabase:
-- Dashboard > SQL Editor > New Query > Cole e clique "Run"
-- ============================================


-- =============================================
-- PASSO 1: Adicionar coluna user_id nas tabelas
-- =============================================
-- Isso vincula cada ingrediente/receita ao usuário que criou

ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Garantir colunas extras da receita
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS instructions text;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS markup_percent numeric DEFAULT 300;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS total_weight numeric;
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS total_weight_unit text DEFAULT 'g';


-- =============================================
-- PASSO 2: Vincular dados existentes ao seu usuário
-- =============================================
-- IMPORTANTE: Substitua 'SEU_USER_ID_AQUI' pelo seu ID real.
-- Para encontrar seu ID: Dashboard > Authentication > Users > copie o UUID

UPDATE ingredients SET user_id = '40e81343-87f0-41e8-863a-1b95ad027887' WHERE user_id IS NULL;
UPDATE recipes SET user_id = '40e81343-87f0-41e8-863a-1b95ad027887' WHERE user_id IS NULL;


-- =============================================
-- PASSO 3: Tornar user_id obrigatório
-- =============================================
-- Só execute DEPOIS de atualizar os registros existentes (passo 2)

ALTER TABLE ingredients ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE recipes ALTER COLUMN user_id SET NOT NULL;


-- =============================================
-- PASSO 4: Ativar RLS (Row Level Security)
-- =============================================

ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;


-- =============================================
-- PASSO 5: Criar policies para INGREDIENTS
-- =============================================

-- Usuário só vê seus próprios ingredientes
DROP POLICY IF EXISTS "Usuarios veem seus ingredientes" ON ingredients;
CREATE POLICY "Usuarios veem seus ingredientes"
  ON ingredients FOR SELECT
  USING ((select auth.uid()) = user_id);

-- Usuário só insere com seu próprio user_id
DROP POLICY IF EXISTS "Usuarios inserem seus ingredientes" ON ingredients;
CREATE POLICY "Usuarios inserem seus ingredientes"
  ON ingredients FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- Usuário só atualiza seus próprios ingredientes
DROP POLICY IF EXISTS "Usuarios atualizam seus ingredientes" ON ingredients;
CREATE POLICY "Usuarios atualizam seus ingredientes"
  ON ingredients FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Usuário só deleta seus próprios ingredientes
DROP POLICY IF EXISTS "Usuarios deletam seus ingredientes" ON ingredients;
CREATE POLICY "Usuarios deletam seus ingredientes"
  ON ingredients FOR DELETE
  USING ((select auth.uid()) = user_id);


-- =============================================
-- PASSO 6: Criar policies para RECIPES
-- =============================================

DROP POLICY IF EXISTS "Usuarios veem suas receitas" ON recipes;
CREATE POLICY "Usuarios veem suas receitas"
  ON recipes FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Usuarios inserem suas receitas" ON recipes;
CREATE POLICY "Usuarios inserem suas receitas"
  ON recipes FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Usuarios atualizam suas receitas" ON recipes;
CREATE POLICY "Usuarios atualizam suas receitas"
  ON recipes FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Usuarios deletam suas receitas" ON recipes;
CREATE POLICY "Usuarios deletam suas receitas"
  ON recipes FOR DELETE
  USING ((select auth.uid()) = user_id);


-- =============================================
-- PASSO 7: Criar índices para performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_ingredients_user_id ON ingredients(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);
