import type {
  EditorState,
  LexicalEditor,
  ElementNode as LexicalElementNode,
  LexicalNode,
} from "lexical";
import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
  ParagraphNode,
  TextNode,
} from "lexical";
import {
  $createHeadingNode,
  $createQuoteNode,
  HeadingNode,
  QuoteNode,
} from "@lexical/rich-text";
import {
  $createListItemNode,
  $createListNode,
  ListItemNode,
  ListNode,
} from "@lexical/list";
import type { ListType } from "@lexical/list";
import type {
  NoteDoc,
  NoteBlock,
  InlineNode,
  TextMark,
  NoteVisibility,
} from "@/lib/types/notes";
import {
  $createEntityLinkNode,
  $isEntityLinkNode,
  EntityLinkNode,
} from "@/lib/components/editor/EntityLinkNode";

const applyMarksToTextNode = (node: TextNode, marks?: TextMark[]) => {
  if (!marks) return;
  marks.forEach((m) => {
    if (m.type === "bold") node.toggleFormat("bold");
    else if (m.type === "italic") node.toggleFormat("italic");
    else if (m.type === "underline") node.toggleFormat("underline");
    else if (m.type === "strike") node.toggleFormat("strikethrough");
    else if (m.type === "code") node.toggleFormat("code");
    // links are handled at block level for now
  });
};

const appendInlineToElement = (
  element: LexicalElementNode,
  content: InlineNode[] | undefined
) => {
  if (!content) return;
  content.forEach((n) => {
    if (n.type === "text") {
      const t = $createTextNode(n.text);
      applyMarksToTextNode(t, n.marks);
      element.append(t);
    } else if (n.type === "entityLink") {
      const node = $createEntityLinkNode(n.entity);
      element.append(node);
      element.append($createTextNode(" "));
    }
  });
};

const applyMetaToElement = (element: LexicalElementNode, block: NoteBlock) => {
  if (block.visibility) {
    (element as unknown as { __noteVisibility?: NoteVisibility }).__noteVisibility =
      block.visibility;
  }
  if (block.perPlayerIds) {
    (element as unknown as { __notePerPlayerIds?: string[] }).__notePerPlayerIds =
      block.perPlayerIds;
  }
};

const blockToLexical = (block: NoteBlock): LexicalElementNode => {
  // Headings
  if (block.type === "heading") {
    const level =
      block.attrs && "level" in block.attrs && block.attrs.level
        ? block.attrs.level
        : 2;
    const heading = $createHeadingNode(`h${level}` as "h1" | "h2" | "h3");
    appendInlineToElement(heading, block.content);
    applyMetaToElement(heading, block);
    return heading;
  }

  // Quotes and boxed text both map to QuoteNode for now
  if (block.type === "quote" || block.type === "boxedText") {
    const quote = $createQuoteNode();
    appendInlineToElement(quote, block.content);
    applyMetaToElement(quote, block);
    return quote;
  }

  // Lists (flat, top-level)
  if (block.type === "bulletList" || block.type === "orderedList") {
    const listType: ListType =
      block.type === "bulletList" ? "bullet" : "number";
    const list = $createListNode(listType);
    (block.children || []).forEach((child) => {
      if (child.type !== "listItem") return;
      const item = $createListItemNode();
      appendInlineToElement(item, child.content);
      list.append(item);
    });
    applyMetaToElement(list, block);
    return list;
  }

  // Fallback: simple paragraph
  const paragraph = $createParagraphNode();
  appendInlineToElement(paragraph, block.content);
  applyMetaToElement(paragraph, block);
  return paragraph;
};

export const noteDocToLexical = (doc: NoteDoc, editor: LexicalEditor) => {
  editor.update(() => {
    const root = $getRoot();
    root.clear();
    doc.blocks.forEach((block) => {
      const node = blockToLexical(block);
      root.append(node);
    });
  });
};

