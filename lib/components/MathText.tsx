import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

/**
 * 問題文・模範解答・添削フィードバック等、$...$ / $$...$$ 形式のLaTeXを含む
 * プレーンテキストをレンダリングする共通コンポーネント。
 */
export function MathText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
