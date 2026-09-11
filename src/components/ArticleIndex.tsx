import { useEffect, useState, type RefObject } from "react";

export default function ArticleIndex({ articleRef, articleKey }: { articleRef: RefObject<HTMLElement | null>; articleKey: string }) {
  const [headings, setHeadings] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    const nodes = Array.from(article.querySelectorAll<HTMLElement>("h2, h3")).filter((node) =>
      !node.closest(".standalone-blog-hero, .editorial-index, .related-posts"));
    const items = nodes.map((node, index) => {
      if (!node.id) node.id = `article-section-${articleKey}-${index}`;
      return { id: node.id, title: node.textContent?.trim() || "" };
    }).filter((entry) => entry.title);
    setHeadings(items);
  }, [articleRef, articleKey]);
  if (!headings.length) return null;
  return <details className="editorial-index"><summary>On this page <span>{headings.length} sections</span></summary><nav aria-label="Article contents"><ol>{headings.map((heading) => <li key={heading.id}><a href={`#${heading.id}`}>{heading.title}</a></li>)}</ol></nav></details>;
}
