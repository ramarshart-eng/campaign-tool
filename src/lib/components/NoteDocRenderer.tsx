import React from "react";
import { useRouter } from "next/router";
import type {
  NoteDoc,
  NoteBlock,
  InlineNode,
  NoteVisibility,
  EntityRef,
} from "@/lib/types/notes";

export interface NoteDocRendererProps {
  doc: NoteDoc;
  mode: "dm" | "player";
  currentPlayerId?: string | null;
  highlightDmOnly?: boolean;
}

const isBlockVisible = (
  visibility: NoteVisibility | undefined,
  mode: "dm" | "player",
  perPlayerIds: string[] | undefined,
  currentPlayerId?: string | null
): boolean => {
  if (mode === "dm") return true;
  if (!visibility || visibility === "player") return true;
  if (visibility === "dmOnly") return false;
  if (visibility === "perPlayer") {
    if (!currentPlayerId) return false;
    return Array.isArray(perPlayerIds) && perPlayerIds.includes(currentPlayerId);
  }
  return true;
};

const NoteEntityChip: React.FC<{
  entity: EntityRef;
  mode: "dm" | "player";
}> = ({ entity, mode }) => {
  const router = useRouter();
  const label = entity.label || entity.id;

  const navTarget =
    mode === "dm"
      ? (() => {
          switch (entity.kind) {
            case "npc":
            case "faction":
              return {
                pathname: "/prototype/dm-roster",
                query: { entityId: entity.id },
              };
            case "encounter":
              return {
                pathname: "/prototype/dm-encounters",
                query: { encounterId: entity.id },
              };
            case "map":
              return {
                pathname: "/prototype/dm-maps",
                query: { mapId: entity.id },
              };
            case "location":
              return {
                pathname: "/prototype/dm-maps",
                query: { locationId: entity.id },
              };
            case "monster":
              return {
                pathname: "/prototype/dm-play",
                query: { srdMonsterId: entity.id },
              };
            case "note":
              return {
                pathname: "/prototype/dm-notes",
                query: { noteId: entity.id },
              };
            default:
              return null;
          }
        })()
      : null;

  const className = [
    "note-entity-chip",
    navTarget ? "note-entity-chip--actionable" : "",
  ]
    .join(" ")
    .trim();

  if (!navTarget) {
    return (
      <span className={className}>
        <span className="note-entity-chip__kind">{entity.kind}</span>
        <span>{label}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => router.push(navTarget)}
    >
      <span className="note-entity-chip__kind">{entity.kind}</span>
      <span>{label}</span>
    </button>
  );
};

const renderInline = (
  nodes: InlineNode[],
  mode: "dm" | "player"
): React.ReactNode => {
  return nodes.map((n, idx) => {
    if (n.type === "text") {
      let el: React.ReactNode = n.text;
      if (n.marks) {
        n.marks.forEach((m) => {
          if (m.type === "bold") {
            el = <strong>{el}</strong>;
          } else if (m.type === "italic") {
            el = <em>{el}</em>;
          } else if (m.type === "underline") {
            el = <u>{el}</u>;
          } else if (m.type === "strike") {
            el = <s>{el}</s>;
          } else if (m.type === "code") {
            el = <code>{el}</code>;
          } else if (m.type === "link") {
            el = (
              <a href={m.href} target="_blank" rel="noreferrer">
                {el}
              </a>
            );
          }
        });
      }
      return <React.Fragment key={idx}>{el}</React.Fragment>;
    }
    if (n.type === "entityLink") {
      if (mode === "player") {
        return (
          <React.Fragment key={idx}>
            {n.label || n.entity.label || n.entity.id}
          </React.Fragment>
        );
      }
      return (
        <NoteEntityChip
          key={idx}
          entity={{
            ...n.entity,
            label: n.label || n.entity.label,
          }}
          mode={mode}
        />
      );
    }
    if (n.type === "inlineDivider") {
      return (
        <span key={idx} className="note-inline-divider">
          &bull;
        </span>
      );
    }
    return null;
  });
};

const renderBlock = (
  block: NoteBlock,
  key: string | number,
  highlightDmOnly: boolean,
  mode: "dm" | "player"
): React.ReactNode => {
  const classNames = ["note-block"];
  if (block.visibility === "dmOnly") classNames.push("note-block--dm");
  if (highlightDmOnly && block.visibility === "dmOnly")
    classNames.push("note-block--dm-highlight");
  if (block.visibility === "player") classNames.push("note-block--player");
  const className = classNames.join(" ").trim();
  const content = block.content ? renderInline(block.content, mode) : null;
  const children = block.children
    ? block.children.map((b, idx) =>
        renderBlock(b, `${key}-${idx}`, highlightDmOnly, mode)
      )
    : null;

  switch (block.type) {
    case "heading": {
      const level = (block.attrs && "level" in block.attrs && block.attrs.level) || 2;
      if (level === 1) return <h1 key={key} className={className}>{content}</h1>;
      if (level === 2) return <h2 key={key} className={className}>{content}</h2>;
      return <h3 key={key} className={className}>{content}</h3>;
    }
    case "paragraph":
      return (
        <p key={key} className={className}>
          {content}
          {children}
        </p>
      );
    case "quote":
    case "boxedText":
      return (
        <blockquote
          key={key}
          className={`${block.type === "boxedText" ? "note-boxed" : ""} ${className}`.trim()}
        >
          {content}
          {children}
        </blockquote>
      );
    case "bulletList":
      return <ul key={key} className={className}>{children}</ul>;
    case "orderedList":
      return <ol key={key} className={className}>{children}</ol>;
    case "listItem":
      return <li key={key} className={className}>{content || children}</li>;
    case "codeBlock":
      return (
        <pre key={key} className={className}>
          <code>{content}</code>
        </pre>
      );
    case "divider":
      return <hr key={key} className={className} />;
    default:
      return (
        <div key={key} className={`note-block-unknown ${className}`.trim()}>
          {content}
          {children}
        </div>
      );
  }
};

const NoteDocRenderer: React.FC<NoteDocRendererProps> = ({
  doc,
  mode,
  currentPlayerId,
  highlightDmOnly = false,
}) => {
  return (
    <div className="note-doc">
      {doc.blocks
        .filter((b) =>
          isBlockVisible(b.visibility, mode, b.perPlayerIds, currentPlayerId)
        )
        .map((b, idx) => renderBlock(b, idx, highlightDmOnly, mode))}
    </div>
  );
};

export default NoteDocRenderer;
