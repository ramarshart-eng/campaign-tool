import type { NoteDoc, NoteBlock, InlineNode } from "@/lib/types/notes";

const inlineToString = (node: InlineNode): string => {
  if (node.type === "text") return node.text;
  if (node.type === "entityLink") return node.label || node.entity.label || node.entity.id;
  if (node.type === "inlineDivider") return " ";
  return "";
};

const blockToLines = (block: NoteBlock, lines: string[]) => {
  const fragments: string[] = [];
  if (block.content) {
    block.content.forEach((node) => {
      fragments.push(inlineToString(node));
    });
  }
  if (fragments.length) {
    const joined = fragments.join("").replace(/\s+/g, " ").trim();
    if (joined) lines.push(joined);
  }
  if (block.children) {
    block.children.forEach((child) => blockToLines(child, lines));
  }
};

export const noteDocToPlainText = (doc: NoteDoc | undefined | null): string => {
  if (!doc) return "";
  const lines: string[] = [];
  doc.blocks.forEach((block) => blockToLines(block, lines));
  return lines.join("\n");
};

