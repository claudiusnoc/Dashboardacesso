import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, LoaderCircle } from "lucide-react";
import {
  createMasonryLayout,
  getMasonryCardMinHeight,
} from "../lib/masonryLayout";

const INITIAL_ITEMS = 15;
const ITEMS_PER_BATCH = 10;
const LOAD_DELAY_MS = 160;
const defaultGetItemKey = (item) => item.id;

const sameMeasurements = (current, next) => {
  const nextKeys = Object.keys(next);
  const currentKeys = Object.keys(current);

  return (
    nextKeys.length === currentKeys.length &&
    nextKeys.every((key) => Math.abs((current[key] || 0) - next[key]) < 1)
  );
};

export default function InfiniteCaseMasonry({
  items,
  renderItem,
  resetKey,
  getItemKey = defaultGetItemKey,
  ariaLabel = "Casos em cards",
  initialItems = INITIAL_ITEMS,
  itemsPerBatch = ITEMS_PER_BATCH,
}) {
  const containerRef = useRef(null);
  const sentinelRef = useRef(null);
  const itemNodesRef = useRef(new Map());
  const loadTimerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [itemHeights, setItemHeights] = useState({});
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(initialItems, items.length),
  );
  const [loadingMore, setLoadingMore] = useState(false);

  const visibleItems = useMemo(
    () => items.slice(0, Math.min(visibleCount, items.length)),
    [items, visibleCount],
  );
  const visibleKeys = useMemo(
    () => visibleItems.map((item) => String(getItemKey(item))),
    [getItemKey, visibleItems],
  );
  const layout = useMemo(
    () =>
      createMasonryLayout({
        keys: visibleKeys,
        heights: itemHeights,
        width: containerWidth,
      }),
    [containerWidth, itemHeights, visibleKeys],
  );
  const hasMore = visibleItems.length < items.length;
  const remaining = Math.max(0, items.length - visibleItems.length);

  useEffect(() => {
    window.clearTimeout(loadTimerRef.current);
    setVisibleCount(Math.min(initialItems, items.length));
    setLoadingMore(false);
    setItemHeights({});
  }, [initialItems, resetKey]);

  useEffect(() => {
    setVisibleCount((current) => Math.min(current, items.length));
  }, [items.length]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setContainerWidth((current) => {
          const next = container.clientWidth;
          return Math.abs(current - next) < 1 ? current : next;
        });
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useLayoutEffect(() => {
    if (!containerWidth || !visibleKeys.length) return undefined;

    let frame = 0;
    const measureItems = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = {};

        visibleKeys.forEach((key) => {
          const node = itemNodesRef.current.get(key);
          if (node) next[key] = node.getBoundingClientRect().height;
        });

        setItemHeights((current) =>
          sameMeasurements(current, next) ? current : next,
        );
      });
    };

    measureItems();
    const observer = new ResizeObserver(measureItems);
    visibleKeys.forEach((key) => {
      const node = itemNodesRef.current.get(key);
      if (node) observer.observe(node);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [containerWidth, layout.columnWidth, visibleKeys]);

  useEffect(
    () => () => {
      window.clearTimeout(loadTimerRef.current);
    },
    [],
  );

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    window.clearTimeout(loadTimerRef.current);
    loadTimerRef.current = window.setTimeout(() => {
      setVisibleCount((current) =>
        Math.min(current + itemsPerBatch, items.length),
      );
      setLoadingMore(false);
    }, LOAD_DELAY_MS);
  }, [hasMore, items.length, itemsPerBatch, loadingMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || !("IntersectionObserver" in window))
      return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "560px 0px" },
    );
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <section
      className="case-masonry-feed"
      role="feed"
      aria-label={ariaLabel}
      aria-busy={loadingMore}
    >
      <div
        className={`case-masonry-layout ${containerWidth ? "is-ready" : ""}`}
        ref={containerRef}
        style={{ height: containerWidth ? `${layout.height}px` : 0 }}
      >
        {visibleItems.map((item, index) => {
          const key = visibleKeys[index];
          const position = layout.positions[index];
          const cardMinHeight = getMasonryCardMinHeight(index, layout.columns);

          return (
            <div
              className="case-masonry-item"
              ref={(node) => {
                if (node) itemNodesRef.current.set(key, node);
                else itemNodesRef.current.delete(key);
              }}
              role="article"
              aria-posinset={index + 1}
              aria-setsize={items.length}
              key={key}
              style={{
                "--masonry-delay": `${Math.min(index % itemsPerBatch, 7) * 34}ms`,
                "--masonry-card-min-height": `${cardMinHeight}px`,
                width: position?.width ? `${position.width}px` : "100%",
                transform: `translate3d(${position?.x || 0}px, ${position?.y || 0}px, 0)`,
              }}
            >
              <div className="case-masonry-item-reveal">
                {renderItem(item, index)}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={`case-masonry-sentinel ${hasMore ? "has-more" : "is-complete"}`}
        ref={sentinelRef}
      >
        {hasMore ? (
          <button type="button" onClick={loadMore} disabled={loadingMore}>
            <LoaderCircle
              className={loadingMore ? "is-spinning" : ""}
              size={15}
              aria-hidden="true"
            />
            <span>
              {loadingMore
                ? "Preparando mais casos…"
                : `Exibir mais ${Math.min(itemsPerBatch, remaining)} casos`}
            </span>
          </button>
        ) : (
          <span>
            <Check size={14} aria-hidden="true" />
            Todos os {items.length} casos foram exibidos
          </span>
        )}
      </div>

      <span className="sr-only" aria-live="polite" aria-atomic="true">
        Exibindo {visibleItems.length} de {items.length} casos.
      </span>
    </section>
  );
}
