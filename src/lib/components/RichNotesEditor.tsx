import React from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { HeadingNode, QuoteNode, $createHeadingNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { LinkNode } from "@lexical/link";
import { CodeNode } from "@lexical/code";
import type { RangeSelection, ElementNode } from "lexical";
import {
  FORMAT_TEXT_COMMAND,
  $getSelection,
  $isRangeSelection,
  ParagraphNode,
  TextNode,
  $createTextNode,
  $isElementNode,
  $isRootOrShadowRoot,
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $setBlocksType } from "@lexical/selection";
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import type { EditorState } from "lexical";
import type { NoteDoc, NoteVisibility, EntityRef } from "@/lib/types/notes";
import type { DmEntity, EntityKind } from "@/lib/types/dm";
import {
  $createEntityLinkNode,
  EntityLinkNode,
} from "@/lib/components/editor/EntityLinkNode";
import { lexicalToNoteDoc, noteDocToLexical } from "@/lib/utils/noteDocLexical";
import NoteDocRenderer from "@/lib/components/NoteDocRenderer";

export type RichNotesEditorMode = "dm" | "playerPreview";

export interface RichNotesEditorProps {
  doc: NoteDoc;
  onChange: (doc: NoteDoc) => void;
  title: string;
  onTitleChange: (title: string) => void;
  mode?: RichNotesEditorMode;
  readOnly?: boolean;
  entities?: DmEntity[];
  onRequestCreateEntity?: (
    kind: EntityKind,
    onCreated: (entity: DmEntity) => void
  ) => void;
  titleActions?: React.ReactNode;
}

const theme = {
  paragraph: "richnote-p",
  heading: {
    h1: "richnote-h1",
    h2: "richnote-h2",
    h3: "richnote-h3",
  },
  quote: "richnote-quote",
  text: {
    bold: "richnote-bold",
    italic: "richnote-italic",
    underline: "richnote-underline",
    strikethrough: "richnote-strike",
    code: "richnote-code",
  },
  list: {
    listitem: "richnote-li",
    nested: {
      listitem: "richnote-li-nested",
    },
    ol: "richnote-ol",
    ul: "richnote-ul",
  },
  link: "richnote-link",
  code: "richnote-code-block",
};

const defaultConfig = () => ({
  namespace: "RichNotesEditor",
  editable: true,
  theme,
  onError(error: Error) {
    console.error(error);
  },
  nodes: [
    HeadingNode,
    QuoteNode,
    ListNode,
    ListItemNode,
    LinkNode,
    CodeNode,
    ParagraphNode,
    TextNode,
    EntityLinkNode,
  ],
});

const NoteDocInitPlugin: React.FC<{ doc: NoteDoc }> = ({ doc }) => {
  const [editor] = useLexicalComposerContext();

  React.useEffect(() => {
    noteDocToLexical(doc, editor);
    // We intentionally only initialise once per editor instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return null;
};

const getSelectedTopLevelElements = (
  selection: RangeSelection
): ElementNode[] => {
  const nodes = selection.getNodes();
  const topLevel = new Set<ElementNode>();
  nodes.forEach((node) => {
    const element = node.getTopLevelElement();
    if ($isElementNode(element) && !$isRootOrShadowRoot(element)) {
      topLevel.add(element);
    }
  });
  if (topLevel.size === 0) {
    const anchor = selection.anchor.getNode().getTopLevelElement();
    if ($isElementNode(anchor) && !$isRootOrShadowRoot(anchor)) {
      topLevel.add(anchor);
    }
  }
  return Array.from(topLevel);
};

const ToolbarPlugin: React.FC = () => {
  const [editor] = useLexicalComposerContext();
  const [visibility, setVisibility] = React.useState<NoteVisibility>("player");

  const formatText = (
    format: "bold" | "italic" | "underline" | "strikethrough" | "code"
  ) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const setBlockType = (type: "paragraph" | "h1" | "h2" | "h3") => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      if (type === "paragraph") {
        $setBlocksType(selection, () => new ParagraphNode());
      } else {
        $setBlocksType(selection, () =>
          $createHeadingNode(type as "h1" | "h2" | "h3")
        );
      }
    });
  };

  const toggleList = (kind: "bullet" | "number") => {
    const command =
      kind === "bullet"
        ? INSERT_UNORDERED_LIST_COMMAND
        : INSERT_ORDERED_LIST_COMMAND;
    editor.dispatchCommand(command, undefined);
  };

  const removeList = () => {
    editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
  };

  const applyVisibility = (next: NoteVisibility) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const elements = getSelectedTopLevelElements(selection);
      if (!elements.length) return;
      elements.forEach((element) => {
        const writable = element.getWritable();
        (
          writable as unknown as { __noteVisibility?: NoteVisibility }
        ).__noteVisibility = next;
      });
    });
    setVisibility(next);
  };

  React.useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const anchor = selection.anchor.getNode();
        const element = anchor.getTopLevelElement();
        if (!$isElementNode(element)) return;
        const v = (element as unknown as { __noteVisibility?: NoteVisibility })
          .__noteVisibility;
        setVisibility(v || "player");
      });
    });
  }, [editor]);

  return (
    <div className="richnote-toolbar">
      <span
        className={`richnote-visibility-pill visibility-${visibility}`}
        title="Current block visibility"
      >
        {visibility === "dmOnly"
          ? "DM only"
          : visibility === "perPlayer"
          ? "Per-player"
          : "Player"}
      </span>
      <button
        type="button"
        className="richnote-btn"
        onClick={() => formatText("bold")}
      >
        Bold
      </button>
      <button
        type="button"
        className="richnote-btn"
        onClick={() => formatText("italic")}
      >
        Italic
      </button>
      <button
        type="button"
        className="richnote-btn"
        onClick={() => formatText("underline")}
      >
        Underline
      </button>
      <span className="richnote-sep" />
      <button
        type="button"
        className="richnote-btn"
        onClick={() => setBlockType("paragraph")}
      >
        P
      </button>
      <button
        type="button"
        className="richnote-btn"
        onClick={() => setBlockType("h1")}
      >
        H1
      </button>
      <button
        type="button"
        className="richnote-btn"
        onClick={() => setBlockType("h2")}
      >
        H2
      </button>
      <button
        type="button"
        className="richnote-btn"
        onClick={() => setBlockType("h3")}
      >
        H3
      </button>
      <span className="richnote-sep" />
      <button
        type="button"
        className="richnote-btn"
        onClick={() => toggleList("bullet")}
      >
        • List
      </button>
      <button
        type="button"
        className="richnote-btn"
        onClick={() => toggleList("number")}
      >
        1. List
      </button>
      <button type="button" className="richnote-btn" onClick={removeList}>
        Clear list
      </button>
      <span className="richnote-sep" />
      <button
        type="button"
        className={`richnote-btn${visibility === "player" ? " is-active" : ""}`}
        onClick={() => applyVisibility("player")}
      >
        Player
      </button>
      <button
        type="button"
        className={`richnote-btn${visibility === "dmOnly" ? " is-active" : ""}`}
        onClick={() => applyVisibility("dmOnly")}
      >
        DM only
      </button>
    </div>
  );
};

