import { useEffect, useMemo, useRef, useState } from "react";
import type { Book, Chapter } from "./book";
import type { ParsedChapter } from "./parse";
import type { SearchMatch } from "./reader.worker";
import { createReaderWorker, workerRequest } from "./worker-client";

// Cache only a few small chapters. A huge book must not retain many expanded HTML copies.
const cache = new Map<Chapter, ParsedChapter>();
const EMPTY_SECTIONS: ParsedChapter["sections"] = [];
export function useParsedChapter(chapter: Chapter) {
  const [state, setState] = useState<{
    chapter: Chapter;
    parsed?: ParsedChapter;
    error?: string;
  }>();
  useEffect(() => {
    const controller = new AbortController();
    const cached = cache.get(chapter);
    if (cached) {
      setState({ chapter, parsed: cached });
      return;
    }
    void workerRequest<ParsedChapter>(
      { type: "parse", markdown: chapter.markdown },
      controller.signal,
    )
      .then((parsed) => {
        if (controller.signal.aborted) return;
        if (
          parsed.pages.reduce((size, page) => size + page.length, 0) < 1_000_000
        ) {
          if (cache.size >= 3) cache.delete(cache.keys().next().value!);
          cache.set(chapter, parsed);
        }
        setState({ chapter, parsed });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ chapter, error: error.message });
      });
    return () => controller.abort();
  }, [chapter]);
  const current = state?.chapter === chapter ? state : undefined;
  return {
    parsed: current?.parsed,
    sections: current?.parsed?.sections ?? EMPTY_SECTIONS,
    error: current?.error,
    busy: !current?.parsed && !current?.error,
  };
}

export function useBookSearch(book: Book, query: string) {
  const worker = useRef<Worker | null>(null);
  const sequence = useRef(0);
  const [result, setResult] = useState<{
    book: Book;
    query: string;
    matches: SearchMatch[];
  }>();
  const [error, setError] = useState("");
  useEffect(() => {
    const background = createReaderWorker();
    worker.current = background;
    background.onerror = () =>
      setError("Search could not start. Reload to try again.");
    background.postMessage({ type: "index", chapters: book.chapters });
    setError("");
    return () => {
      background.terminate();
      worker.current = null;
    };
  }, [book]);
  useEffect(() => {
    const id = ++sequence.current;
    if (!query.trim()) return;
    const timer = window.setTimeout(() => {
      if (!worker.current) return;
      worker.current.onmessage = ({ data }) => {
        if (data.error) setError(data.error);
        else if (data.id === sequence.current)
          setResult({ book, query, matches: data.matches });
      };
      worker.current.postMessage({ type: "search", query, id });
    }, 140);
    return () => window.clearTimeout(timer);
  }, [book, query]);
  const matches = useMemo(
    () =>
      new Map(
        result?.book === book && result.query === query
          ? result.matches.map((match) => [match.index, match.snippet])
          : [],
      ),
    [book, query, result],
  );
  return {
    matches,
    busy:
      !!query.trim() &&
      !error &&
      (result?.book !== book || result?.query !== query),
    error,
  };
}
