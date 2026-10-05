import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Leaf,
  LoaderCircle,
  Menu,
  Minus,
  Moon,
  PanelLeftClose,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  Type,
  X,
} from "lucide-react";
import { demoBook } from "./lib/demo";
import {
  disposeBook,
  loadFolder,
  readStorage,
  writeStorage,
  type Book,
  type Chapter,
} from "./lib/book";
import { renderPage } from "./lib/render";
import { useBookSearch, useParsedChapter } from "./lib/useReader";
import MarkdownContent from "./components/MarkdownContent";
import { droppedFiles } from "./lib/drop";
import PageOutline from "./components/PageOutline";

type Preferences = {
  theme: "paper" | "sepia" | "night";
  font: "serif" | "sans";
  size: number;
  width: "comfortable" | "wide";
};
type ReadingState = {
  chapter: number;
  positions: Record<string, number>;
  bookmarks: string[];
};
const defaultPreferences: Preferences = {
  theme: "paper",
  font: "serif",
  size: 18,
  width: "comfortable",
};
const initialReading = (): ReadingState => ({
  chapter: 0,
  positions: {},
  bookmarks: [],
});
function getReading(book: Book): ReadingState {
  const saved = readStorage<ReadingState>(
    `folio:reading:${book.id}`,
    initialReading(),
  );
  return {
    chapter: Number.isInteger(saved?.chapter)
      ? Math.max(0, Math.min(saved.chapter, book.chapters.length - 1))
      : 0,
    positions:
      saved?.positions && typeof saved.positions === "object"
        ? saved.positions
        : {},
    bookmarks: Array.isArray(saved?.bookmarks)
      ? saved.bookmarks.filter((value) => typeof value === "string")
      : [],
  };
}

function getPreferences(): Preferences {
  const saved = readStorage<Preferences>(
    "folio:preferences",
    defaultPreferences,
  );
  return {
    theme: ["paper", "sepia", "night"].includes(saved?.theme)
      ? saved.theme
      : "paper",
    font: saved?.font === "sans" ? "sans" : "serif",
    size: Number.isFinite(saved?.size)
      ? Math.max(15, Math.min(24, saved.size))
      : 18,
    width: saved?.width === "wide" ? "wide" : "comfortable",
  };
}

