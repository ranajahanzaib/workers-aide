CREATE INDEX conversations_expiry ON conversations(expires);
CREATE INDEX conversations_status ON conversations(status);
CREATE INDEX counters_expiry ON counters(expires);
CREATE INDEX actions_conversation ON actions(conversation_id);
