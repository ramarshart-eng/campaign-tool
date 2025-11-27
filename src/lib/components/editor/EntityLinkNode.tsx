import React from "react";
import { DecoratorNode } from "lexical";
import type {
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import type { EntityRef } from "@/lib/types/notes";

type SerializedEntityLinkNode = Spread<
  {
    type: "entity-link";
    version: 1;
    entity: EntityRef;
  },
  SerializedLexicalNode
>;

class EntityLinkNode extends DecoratorNode<React.ReactNode> {
  __entity: EntityRef;

  static getType(): string {
    return "entity-link";
  }

  static clone(node: EntityLinkNode): EntityLinkNode {
    return new EntityLinkNode({ ...node.__entity }, node.__key);
  }

  constructor(entity: EntityRef, key?: NodeKey) {
    super(key);
    this.__entity = entity;
  }

  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "note-entity-chip";
    return span;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): React.ReactNode {
    return (
      <span className="note-entity-chip">
        <span className="note-entity-chip__kind">{this.__entity.kind}</span>
        <span>{this.__entity.label || this.__entity.id}</span>
      </span>
    );
  }

  static importJSON(serializedNode: SerializedEntityLinkNode): EntityLinkNode {
    return $createEntityLinkNode(serializedNode.entity);
  }

  exportJSON(): SerializedEntityLinkNode {
    return {
      type: "entity-link",
      version: 1,
      entity: this.__entity,
    };
  }

  getEntity(): EntityRef {
    return this.__entity;
  }
}

export function $createEntityLinkNode(entity: EntityRef): EntityLinkNode {
  return new EntityLinkNode(entity);
}

export function $isEntityLinkNode(
  node: LexicalNode | null | undefined
): node is EntityLinkNode {
  return node instanceof EntityLinkNode;
}

export { EntityLinkNode };

