import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export default function MultiSelectFilter({
  label,
  allLabel,
  emptyLabel,
  countLabel,
  options,
  selectedValues,
  onValuesChange,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const selectAllRef = useRef(null);
  const generatedId = useId();
  const panelId = `multi-filter-${generatedId.replace(/:/g, "")}`;
  const optionValues = useMemo(
    () => options.map((option) => option.value),
    [options],
  );
  const activeValues = selectedValues === null ? optionValues : selectedValues;
  const selectedSet = useMemo(() => new Set(activeValues), [activeValues]);
  const selectedCount = options.filter((option) =>
    selectedSet.has(option.value),
  ).length;
  const allSelected = options.length > 0 && selectedCount === options.length;
  const partiallySelected = selectedCount > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current)
      selectAllRef.current.indeterminate = partiallySelected;
  }, [partiallySelected]);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function toggleOption(value) {
    const next = new Set(activeValues);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    const normalized = optionValues.filter((optionValue) =>
      next.has(optionValue),
    );
    onValuesChange(
      normalized.length === optionValues.length ? null : normalized,
    );
  }

  function toggleAll() {
    onValuesChange(allSelected ? [] : null);
  }

  function summary() {
    if (!options.length || allSelected) return allLabel;
    if (!selectedCount) return emptyLabel;
    if (selectedCount === 1)
      return options.find((option) => selectedSet.has(option.value))?.label;
    const excluded = options.filter((option) => !selectedSet.has(option.value));
    if (excluded.length === 1) return `Exceto ${excluded[0].label}`;
    return `${selectedCount} de ${options.length} ${countLabel}`;
  }

  const summaryText = summary();

  return (
    <div className={`multi-select-filter ${open ? "open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className={`multi-filter-trigger ${
          selectedValues === null ? "" : "is-filtered"
        }`}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="true"
        disabled={!options.length}
        title={summaryText}
        ref={triggerRef}
      >
        <span>{summaryText}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>

      {open && (
        <div className="multi-filter-popover" id={panelId}>
          <header className="multi-filter-heading">
            <strong>{label}</strong>
            <span>
              {selectedCount}/{options.length}
            </span>
          </header>
          <label className="multi-filter-option select-all">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              ref={selectAllRef}
            />
            <span>Selecionar todos</span>
          </label>
          <div className="multi-filter-options">
            {options.map((option) => (
              <label className="multi-filter-option" key={option.value}>
                <input
                  type="checkbox"
                  checked={selectedSet.has(option.value)}
                  onChange={() => toggleOption(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
