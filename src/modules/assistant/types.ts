export interface ReplyAction {
  label: string;
  to: string;
}

export type ReplyKind = "emergency" | "app" | "general" | "formulary";

export interface KitName {
  id: string;
  name: string;
}

export interface AssistantReply {
  text: string;
  draft?: unknown;
  kind?: ReplyKind;
  title?: string;
  steps?: string[];
  actions?: ReplyAction[];
  redFlag?: string;
  badge?: string;
}
