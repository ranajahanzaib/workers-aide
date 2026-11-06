PRAGMA foreign_keys = ON;
CREATE TABLE settings (id TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO settings VALUES ('business','{"name":"Your business","description":"","industry":"","email":"","phone":"","address":"","hours":"","services":"","website":"","timezone":"UTC","retentionDays":30,"fallback":"AI is unavailable. You can leave a contact request below.","widgetColor":"#265b48","widgetPosition":"right","widgetTheme":"light","allowedOrigins":[]}');
INSERT INTO settings VALUES ('agent','{"id":"default","name":"Business assistant","description":"Your helpful business assistant","enabled":false,"template":"general","instructions":"Be concise, kind, and helpful.","welcomeMessage":"Hello. How can I help you today?","enabledTools":["searchKnowledge","getBusinessInformation","captureLead","requestAppointment","requestHumanHandoff"],"model":"@cf/zai-org/glm-4.7-flash","maxOutputTokens":512,"maxToolSteps":3,"dailyAIRequests":100,"maxMessages":40}');
CREATE TABLE sessions (hash TEXT PRIMARY KEY, secret_hash TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires);
CREATE TABLE conversations (id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, token_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), expires INTEGER NOT NULL);
CREATE INDEX conversations_created ON conversations(created_at);
CREATE TABLE knowledge (id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, category TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE VIRTUAL TABLE knowledge_fts USING fts5(title,content,content='knowledge',content_rowid='rowid');
CREATE TRIGGER knowledge_ai AFTER INSERT ON knowledge BEGIN INSERT INTO knowledge_fts(rowid,title,content) VALUES(new.rowid,new.title,new.content); END;
CREATE TRIGGER knowledge_ad AFTER DELETE ON knowledge BEGIN INSERT INTO knowledge_fts(knowledge_fts,rowid,title,content) VALUES('delete',old.rowid,old.title,old.content); END;
CREATE TRIGGER knowledge_au AFTER UPDATE ON knowledge BEGIN INSERT INTO knowledge_fts(knowledge_fts,rowid,title,content) VALUES('delete',old.rowid,old.title,old.content); INSERT INTO knowledge_fts(rowid,title,content) VALUES(new.rowid,new.title,new.content); END;
CREATE TABLE actions (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, tool TEXT NOT NULL, input TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX actions_tool_created ON actions(tool,created_at);
CREATE TABLE counters (key TEXT PRIMARY KEY, value INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE events (id TEXT PRIMARY KEY, event TEXT NOT NULL, conversation_id TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX events_created ON events(created_at);