const RichNotesEditor: React.FC<RichNotesEditorProps> = ({
  doc,
  onChange,
  title,
  onTitleChange,
  mode = "dm",
  readOnly = false,
  entities = [],
  onRequestCreateEntity,
}) => {
  const composerConfig = React.useMemo(
    () => ({
      ...defaultConfig(),
      editable: !readOnly,
    }),
    [readOnly]
  );
  const [showDmHighlights, setShowDmHighlights] = React.useState(false);
  const [pendingEntity, setPendingEntity] = React.useState<EntityRef | null>(
    null
  );
  const entityMap = React.useMemo(() => {
    const map = new Map<string, DmEntity>();
    entities.forEach((entity) => map.set(entity.id, entity));
    return map;
  }, [entities]);

  const handleChange = React.useCallback(
    (editorState: EditorState) => {
      const next = lexicalToNoteDoc(editorState);
      onChange(next);
    },
    [onChange]
  );

  const isPreview = mode === "playerPreview";

  const handleSelectEntity = (id: string) => {
    const entity = entityMap.get(id);
    if (!entity) return;
    setPendingEntity({
      kind: entity.kind,
      id: entity.id,
      source: "homebrew",
      label: entity.name,
    });
  };

  return (
    <div className="richnote-root">
      <div className="richnote-header">
        <input
          type="text"
          className="richnote-title-input"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Title"
          aria-label="Note title"
          disabled={readOnly || isPreview}
        />
        <span className="richnote-mode">
          {mode === "dm" ? "DM" : "Preview"}
        </span>
        {mode === "dm" ? (
          <label className="richnote-highlight-toggle">
            <input
              type="checkbox"
              checked={showDmHighlights}
              onChange={(e) => setShowDmHighlights(e.target.checked)}
            />
            Highlight DM blocks
          </label>
        ) : null}
      </div>
      {mode === "dm" && (entities.length > 0 || onRequestCreateEntity) && (
        <div className="richnote-entity-bar">
          <select
            onChange={(e) => {
              if (!e.target.value) return;
              handleSelectEntity(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">Insert entity…</option>
            {entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name} ({entity.kind})
              </option>
            ))}
          </select>
          {onRequestCreateEntity ? (
            <div className="richnote-entity-buttons">
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  onRequestCreateEntity("npc", (entity) =>
                    handleSelectEntity(entity.id)
                  )
                }
              >
                + NPC
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() =>
                  onRequestCreateEntity("location", (entity) =>
                    handleSelectEntity(entity.id)
                  )
                }
              >
                + Location
              </button>
            </div>
          ) : null}
        </div>
      )}
      {isPreview ? (
        <div className="richnote-preview">
          <NoteDocRenderer doc={doc} mode="player" />
        </div>
      ) : (
        <div className="richnote-editor-frame">
          <LexicalComposer initialConfig={composerConfig}>
            <NoteDocInitPlugin doc={doc} />
            <ToolbarPlugin />
            <EntityInsertPlugin
              entity={pendingEntity}
              onInserted={() => setPendingEntity(null)}
            />
            <RichTextPlugin
              contentEditable={
                <ContentEditable className="richnote-editable" />
              }
              placeholder={
                <div className="richnote-placeholder">
                  Write your note here&hellip;
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <ListPlugin />
            <LinkPlugin />
            <OnChangePlugin onChange={handleChange} />
          </LexicalComposer>
          {showDmHighlights && (
            <div className="richnote-preview" style={{ marginTop: "1rem" }}>
              <NoteDocRenderer doc={doc} mode="dm" highlightDmOnly />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RichNotesEditor;

const EntityInsertPlugin: React.FC<{
  entity: EntityRef | null;
  onInserted: () => void;
}> = ({ entity, onInserted }) => {
  const [editor] = useLexicalComposerContext();

  React.useEffect(() => {
    if (!entity) return;
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const node = $createEntityLinkNode(entity);
      selection.insertNodes([node, $createTextNode(" ")]);
    });
    onInserted();
  }, [editor, entity, onInserted]);

  return null;
};
