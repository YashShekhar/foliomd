import {
  useEffect,
  useRef,
  useMemo,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { List, X } from "lucide-react";
import type { Section } from "../lib/parse";

type Props = {
  sections: Section[];
  pageIndex: number;
  scroller: RefObject<HTMLDivElement | null>;
  open: boolean;
  onClose: () => void;
  onNavigate: (id: string) => void;
};

export default function PageOutline({
  sections,
  pageIndex,
  scroller,
  open,
  onClose,
  onNavigate,
}: Props) {
  const [activeId, setActiveId] = useState("");
  const panel = useRef<HTMLElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [filter, setFilter] = useState("");
  const [viewportHeight, setViewportHeight] = useState(600);
  const minimumLevel = useMemo(
    () =>
      sections.reduce((level, section) => Math.min(level, section.level), 6),
    [sections],
  );
  const filteredSections = useMemo(
    () =>
      sections.filter((section) =>
        section.title.toLowerCase().includes(filter.toLowerCase().trim()),
      ),
    [sections, filter],
  );
  const virtual = filteredSections.length > 150;
  const start = virtual ? Math.max(0, Math.floor(scrollTop / 44) - 5) : 0;
  const visible = virtual
    ? filteredSections.slice(start, start + Math.ceil(viewportHeight / 44) + 10)
    : filteredSections;

  useEffect(() => {
    setFilter("");
    setScrollTop(0);
    if (navigation.current) navigation.current.scrollTop = 0;
  }, [sections]);
  useEffect(() => {
    const nav = navigation.current;
    if (!nav) return;
    const observer = new ResizeObserver(() =>
      setViewportHeight(nav.clientHeight || 600),
    );
    observer.observe(nav);
    return () => observer.disconnect();
  }, [sections.length, open]);

  useEffect(() => {
    const container = scroller.current;
    if (!container) return;
    const headings = sections
      .filter((section) => section.page === pageIndex)
      .map((section) => ({
        id: section.id,
        element: container.querySelector<HTMLElement>(
          `article #${CSS.escape(section.id)}`,
        ),
      }));
    let frame = 0;
    let offsets: number[] = [];
    const previousSection = sections.reduce(
      (previous, section) => (section.page < pageIndex ? section.id : previous),
      "",
    );
    const measure = () => {
      const top = container.getBoundingClientRect().top;
      offsets = headings.map((heading) =>
        heading.element
          ? heading.element.getBoundingClientRect().top -
            top +
            container.scrollTop
          : Infinity,
      );
    };
    const update = () => {
      const readingLine = container.scrollTop + 100;
      let low = 0,
        high = offsets.length - 1,
        active = 0;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (offsets[mid] <= readingLine) {
          active = mid;
          low = mid + 1;
        } else high = mid - 1;
      }
      setActiveId(headings[active]?.id ?? previousSection ?? "");
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    container.addEventListener("scroll", schedule, { passive: true });
    const observer = new ResizeObserver(() => {
      measure();
      schedule();
    });
    observer.observe(container);
    const page = container.querySelector(".reading-page");
    if (page) observer.observe(page);
    measure();
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      container.removeEventListener("scroll", schedule);
    };
  }, [sections, scroller, pageIndex]);

  useEffect(() => {
    if (open && window.matchMedia("(max-width: 1199px)").matches) {
      panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }, [open]);

  useEffect(() => {
    const nav = navigation.current;
    if (!nav) return;
    if (virtual) {
      const index = filteredSections.findIndex(
        (section) => section.id === activeId,
      );
      if (
        index >= 0 &&
        (index * 44 < nav.scrollTop ||
          (index + 1) * 44 > nav.scrollTop + nav.clientHeight)
      ) {
        nav.scrollTop = Math.max(0, index * 44 - 88);
        setScrollTop(nav.scrollTop);
      }
      return;
    }
    const active = nav.querySelector<HTMLElement>('[aria-current="location"]');
    if (!active) return;
    const bounds = nav.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    if (item.top < bounds.top) nav.scrollTop -= bounds.top - item.top;
    else if (item.bottom > bounds.bottom)
      nav.scrollTop += item.bottom - bounds.bottom;
  }, [activeId, open, virtual, filteredSections]);

  return (
    <>
      {open && (
        <button
          className="outline-scrim"
          aria-label="Dismiss section navigation"
          onClick={onClose}
        />
      )}
      <aside
        ref={panel}
        id="page-outline"
        className={`page-outline ${open ? "is-open" : ""}`}
        aria-label="Page sections"
      >
        <div className="outline-heading">
          <span>
            <List size={15} /> On this page
          </span>
          <button
            className="icon-button outline-close"
            aria-label="Close section navigation"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </div>
        {sections.length > 150 && (
          <input
            className="outline-filter"
            aria-label="Find a section"
            placeholder="Find a section…"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setScrollTop(0);
              if (navigation.current) navigation.current.scrollTop = 0;
            }}
          />
        )}
        {sections.length ? (
          <nav
            ref={navigation}
            aria-label="On this page"
            onScroll={(event) => {
              if (virtual) setScrollTop(event.currentTarget.scrollTop);
            }}
          >
            <div
              className={virtual ? "outline-virtual-list" : undefined}
              style={
                virtual ? { height: filteredSections.length * 44 } : undefined
              }
            >
              {visible.map((section, index) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  aria-current={
                    section.id === activeId ? "location" : undefined
                  }
                  style={
                    {
                      "--section-depth": Math.min(
                        4,
                        section.level - minimumLevel,
                      ),
                      ...(virtual
                        ? {
                            position: "absolute",
                            top: (start + index) * 44,
                            height: 44,
                            width: "100%",
                          }
                        : {}),
                    } as CSSProperties
                  }
                  title={section.title}
                  onClick={(event) => {
                    event.preventDefault();
                    onNavigate(section.id);
                    setActiveId(section.id);
                    onClose();
                  }}
                >
                  {section.title}
                </a>
              ))}
            </div>
            {!filteredSections.length && (
              <p className="outline-empty">No matching sections.</p>
            )}
          </nav>
        ) : (
          <p className="outline-empty">No section headings in this chapter.</p>
        )}
        <p className="outline-hint">A little guide to where you are.</p>
      </aside>
    </>
  );
}
