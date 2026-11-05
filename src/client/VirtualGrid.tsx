import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

const MIN_COLUMN = 190;
const COLUMN_GAP = 16;
const ROW_GAP = 22;

function columnCount(width: number): number {
  if (width <= 0) return 1;
  return Math.max(1, Math.floor((width + COLUMN_GAP) / (MIN_COLUMN + COLUMN_GAP)));
}

export function VirtualGrid<T>({
  items,
  actionsHeight,
  getKey,
  renderItem,
}: {
  items: T[];
  actionsHeight: number;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);
  const [width, setWidth] = useState(0);
  const [scrollMargin, setScrollMargin] = useState(0);
  const columnWidth = width > 0 ? (width - COLUMN_GAP * (columns - 1)) / columns : MIN_COLUMN;
  const rowHeight = columnWidth * 1.5 + 8 + actionsHeight;

  const rowCount = Math.ceil(items.length / columns);
  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => rowHeight,
    overscan: 2,
    gap: ROW_GAP,
    scrollMargin,
    directDomUpdates: true,
    useCachedMeasurements: true,
    useFlushSync: false,
  });

  useLayoutEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const apply = () => {
      const nextWidth = node.clientWidth;
      const nextColumns = columnCount(nextWidth);
      const nextMargin = node.getBoundingClientRect().top + window.scrollY;
      setWidth((current) => (Math.abs(current - nextWidth) < 0.5 ? current : nextWidth));
      setColumns((current) => (current === nextColumns ? current : nextColumns));
      setScrollMargin((current) => (Math.abs(current - nextMargin) < 0.5 ? current : nextMargin));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    window.addEventListener("resize", apply);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [items.length, actionsHeight]);

  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer, columns, width, actionsHeight, items.length, rowHeight]);

  const rows = virtualizer.getVirtualItems();
  const scrolling = virtualizer.isScrolling;

  return (
    <div ref={frameRef} className="virtual-grid" data-scrolling={scrolling ? "" : undefined}>
      <div ref={virtualizer.containerRef}>
        {rows.map((row) => {
          const from = row.index * columns;
          const rowItems = items.slice(from, from + columns);
          return (
            <div
              key={row.key}
              data-index={row.index}
              ref={virtualizer.measureElement}
              className="virtual-row"
              style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                transform: `translate3d(0, ${row.start - scrollMargin}px, 0)`,
              }}
            >
              {rowItems.map((item) => (
                <div className="entry" key={getKey(item)}>
                  {renderItem(item)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
