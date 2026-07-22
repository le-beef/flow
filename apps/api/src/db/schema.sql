CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), phone text UNIQUE NOT NULL, name text,
  last_greeting_at timestamptz, automation_paused boolean NOT NULL DEFAULT false,
  automation_paused_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'bot' CHECK(status IN ('bot','waiting','human','closed')),
  assigned_to text, unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_conversation ON conversations(customer_id) WHERE status <> 'closed';
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  evolution_id text UNIQUE, direction text NOT NULL CHECK(direction IN ('in','out')),
  sender text NOT NULL CHECK(sender IN ('customer','bot','agent')), type text NOT NULL DEFAULT 'text',
  content text NOT NULL DEFAULT '', media_url text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, keywords text[] NOT NULL,
  response text NOT NULL, media_type text, media_url text, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS triggers_name_unique ON triggers(name);
CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), option_number integer UNIQUE NOT NULL, label text NOT NULL,
  response text NOT NULL, action text NOT NULL DEFAULT 'reply' CHECK(action IN ('reply','human')),
  media_type text, media_url text, active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS tags (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text UNIQUE NOT NULL, color text NOT NULL DEFAULT '#22c55e');
CREATE TABLE IF NOT EXISTS customer_tags (customer_id uuid REFERENCES customers(id) ON DELETE CASCADE, tag_id uuid REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY(customer_id,tag_id));
CREATE TABLE IF NOT EXISTS quick_replies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shortcut text UNIQUE NOT NULL, title text NOT NULL, content text NOT NULL, active boolean NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,email text UNIQUE NOT NULL,password_hash text NOT NULL,role text NOT NULL DEFAULT 'agent' CHECK(role IN ('admin','agent')),active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
CREATE TABLE IF NOT EXISTS audit_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES users(id),action text NOT NULL,entity text,entity_id text,details jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS conversation_notes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,user_id uuid REFERENCES users(id),content text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS system_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),level text NOT NULL DEFAULT 'info',source text NOT NULL,event text NOT NULL,message text NOT NULL,details jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS system_logs_created_idx ON system_logs(created_at DESC);
CREATE TABLE IF NOT EXISTS outbound_queue (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),message_id uuid REFERENCES messages(id) ON DELETE CASCADE,phone text NOT NULL,text text NOT NULL,media_type text,media_url text,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','sent','failed')),attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),last_error text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE messages ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS agent_user_id uuid REFERENCES users(id);
ALTER TABLE triggers ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_auto_response_at timestamptz;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS automation_paused_until timestamptz;
CREATE TABLE IF NOT EXISTS license_activation (id boolean PRIMARY KEY DEFAULT true CHECK(id),license_id text UNIQUE NOT NULL,license_key text NOT NULL,customer text NOT NULL,installation_id text NOT NULL,issued_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,activated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO settings(key,value) VALUES ('installation_id',to_jsonb(gen_random_uuid()::text)) ON CONFLICT(key) DO NOTHING;
INSERT INTO settings(key,value) VALUES ('installation_created_at',to_jsonb(now()::text)) ON CONFLICT(key) DO NOTHING;
INSERT INTO settings(key,value) VALUES ('fallback_message','"Não entendi sua mensagem. Digite menu para ver as opções ou aguarde um atendente."'),('fallback_enabled','false'),('automation_cooldown_seconds','3') ON CONFLICT(key) DO NOTHING;
INSERT INTO settings(key,value) VALUES ('setup_completed','false') ON CONFLICT(key) DO NOTHING;

INSERT INTO settings(key,value) VALUES
('greeting', '"Olá! Seja bem-vindo ao Le Beef 🍔\n\nEscolha uma opção:\n\n1️⃣ Fazer um pedido\n2️⃣ Ver o cardápio\n3️⃣ Horário de funcionamento\n4️⃣ Taxa de entrega\n5️⃣ Falar com um atendente"'),
('business_hours', '{"timezone":"America/Sao_Paulo","days":{"1":["18:00","23:00"],"2":["18:00","23:00"],"3":["18:00","23:00"],"4":["18:00","23:00"],"5":["18:00","23:59"],"6":["18:00","23:59"]}}'),
('closed_message', '"Olá! No momento estamos fechados. Retornaremos no próximo horário de funcionamento."'),
('automation_enabled', 'true') ON CONFLICT(key) DO NOTHING;
INSERT INTO menu_items(option_number,label,response,action) VALUES
(1,'Fazer um pedido','Ótimo! Envie os itens e quantidades que deseja pedir.','reply'),
(2,'Ver o cardápio','Confira nosso cardápio: https://seulink.com','reply'),
(3,'Horário de funcionamento','Funcionamos de segunda a sábado, das 18h às 23h.','reply'),
(4,'Taxa de entrega','Informe seu bairro para consultarmos a taxa de entrega.','reply'),
(5,'Falar com um atendente','Certo! Você será atendido por uma pessoa em instantes.','human') ON CONFLICT(option_number) DO NOTHING;
INSERT INTO tags(name,color) VALUES ('Novo Cliente','#22c55e'),('Cliente VIP','#f59e0b') ON CONFLICT(name) DO NOTHING;
INSERT INTO triggers(name,keywords,response) VALUES
('Cardápio',ARRAY['cardápio','cardapio','menu','ver os preços','ver preços'],'Confira nosso cardápio: https://seulink.com'),
('Fazer pedido',ARRAY['quero pedir','fazer pedido','fazer um pedido','quero fazer um pedido','gostaria de pedir'],'Ótimo! Confira nosso cardápio e envie os itens que deseja: https://seulink.com'),
('Horário',ARRAY['horário','horario','está aberto','esta aberto','aberto hoje'],'Funcionamos de segunda a sábado, das 18h às 23h.'),
('PIX',ARRAY['pix','chave pix','pagar no pix'],'Nossa chave PIX é: configure-a no painel administrativo.'),
('Endereço',ARRAY['endereço','endereco','localização','localizacao','onde fica'],'Estamos em: configure seu endereço no painel administrativo.')
ON CONFLICT(name) DO NOTHING;
