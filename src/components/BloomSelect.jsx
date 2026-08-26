import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export default function BloomSelect({
  disabled = false,
  label,
  onChange,
  options,
  value,
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const optionRefs = useRef([]);
  const id = useId();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex] || options[0];

  useEffect(() => {
    if (!open) return undefined;
    setActiveIndex(selectedIndex);
    const focusTimer = window.setTimeout(
      () => optionRefs.current[selectedIndex]?.focus(),
      110,
    );

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector(".bloom-select-trigger")?.focus();
      }
    }

    function closeOnOutsidePointer(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [open, selectedIndex]);

  function openMenu() {
    if (disabled) return;
    setActiveIndex(selectedIndex);
    setOpen(true);
  }

  function selectOption(option) {
    onChange(option.value);
    setOpen(false);
    window.requestAnimationFrame(() =>
      rootRef.current?.querySelector(".bloom-select-trigger")?.focus(),
    );
  }

  function handleTriggerKeyDown(event) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openMenu();
    }
  }

  function handleOptionKeyDown(event, index) {
    let nextIndex = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % options.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + options.length) % options.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = options.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    setActiveIndex(nextIndex);
    optionRefs.current[nextIndex]?.focus();
  }

  if (!selected) return null;
  const SelectedIcon = selected.Icon;

  return (
    <div ref={rootRef} className={`bloom-select ${open ? "is-open" : ""}`}>
      <span id={`${id}-label`} className="bloom-select-label">
        {label}
      </span>
      <div className="bloom-select-surface">
        <button
          type="button"
          className="bloom-select-trigger"
          onClick={openMenu}
          onKeyDown={handleTriggerKeyDown}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${id}-label ${id}-value`}
        >
          <span className="bloom-select-value-icon" aria-hidden="true">
            {SelectedIcon && <SelectedIcon size={17} />}
          </span>
          <span className="bloom-select-value-copy" id={`${id}-value`}>
            <strong>{selected.label}</strong>
            <small>{selected.description}</small>
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>

        <div
          className="bloom-select-panel"
          role="listbox"
          aria-labelledby={`${id}-label`}
          aria-hidden={!open}
          inert={!open ? "" : undefined}
        >
          <header>
            <span>
              <small>Selecionar</small>
              <strong>{label}</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                window.requestAnimationFrame(() =>
                  rootRef.current
                    ?.querySelector(".bloom-select-trigger")
                    ?.focus(),
                );
              }}
              aria-label={`Fechar opções de ${label}`}
              tabIndex={open ? 0 : -1}
            >
              <X size={15} />
            </button>
          </header>
          <div className="bloom-select-grid">
            {options.map((option, index) => {
              const Icon = option.Icon;
              const isSelected = option.value === value;
              const column = index % 2;
              const row = Math.floor(index / 2);
              const rows = Math.ceil(options.length / 2);
              const distance = Math.hypot(column - 0.5, row - (rows - 1) / 2);
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  key={option.value || "empty"}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  className={isSelected ? "is-selected" : ""}
                  style={{ "--bloom-delay": `${100 + distance * 55}ms` }}
                  onClick={() => selectOption(option)}
                  onKeyDown={(event) => handleOptionKeyDown(event, index)}
                  tabIndex={open && activeIndex === index ? 0 : -1}
                >
                  <span className="bloom-select-option-icon" aria-hidden="true">
                    {Icon && <Icon size={18} />}
                  </span>
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                  {isSelected && <Check size={14} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
