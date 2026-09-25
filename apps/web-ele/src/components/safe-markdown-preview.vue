<script setup lang="ts">
import { computed } from 'vue';

interface MarkdownBlock {
  items: string[];
  kind: 'code' | 'heading' | 'list' | 'paragraph' | 'quote' | 'separator';
  level: number;
  lines: string[];
  ordered: boolean;
  text: string;
}

const props = defineProps<{ source?: null | string }>();

function createBlock(
  kind: MarkdownBlock['kind'],
  values: Partial<Omit<MarkdownBlock, 'kind'>> = {},
): MarkdownBlock {
  return {
    items: [],
    kind,
    level: 1,
    lines: [],
    ordered: false,
    text: '',
    ...values,
  };
}

function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const paragraph: string[] = [];
  let codeLines: string[] | null = null;
  let list: MarkdownBlock | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push(createBlock('paragraph', { text: paragraph.join(' ') }));
      paragraph.length = 0;
    }
  };
  const flushList = () => {
    if (list) blocks.push(list);
    list = null;
  };

  for (const line of source.replaceAll('\r\n', '\n').split('\n')) {
    if (line.trimStart().startsWith('```')) {
      flushParagraph();
      flushList();
      if (codeLines) {
        blocks.push(createBlock('code', { lines: codeLines }));
        codeLines = null;
      } else {
        codeLines = [];
      }
      continue;
    }
    if (codeLines) {
      codeLines.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push(createBlock('heading', {
        level: heading[1]?.length || 1,
        text: heading[2] || '',
      }));
      continue;
    }
    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push(createBlock('separator'));
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      flushList();
      blocks.push(createBlock('quote', { text: quote[1] || '' }));
      continue;
    }
    const unordered = /^\s*[-*+]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      const isOrdered = !!ordered;
      if (!list || list.ordered !== isOrdered) flushList();
      list ||= createBlock('list', { ordered: isOrdered });
      list.items.push((ordered?.[1] || unordered?.[1] || '').trim());
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  if (codeLines) blocks.push(createBlock('code', { lines: codeLines }));
  return blocks;
}

const blocks = computed(() => parseMarkdown(props.source || ''));
</script>

<template>
  <div class="space-y-3 break-words">
    <template v-for="(block, index) in blocks" :key="index">
      <component
        :is="`h${block.level}`"
        v-if="block.kind === 'heading'"
        :class="block.level <= 2 ? 'text-lg font-semibold' : 'font-semibold'"
      >
        {{ block.text }}
      </component>
      <blockquote
        v-else-if="block.kind === 'quote'"
        class="border-l-4 border-gray-300 pl-4 text-gray-600"
      >
        {{ block.text }}
      </blockquote>
      <pre
        v-else-if="block.kind === 'code'"
        class="overflow-auto rounded bg-gray-100 p-3 font-mono text-sm dark:bg-gray-800"
      ><code>{{ block.lines.join('\n') }}</code></pre>
      <ol
        v-else-if="block.kind === 'list' && block.ordered"
        class="list-decimal space-y-1 pl-6"
      >
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex">
          {{ item }}
        </li>
      </ol>
      <ul
        v-else-if="block.kind === 'list'"
        class="list-disc space-y-1 pl-6"
      >
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex">
          {{ item }}
        </li>
      </ul>
      <hr v-else-if="block.kind === 'separator'" class="border-gray-200" />
      <p v-else class="whitespace-pre-wrap leading-6">{{ block.text }}</p>
    </template>
    <span v-if="blocks.length === 0" class="text-gray-400">暂无内容</span>
  </div>
</template>
