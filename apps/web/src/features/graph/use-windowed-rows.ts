import { useCallback, useEffect, useRef, useState, type RefObject, type UIEvent } from 'react';

export interface WindowedRows {
  containerRef: RefObject<HTMLDivElement>;
  /** First rendered row index (inclusive). */
  start: number;
  /** Last rendered row index (exclusive). */
  end: number;
  /** Height of the virtualized list in px. */
  totalHeight: number;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  scrollToIndex: (index: number) => void;
}

/**
 * Minimal fixed-row-height windowing for the commit graph. Keeps the rendered
 * row count bounded for 1000+ commit histories regardless of library support.
 */
export function useWindowedRows(rowCount: number, rowHeight: number, overscan = 10): WindowedRows {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = (): void => setViewportHeight(element.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const onScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const visibleCount = Math.ceil(Math.max(viewportHeight, rowHeight) / rowHeight);
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(rowCount, start + visibleCount + overscan * 2);

  const scrollToIndex = useCallback(
    (index: number) => {
      const element = containerRef.current;
      if (!element) return;
      const top = index * rowHeight;
      const bottom = top + rowHeight;
      if (top < element.scrollTop) {
        element.scrollTop = top;
      } else if (bottom > element.scrollTop + element.clientHeight) {
        element.scrollTop = bottom - element.clientHeight;
      }
    },
    [rowHeight],
  );

  return {
    containerRef,
    start,
    end,
    totalHeight: rowCount * rowHeight,
    onScroll,
    scrollToIndex,
  };
}