export default function App() {
  const [book, setBook] = useState<Book>(demoBook);
  const [reading, setReading] = useState<ReadingState>(() =>
    getReading(demoBook),
  );
  const [preferences, setPreferences] = useState<Preferences>(getPreferences);
  const [query, setQuery] = useState("");
  const [navTab, setNavTab] = useState<"chapters" | "bookmarks">("chapters");
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 900);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const [pageSelection, setPageSelection] = useState<{
    chapter: Chapter;
    index: number;
  } | null>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const outlineTrigger = useRef<HTMLButtonElement>(null);
  const pendingAnchor = useRef<string | null>(null);
  const restoring = useRef(false);
  const progressTimer = useRef<number | undefined>(undefined);
  const pendingProgress = useRef<{
    book: Book;
    path: string;
    ratio: number;
  } | null>(null);
  const importInProgress = useRef(false);
  const liveBook = useRef(book);
  const liveReading = useRef(reading);
  liveReading.current = reading;
  liveBook.current = book;

  const chapter = book.chapters[reading.chapter];
  const {
    parsed,
    sections,
    busy: parsing,
    error: parseError,
  } = useParsedChapter(chapter);
  const search = useBookSearch(book, query);
  const pageCount = parsed?.pages.length ?? 1;
  const pageIndex = Math.min(
    pageCount - 1,
    Math.max(
      0,
      pageSelection?.chapter === chapter
        ? pageSelection.index
        : Math.floor(
            (Number(reading.positions[chapter.path]) || 0) * pageCount,
          ),
    ),
  );
  const renderedHtml = useMemo(
    () => (parsed ? renderPage(parsed.pages[pageIndex], chapter, book) : ""),
    [parsed, pageIndex, chapter, book],
  );
  const isBookmarked = reading.bookmarks.includes(chapter.path);
  const progress = Math.round(
    (book.chapters.reduce(
      (total, item) =>
        total +
        Math.min(1, Math.max(0, Number(reading.positions[item.path]) || 0)),
      0,
    ) /
      book.chapters.length) *
      100,
  );
  const totalMinutes = book.chapters.reduce(
    (total, item) => total + item.minutes,
    0,
  );
  const matchingChapters = useMemo(
    () =>
      book.chapters
        .map((item, index) => ({ ...item, index }))
        .filter((item) => {
          if (navTab === "bookmarks" && !reading.bookmarks.includes(item.path))
            return false;
          return !query.trim() || search.matches.has(item.index);
        }),
    [book.chapters, navTab, reading.bookmarks, query, search.matches],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
    writeStorage("folio:preferences", preferences);
  }, [preferences]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => writeStorage(`folio:reading:${book.id}`, reading),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [book.id, reading]);

  useEffect(() => {
    document.title = `${chapter.title} — foliomd`;
  }, [chapter.title]);

  useEffect(() => {
    const save = () => {
      const pending = pendingProgress.current;
      const current = liveReading.current;
      writeStorage(
        `folio:reading:${liveBook.current.id}`,
        pending?.book === liveBook.current
          ? {
              ...current,
              positions: {
                ...current.positions,
                [pending.path]: pending.ratio,
              },
            }
          : current,
      );
    };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", save);
    return () => {
      window.clearTimeout(progressTimer.current);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", save);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const jumpToAnchor = useCallback(
    (anchor: string) => {
      let id = anchor;
      try {
        id = decodeURIComponent(anchor);
      } catch {
        /* Use the original if malformed. */
      }
      const section = sections.find((section) => section.id === id);
      if (section && section.page !== pageIndex) {
        restoring.current = true;
        pendingAnchor.current = id;
        setPageSelection({ chapter, index: section.page });
        return true;
      }
      const target = scroller.current?.querySelector<HTMLElement>(
        `article #${CSS.escape(id)}`,
      );
      target?.scrollIntoView({ behavior: "instant", block: "start" });
      return !!target;
    },
    [sections, pageIndex, chapter],
  );

  useEffect(() => {
    const element = scroller.current;
    if (!element || !parsed) return;
    restoring.current = true;
    if (pendingAnchor.current) {
      let anchor = pendingAnchor.current;
      try {
        anchor = decodeURIComponent(anchor);
      } catch {
        /* Keep malformed anchors harmless. */
      }
      const section = sections.find((section) => section.id === anchor);
      if (section && section.page !== pageIndex) {
        setPageSelection({ chapter, index: section.page });
        return;
      }
    }
    // Pin this page so ordinary progress updates do not accidentally turn a page.
    setPageSelection((current) =>
      current?.chapter === chapter && current.index === pageIndex
        ? current
        : { chapter, index: pageIndex },
    );
    const restore = () => {
      if (pendingAnchor.current) {
        jumpToAnchor(pendingAnchor.current);
        pendingAnchor.current = null;
        const distance = element.scrollHeight - element.clientHeight;
        const ratio =
          (pageIndex +
            (distance > 0 ? Math.min(1, element.scrollTop / distance) : 0)) /
          pageCount;
        pendingProgress.current = null;
        setReading((current) => ({
          ...current,
          positions: { ...current.positions, [chapter.path]: ratio },
        }));
      } else {
        const ratio = Math.max(
          0,
          Math.min(
            1,
            (Number(liveReading.current.positions[chapter.path]) || 0) *
              pageCount -
              pageIndex,
          ),
        );
        element.scrollTop =
          ratio * Math.max(0, element.scrollHeight - element.clientHeight);
      }
    };
    const frame = requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(() => {
        restoring.current = false;
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [book.id, chapter, jumpToAnchor, parsed, pageIndex, pageCount, sections]);

  useEffect(() => {
    const handler = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node))
        setSettingsOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, []);

  const navigate = useCallback(
    (index: number, anchor?: string) => {
      if (index < 0 || index >= book.chapters.length) return;
      if (index === reading.chapter) {
        if (anchor) jumpToAnchor(anchor);
        else scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        restoring.current = true;
        pendingAnchor.current = anchor || null;
        setReading((current) => ({ ...current, chapter: index }));
      }
      if (window.innerWidth <= 900) setSidebarOpen(false);
      setOutlineOpen(false);
    },
    [book.chapters.length, reading.chapter, jumpToAnchor],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSidebarOpen(true);
        window.setTimeout(() => searchInput.current?.focus(), 50);
      }
      if (event.key === "Escape") {
        setSettingsOpen(false);
        setOutlineOpen(false);
        if (outlineOpen) outlineTrigger.current?.focus();
        if (window.innerWidth <= 900) setSidebarOpen(false);
      }
      const target = event.target as HTMLElement;
      if (target.matches("input,textarea,select") || target.isContentEditable)
        return;
      if (event.altKey && event.key === "ArrowRight") {
        event.preventDefault();
        navigate(reading.chapter + 1);
      }
      if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        navigate(reading.chapter - 1);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [navigate, reading.chapter, outlineOpen]);

  useEffect(() => {
    let depth = 0;
    const enter = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) {
        event.preventDefault();
        depth++;
        setDragging(true);
      }
    };
    const leave = (event: DragEvent) => {
      event.preventDefault();
      if (--depth <= 0) {
        depth = 0;
        setDragging(false);
      }
    };
    const over = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    const drop = () => {
      depth = 0;
      setDragging(false);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, []);

  const openFiles = async (files: File[]) => {
    if (!files.length || importInProgress.current) return;
    importInProgress.current = true;
    setLoading(true);
    setError("");
    try {
      const nextBook = await loadFolder(files);
      writeStorage(`folio:reading:${liveBook.current.id}`, liveReading.current);
      pendingProgress.current = null;
      restoring.current = true;
      disposeBook(liveBook.current);
      setReading(getReading(nextBook));
      setBook(nextBook);
      setQuery("");
      setNavTab("chapters");
      setNotice(`${nextBook.chapters.length} chapters, ready to read`);
      if (window.innerWidth <= 900) setSidebarOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This folder could not be read. Please try again.",
      );
    } finally {
      importInProgress.current = false;
      setLoading(false);
    }
  };

  const updateProgress = () => {
    if (restoring.current || !scroller.current || !parsed) return;
    const { scrollTop, scrollHeight, clientHeight } = scroller.current;
    const distance = scrollHeight - clientHeight;
    const ratio = distance > 1 ? Math.min(1, scrollTop / distance) : 0;
    pendingProgress.current = {
      book,
      path: chapter.path,
      ratio: (pageIndex + (ratio > 0.98 ? 1 : ratio)) / pageCount,
    };
    if (progressTimer.current !== undefined) return;
    progressTimer.current = window.setTimeout(() => {
      progressTimer.current = undefined;
      const pending = pendingProgress.current;
      pendingProgress.current = null;
      if (!pending || pending.book !== liveBook.current) return;
      setReading((current) =>
        Math.abs((current.positions[pending.path] ?? 0) - pending.ratio) < 0.001
          ? current
          : {
              ...current,
              positions: {
                ...current.positions,
                [pending.path]: pending.ratio,
              },
            },
      );
    }, 120);
  };

  const toggleBookmark = () => {
    setReading((current) => ({
      ...current,
      bookmarks: isBookmarked
        ? current.bookmarks.filter((path) => path !== chapter.path)
        : [...current.bookmarks, chapter.path],
    }));
    setNotice(isBookmarked ? "Bookmark removed" : "Chapter bookmarked");
  };

  const finishChapter = () => {
    pendingProgress.current = null;
    setReading((current) => ({
      ...current,
      positions: { ...current.positions, [chapter.path]: 1 },
    }));
    if (reading.chapter < book.chapters.length - 1)
      navigate(reading.chapter + 1);
    else
      setNotice("You’ve reached the end. A little more room for a new book.");
  };

  const turnPage = (index: number) => {
    if (!parsed || index < 0 || index >= pageCount) return;
    restoring.current = true;
    pendingProgress.current = null;
    pendingAnchor.current = null;
    setReading((current) => ({
      ...current,
      positions: { ...current.positions, [chapter.path]: index / pageCount },
    }));
    setPageSelection({ chapter, index });
  };
  const goForward = () =>
    pageIndex < pageCount - 1 ? turnPage(pageIndex + 1) : finishChapter();

  return (
    <div
      className={`app ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
      style={{ "--reading-size": `${preferences.size}px` } as CSSProperties}
      onDrop={async (event) => {
        event.preventDefault();
        setDragging(false);
        try {
          await openFiles(await droppedFiles(event.dataTransfer));
        } catch {
          setError(
            "That folder could not be opened. Try using the Open folder button.",
          );
        }
      }}
    >
      <input
        ref={folderInput}
        type="file"
        multiple
        {...{ webkitdirectory: "", directory: "" }}
        className="visually-hidden"
        tabIndex={-1}
        aria-label="Select a Markdown folder"
        onChange={(event) => {
          void openFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />

      {sidebarOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close chapter sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className="sidebar" aria-label="Book library" inert={!sidebarOpen}>
        <div className="brand-row">
          <a
            className="brand"
            href="#"
            aria-label="foliomd, back to beginning"
            onClick={(event) => {
              event.preventDefault();
              navigate(0);
            }}
          >
            <BookOpen size={27} strokeWidth={1.7} />
            <span>
              foliomd<span className="brand-dot">.</span>
            </span>
          </a>
          <button
            className="icon-button sidebar-collapse"
            aria-label="Hide sidebar"
            onClick={() => setSidebarOpen(false)}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <div className="library-controls">
          <button
            className="open-folder"
            onClick={() => folderInput.current?.click()}
            disabled={loading}
          >
            {loading ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <FolderOpen size={17} />
            )}
            <span>{loading ? "Opening your book…" : "Open folder"}</span>
            <Plus size={16} />
          </button>
          <p className="drop-hint">or drop a folder anywhere</p>
        </div>
        <div className="book-info">
          <div className="mini-book">
            <BookOpen size={22} strokeWidth={1.4} />
          </div>
          <div>
            <span className="eyebrow">
              {book.demo ? "YOUR FIRST BOOK" : "NOW READING"}
            </span>
            <h2 title={book.title}>{book.title}</h2>
            <span className="book-meta">
              {book.chapters.length} chapters <span>·</span> {totalMinutes} min
              read
            </span>
          </div>
        </div>
        <div
          className="navigation-tabs"
          role="tablist"
          aria-label="Library navigation"
        >
          <button
            role="tab"
            aria-selected={navTab === "chapters"}
            onClick={() => setNavTab("chapters")}
          >
            Contents <span>{book.chapters.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={navTab === "bookmarks"}
            onClick={() => setNavTab("bookmarks")}
          >
            Bookmarks
            {reading.bookmarks.length > 0 && (
              <span>{reading.bookmarks.length}</span>
            )}
          </button>
        </div>
        <label className="search-field">
          <Search size={15} />
          <input
            ref={searchInput}
            aria-label="Search this book"
            placeholder="Search this book…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <button aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={14} />
            </button>
          ) : (
            <kbd>Ctrl K</kbd>
          )}
        </label>
        {query.trim() && (
          <p className="search-count">
            {search.error ||
              (search.busy
                ? "Searching…"
                : `${matchingChapters.length} ${matchingChapters.length === 1 ? "chapter" : "chapters"} found`)}
          </p>
        )}
        <nav
          className="chapter-list"
          aria-label={
            navTab === "chapters" ? "Chapters" : "Bookmarked chapters"
          }
        >
          {matchingChapters.map((item) => (
            <button
              key={item.path}
              className={`chapter-item ${item.index === reading.chapter ? "active" : ""}`}
              aria-current={item.index === reading.chapter ? "page" : undefined}
              onClick={() => navigate(item.index)}
              title={item.path}
            >
              <span className="chapter-number">
                {String(item.index + 1).padStart(2, "0")}
              </span>
              <span className="chapter-item-text">
                {item.title}
                {query.trim() &&
                  !item.title
                    .toLowerCase()
                    .includes(query.toLowerCase().trim()) && (
                    <small>{search.matches.get(item.index)}</small>
                  )}
              </span>
              {reading.positions[item.path] >= 0.98 ? (
                <Check size={13} className="chapter-check" />
              ) : item.index === reading.chapter ? (
                <span className="active-dot" />
              ) : null}
            </button>
          ))}
          {!matchingChapters.length && !search.busy && (
            <div className="empty-state">
              {navTab === "bookmarks" && !query ? (
                <>
                  <Bookmark size={24} />
                  <strong>Keep a page close.</strong>
                  <p>
                    Bookmark a chapter using the ribbon at the top of the
                    reader.
                  </p>
                </>
              ) : (
                <>
                  <Search size={24} />
                  <strong>No chapters found</strong>
                  <p>Try another word or a shorter phrase.</p>
                </>
              )}
            </div>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="progress-label">
            <span>Your reading journey</span>
            <span>{progress}%</span>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Book reading progress"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div style={{ width: `${progress}%` }} />
          </div>
          <div className="privacy-note">
            <ShieldCheck size={14} />
            <span title="Folder names, paths, file contents, and searches stay in your browser. Only preferences and reading progress are saved locally.">
              No uploads. No server storage.
            </span>
          </div>
        </div>
      </aside>

      <main className="reader-shell">
        <header className="topbar">
          <div className="breadcrumb">
            {!sidebarOpen && (
              <button
                className="icon-button"
                aria-label="Show sidebar"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={19} />
              </button>
            )}
            <FolderOpen size={15} />
            <span className="folder-name">{book.folder}</span>
            <ChevronRight size={13} />
            <span className="current-file" title={chapter.path}>
              {chapter.path.split("/").pop()}
            </span>
          </div>
          <div className="reader-tools">
            <span className="local-badge">
              <span />
              Local reading
            </span>
            <div className="tool-divider" />
            <button
              className={`icon-button ${isBookmarked ? "selected" : ""}`}
              aria-label={isBookmarked ? "Remove bookmark" : "Bookmark chapter"}
              aria-pressed={isBookmarked}
              title={isBookmarked ? "Remove bookmark" : "Bookmark chapter"}
              onClick={toggleBookmark}
            >
              <Bookmark
                size={18}
                fill={isBookmarked ? "currentColor" : "none"}
                strokeWidth={1.65}
              />
            </button>
            <div className="settings-anchor" ref={settingsRef}>
              <button
                className={`icon-button ${settingsOpen ? "selected" : ""}`}
                aria-label="Reading settings"
                aria-expanded={settingsOpen}
                title="Reading settings"
                onClick={() => {
                  setSettingsOpen(!settingsOpen);
                  setOutlineOpen(false);
                }}
              >
                <Type size={21} strokeWidth={1.6} />
              </button>
              {settingsOpen && (
                <div
                  className="settings-popover"
                  role="dialog"
                  aria-label="Reading settings"
                >
                  <div className="popover-heading">
                    <strong>Make it your own</strong>
                    <button
                      className="icon-button"
                      aria-label="Close settings"
                      onClick={() => setSettingsOpen(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <span className="setting-label">APPEARANCE</span>
                  <div className="theme-options">
                    {(["paper", "sepia", "night"] as const).map((theme) => (
                      <button
                        key={theme}
                        className={`theme-option ${theme} ${preferences.theme === theme ? "chosen" : ""}`}
                        aria-pressed={preferences.theme === theme}
                        onClick={() =>
                          setPreferences((current) => ({ ...current, theme }))
                        }
                      >
                        {theme === "night" ? (
                          <Moon size={16} />
                        ) : theme === "sepia" ? (
                          <Leaf size={16} />
                        ) : (
                          <Sun size={16} />
                        )}
                        <span>{theme[0].toUpperCase() + theme.slice(1)}</span>
                      </button>
                    ))}
                  </div>
                  <span className="setting-label">TYPEFACE</span>
                  <div className="segmented-control">
                    <button
                      aria-pressed={preferences.font === "serif"}
                      className="serif-option"
                      onClick={() =>
                        setPreferences((current) => ({
                          ...current,
                          font: "serif",
                        }))
                      }
                    >
                      Serif
                    </button>
                    <button
                      aria-pressed={preferences.font === "sans"}
                      onClick={() =>
                        setPreferences((current) => ({
                          ...current,
                          font: "sans",
                        }))
                      }
                    >
                      Sans serif
                    </button>
                  </div>
                  <div className="font-size-control">
                    <span>Text size</span>
                    <div>
                      <button
                        className="icon-button"
                        aria-label="Decrease text size"
                        disabled={preferences.size <= 15}
                        onClick={() =>
                          setPreferences((current) => ({
                            ...current,
                            size: current.size - 1,
                          }))
                        }
                      >
                        <Minus size={16} />
                      </button>
                      <span>{preferences.size}</span>
                      <button
                        className="icon-button"
                        aria-label="Increase text size"
                        disabled={preferences.size >= 24}
                        onClick={() =>
                          setPreferences((current) => ({
                            ...current,
                            size: current.size + 1,
                          }))
                        }
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                  <span className="setting-label">PAGE WIDTH</span>
                  <div className="segmented-control">
                    <button
                      aria-pressed={preferences.width === "comfortable"}
                      onClick={() =>
                        setPreferences((current) => ({
                          ...current,
                          width: "comfortable",
                        }))
                      }
                    >
                      Comfortable
                    </button>
                    <button
                      aria-pressed={preferences.width === "wide"}
                      onClick={() =>
                        setPreferences((current) => ({
                          ...current,
                          width: "wide",
                        }))
                      }
                    >
                      Wide
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              className="icon-button theme-toggle"
              aria-label={
                preferences.theme === "night"
                  ? "Switch to light theme"
                  : "Switch to dark theme"
              }
              title={
                preferences.theme === "night" ? "Light theme" : "Dark theme"
              }
              onClick={() =>
                setPreferences((current) => ({
                  ...current,
                  theme: current.theme === "night" ? "paper" : "night",
                }))
              }
            >
              {preferences.theme === "night" ? (
                <Sun size={18} strokeWidth={1.65} />
              ) : (
                <Moon size={18} strokeWidth={1.65} />
              )}
            </button>
          </div>
        </header>

        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button
              className="icon-button"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={17} />
            </button>
          </div>
        )}
        <div className="reader-body">
          <div
            className="reader-scroller"
            ref={scroller}
            onScroll={updateProgress}
          >
            <div className={`reading-page width-${preferences.width}`}>
              {reading.chapter === 0 && pageIndex === 0 && (
                <section
                  className={`book-cover ${book.demo ? "sample-cover" : ""}`}
                  aria-label="Book introduction"
                >
                  <div className="cover-copy">
                    <div className="cover-label">
                      <span className="little-line" />
                      {book.demo
                        ? "A LITTLE SPACE FOR BIG IDEAS"
                        : "YOUR WORDS, BOUND TOGETHER"}
                    </div>
                    <h1>
                      {book.demo ? (
                        <>
                          The quiet art of
                          <br />
                          paying attention<span>.</span>
                        </>
                      ) : (
                        <>
                          {book.title}
                          <span>.</span>
                        </>
                      )}
                    </h1>
                    <p>
                      {book.demo
                        ? "Notes on slowing down, finding focus, and making room for what matters."
                        : `${book.chapters.length} chapters. One place to slow down and read.`}
                    </p>
                    <div className="cover-byline">
                      <span className="author-avatar">
                        {book.demo ? (
                          <Leaf size={13} />
                        ) : (
                          <FolderOpen size={13} />
                        )}
                      </span>
                      <span>
                        {book.demo
                          ? "The foliomd collection"
                          : "From your local library"}
                      </span>
                      <span className="byline-dot">·</span>
                      <span>
                        {book.demo
                          ? "A sample book"
                          : `${totalMinutes} min read`}
                      </span>
                    </div>
                  </div>
                  <div className="cover-art" aria-hidden="true">
                    <span className="art-top">THE ART OF</span>
                    <span className="art-sun" />
                    <div className="art-arches">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                    <span className="art-bottom">BEING HERE</span>
                    <span className="art-edition">VOL. 01</span>
                  </div>
                </section>
              )}
              <div className="chapter-topline">
                <span className="eyebrow">
                  CHAPTER {String(reading.chapter + 1).padStart(2, "0")}{" "}
                  <span className="chapter-of">
                    / {String(book.chapters.length).padStart(2, "0")}
                  </span>
                </span>
                <div className="chapter-details">
                  <span>{chapter.minutes} min read</span>
                  {sections.length > 0 && (
                    <button
                      ref={outlineTrigger}
                      className="outline-trigger"
                      aria-expanded={outlineOpen}
                      aria-controls="page-outline"
                      onClick={() => {
                        setOutlineOpen(!outlineOpen);
                        setSettingsOpen(false);
                      }}
                    >
                      On this page <ChevronDown size={12} />
                    </button>
                  )}
                </div>
              </div>
              {pageCount > 1 && (
                <div className="chapter-pagination" aria-label="Chapter pages">
                  <span>
                    Page <strong>{pageIndex + 1}</strong> of {pageCount}
                  </span>
                  <span>Continued across reading pages</span>
                </div>
              )}
              {parsing && (
                <div className="chapter-loading" role="status">
                  <LoaderCircle className="spin" size={22} />
                  <p>Preparing your chapter…</p>
                  <span>You can keep browsing while it loads.</span>
                </div>
              )}
              {parseError && (
                <div className="error-banner" role="alert">
                  {parseError}
                </div>
              )}
              {!!parsed?.plainBlocks && (
                <p className="large-block-note">
                  Oversized blocks are continued in smaller pieces. Some complex
                  formatting is shown as plain text.
                </p>
              )}
              <article
                className={`markdown font-${preferences.font}`}
                onClick={(event) => {
                  const target = (
                    event.target as HTMLElement
                  ).closest<HTMLAnchorElement>("a[data-chapter]");
                  if (
                    !target ||
                    event.ctrlKey ||
                    event.metaKey ||
                    event.shiftKey ||
                    event.altKey
                  )
                    return;
                  event.preventDefault();
                  navigate(
                    Number(target.dataset.chapter),
                    target.dataset.anchor,
                  );
                }}
              >
                {parsed && !parsed.hasTitle && pageIndex === 0 && (
                  <h1>{chapter.title}</h1>
                )}
                <MarkdownContent html={renderedHtml} />
              </article>
              <div className="chapter-end">
                <span className="end-ornament">✦</span>
                <p>
                  {pageIndex < pageCount - 1
                    ? "There’s more to this chapter. Turn the page when you’re ready."
                    : reading.chapter === book.chapters.length - 1
                      ? "The end of this book. The beginning of something else."
                      : "A moment to pause. Then, a little further."}
                </p>
                <button
                  className="continue-button"
                  onClick={goForward}
                  disabled={parsing || !!parseError}
                >
                  {pageIndex < pageCount - 1 ? (
                    <>
                      Next page <ArrowRight size={16} />
                    </>
                  ) : reading.chapter === book.chapters.length - 1 ? (
                    <>
                      Finish book <Check size={16} />
                    </>
                  ) : (
                    <>
                      Next chapter <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
              {book.demo && (
                <div className="bring-your-book">
                  <div className="bring-icon">
                    <FolderOpen size={21} strokeWidth={1.5} />
                  </div>
                  <div>
                    <strong>Your next good read is already in a folder.</strong>
                    <p>Turn your Markdown files into a book of your own.</p>
                  </div>
                  <button
                    onClick={() => folderInput.current?.click()}
                    aria-label="Open your own folder"
                  >
                    <ArrowRight size={20} />
                  </button>
                </div>
              )}
              <div className="page-colophon">
                <BookOpen size={14} />
                <span>Made for the joy of reading.</span>
              </div>
            </div>
          </div>
          <PageOutline
            sections={sections}
            pageIndex={pageIndex}
            scroller={scroller}
            open={outlineOpen}
            onNavigate={jumpToAnchor}
            onClose={() => {
              setOutlineOpen(false);
              if (window.innerWidth < 1200)
                outlineTrigger.current?.focus({ preventScroll: true });
            }}
          />
        </div>
        <footer className="reader-footer">
          <button
            className="previous-chapter"
            onClick={() =>
              pageIndex > 0
                ? turnPage(pageIndex - 1)
                : navigate(reading.chapter - 1)
            }
            disabled={reading.chapter === 0 && pageIndex === 0}
          >
            <ArrowLeft size={15} />
            <span>{pageIndex > 0 ? "Previous page" : "Previous chapter"}</span>
          </button>
          <span className="footer-position">
            <span>{String(reading.chapter + 1).padStart(2, "0")}</span>
            <span className="footer-position-line" />
            {String(book.chapters.length).padStart(2, "0")}
          </span>
          <button
            className="next-chapter"
            onClick={goForward}
            disabled={parsing || !!parseError}
          >
            {pageIndex < pageCount - 1 ? (
              <>
                <span>Next page</span>
                <ArrowRight size={15} />
              </>
            ) : reading.chapter === book.chapters.length - 1 ? (
              <>
                <span>Finish book</span>
                <Check size={15} />
              </>
            ) : (
              <>
                <span>Next chapter</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </footer>
      </main>
      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {dragging && (
        <div className="drop-overlay">
          <div>
            <FolderOpen size={40} strokeWidth={1.3} />
            <h2>A new book awaits.</h2>
            <p>Drop your Markdown folder here.</p>
            <ArrowDown size={22} />
          </div>
        </div>
      )}
      {loading && (
        <div className="loading-indicator" role="status">
          <LoaderCircle className="spin" size={16} /> Gathering your chapters…
        </div>
      )}
    </div>
  );
}
