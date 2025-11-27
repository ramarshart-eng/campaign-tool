import type { EntityKind } from "@/lib/types/entityKinds";
export type { EntityKind } from "@/lib/types/entityKinds";

export type NoteVisibility = "dmOnly" | "player" | "perPlayer";

export type NoteScopeType =
  | "global"
  | "campaign"
  | "arc"
  | "session"
  | "scene"
  | "entity";

export type EntitySource = "SRD" | "homebrew" | `module:${string}`;

export interface EntityRef {
  kind: EntityKind;
  id: string;
  source: EntitySource;
  label?: string;
}

export interface Note {
  id: string;
  title: string;
  campaignId?: string | null;
  scopeType: NoteScopeType;
  scopeId?: string | null;
  tags: string[];
  doc: NoteDoc;
  entityRefs: EntityRef[];
  plainText?: string;
  order?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoteDoc {
  version: 1;
  blocks: NoteBlock[];
}

export interface NoteBlock {
  id: string;
  type: NoteBlockType;
  attrs?: NoteBlockAttrs;
  content?: InlineNode[];
  children?: NoteBlock[];
  visibility?: NoteVisibility;
  perPlayerIds?: string[];
}

export type NoteBlockType =
  | "paragraph"
  | "heading"
  | "bulletList"
  | "orderedList"
  | "checklist"
  | "listItem"
  | "quote"
  | "boxedText"
  | "codeBlock"
  | "table"
  | "tableRow"
  | "tableCell"
  | "image"
  | "statBlockEmbed"
  | "mapEmbed"
  | "entityList"
  | "divider";

export type NoteBlockAttrs =
  | HeadingAttrs
  | ListAttrs
  | ChecklistItemAttrs
  | CodeBlockAttrs
  | TableAttrs
  | ImageAttrs
  | StatBlockEmbedAttrs
  | MapEmbedAttrs
  | EntityListAttrs
  | DividerAttrs
  | Record<string, never>;

export interface HeadingAttrs {
  type: "heading";
  level: 1 | 2 | 3;
}

export interface ListAttrs {
  type: "bulletList" | "orderedList";
}

export interface ChecklistItemAttrs {
  type: "checklist" | "listItem";
  checked?: boolean;
}

export interface CodeBlockAttrs {
  type: "codeBlock";
  language?: string;
}

export interface TableAttrs {
  type: "table" | "tableRow" | "tableCell";
  colspan?: number;
  rowspan?: number;
}

export interface ImageAttrs {
  type: "image";
  src: string;
  alt?: string;
  title?: string;
}

export interface StatBlockEmbedAttrs {
  type: "statBlockEmbed";
  entity: EntityRef;
  mode: "live" | "snapshot";
}

export interface MapEmbedAttrs {
  type: "mapEmbed";
  mapId: string;
  zoom?: number;
  focusTokenId?: string;
}

export interface EntityListAttrs {
  type: "entityList";
  entities: EntityRef[];
}

export interface DividerAttrs {
  type: "divider";
}

export type InlineNode = TextNode | EntityLinkNode | InlineDividerNode;

export interface TextNode {
  type: "text";
  text: string;
  marks?: TextMark[];
}

export type TextMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "strike" }
  | { type: "code" }
  | { type: "link"; href: string };

export interface EntityLinkNode {
  type: "entityLink";
  entity: EntityRef;
  label?: string;
}

export interface InlineDividerNode {
  type: "inlineDivider";
}
