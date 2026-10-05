import { memo } from "react";

// Progress updates must never ask React to reconcile the entire rendered document.
export default memo(function MarkdownContent({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
});