const marksFromTextNode = (node: TextNode): TextMark[] => {
  const marks: TextMark[] = [];
  if (node.hasFormat("bold")) marks.push({ type: "bold" });
  if (node.hasFormat("italic")) marks.push({ type: "italic" });
  if (node.hasFormat("underline")) marks.push({ type: "underline" });
  if (node.hasFormat("strikethrough")) marks.push({ type: "strike" });
  if (node.hasFormat("code")) marks.push({ type: "code" });
  return marks;
};

const inlineFromText = (text: string, marks: TextMark[]): InlineNode[] => {
  const result: InlineNode[] = [];
  result.push({ type: "text", text, marks });
  return result;
};

const collectInlineFromElement = (element: LexicalElementNode): InlineNode[] => {
  const content: InlineNode[] = [];

  const visit = (node: LexicalNode) => {
    if (node instanceof TextNode) {
      const marks = marksFromTextNode(node);
      const text = node.getTextContent();
      const segments = inlineFromText(text, marks);
      content.push(...segments);
      return;
    }
    if ($isEntityLinkNode(node)) {
      content.push({
        type: "entityLink",
        entity: node.getEntity(),
      });
      return;
    }
    if (
      node instanceof ParagraphNode ||
      node instanceof HeadingNode ||
      node instanceof QuoteNode ||
      node instanceof ListItemNode
    ) {
      node.getChildren().forEach(visit);
    }
  };

  element.getChildren().forEach(visit);
  return content;
};

const lexicalElementToBlock = (node: ParagraphNode | HeadingNode): NoteBlock => {
  const content = collectInlineFromElement(node);
  const visibility =
    (node as unknown as { __noteVisibility?: NoteVisibility }).__noteVisibility;
  const perPlayerIds =
    (node as unknown as { __notePerPlayerIds?: string[] }).__notePerPlayerIds;

  if (node instanceof HeadingNode) {
    const tag = node.getTag();
    const level = tag === "h1" ? 1 : tag === "h2" ? 2 : 3;
    return {
      id: node.getKey(),
      type: "heading",
      attrs: { type: "heading", level },
      content,
      visibility,
      perPlayerIds,
    };
  }

  return {
    id: node.getKey(),
    type: "paragraph",
    content,
    visibility,
    perPlayerIds,
  };
};

export const lexicalToNoteDoc = (editorState: EditorState): NoteDoc => {
  const blocks: NoteBlock[] = [];
  editorState.read(() => {
    const root = $getRoot();
    root.getChildren().forEach((node) => {
      if (node instanceof ParagraphNode || node instanceof HeadingNode) {
        blocks.push(lexicalElementToBlock(node));
      } else if (node instanceof QuoteNode) {
        const visibility =
          (node as unknown as { __noteVisibility?: NoteVisibility })
            .__noteVisibility;
        const perPlayerIds =
          (node as unknown as { __notePerPlayerIds?: string[] })
            .__notePerPlayerIds;
        blocks.push({
          id: node.getKey(),
          type: "quote",
          content: collectInlineFromElement(node),
          visibility,
          perPlayerIds,
        });
      } else if (node instanceof ListNode) {
        const listType = node.getListType();
        const visibility =
          (node as unknown as { __noteVisibility?: NoteVisibility })
            .__noteVisibility;
        const perPlayerIds =
          (node as unknown as { __notePerPlayerIds?: string[] })
            .__notePerPlayerIds;
        const listBlock: NoteBlock = {
          id: node.getKey(),
          type: listType === "bullet" ? "bulletList" : "orderedList",
          children: [],
          visibility,
          perPlayerIds,
        };
        node.getChildren().forEach((child) => {
          if (child instanceof ListItemNode) {
            const itemContent = collectInlineFromElement(child);
            listBlock.children!.push({
              id: child.getKey(),
              type: "listItem",
              content: itemContent,
            });
          }
        });
        blocks.push(listBlock);
      }
    });
  });
  return { version: 1, blocks };
};
