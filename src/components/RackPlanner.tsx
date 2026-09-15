"use client";

import { useMemo, useRef, useState } from "react";
import BudgetRail from "./BudgetRail";
import CheckPanel from "./CheckPanel";
import { checkRack } from "@/lib/rack/checks";
import { occupiedPositions, occupiedUnits, requiredDepth } from "@/lib/rack/geometry";
import type { DeviceSpec, PlacementSpec, RackSpec } from "@/lib/rack/types";

/**
 * The rack elevation, drawn the way a rack is actually built: U1 at the bottom,
 * because that is where the weight goes and that is how a tech counts.
 *
 * Every edit re-runs checkRack() against the current placements, so the
 * feasibility report and the budget rail are never one drag behind.
 */

interface Placed extends PlacementSpec {
  /** Stable identity across moves, so focus and keys survive a reorder. */
  uid: string;
}

type Drag =
  | { kind: "new"; deviceId: string }
  | { kind: "move"; uid: string; deviceId: string };

export interface RackPlannerProps {
  rack: RackSpec;
  devices: DeviceSpec[];
}

function fmt(value: number | null | undefined, unit: string): string {
  if (value == null) return "—";
  return `${value} ${unit}`;
}

export default function RackPlanner({ rack, devices }: RackPlannerProps) {
  const total = rack.case.rackUnits;

  const deviceMap = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);

  const [placements, setPlacements] = useState<Placed[]>(() =>
    rack.placements.map((p, i) => ({ ...p, uid: `p${i}` })),
  );
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const uidCounter = useRef(0);

  const occupancy = useMemo(() => {
    const map = new Map<number, Placed>();
    for (const p of placements) {
      const device = deviceMap.get(p.deviceId);
      if (!device) continue;
      for (const u of occupiedPositions(device, p.position)) {
        if (!map.has(u)) map.set(u, p);
      }
    }
    return map;
  }, [placements, deviceMap]);

  const report = useMemo(
    () => checkRack({ ...rack, placements }, deviceMap),
    [rack, placements, deviceMap],
  );

  const flagged = useMemo(() => {
    const errPos = new Set<number>();
    const warnPos = new Set<number>();
    const errDev = new Set<string>();
    const warnDev = new Set<string>();
    for (const r of report.results) {
      if (r.severity === "info") continue;
      const positions = r.severity === "error" ? errPos : warnPos;
      const ids = r.severity === "error" ? errDev : warnDev;
      for (const p of r.positions ?? []) positions.add(p);
      for (const id of r.deviceIds ?? []) ids.add(id);
    }
    return { errPos, warnPos, errDev, warnDev };
  }, [report]);

  function canPlace(deviceId: string, start: number, ignoreUid?: string): boolean {
    const device = deviceMap.get(deviceId);
    if (!device || start < 1) return false;
    const positions = occupiedPositions(device, start);
    const top = positions[positions.length - 1];
    if (top == null || top > total) return false;
    return positions.every((u) => {
      const held = occupancy.get(u);
      return held == null || held.uid === ignoreUid;
    });
  }

  function lowestFree(deviceId: string): number | null {
    for (let u = 1; u <= total; u += 1) {
      if (canPlace(deviceId, u)) return u;
    }
    return null;
  }

  function nameOf(deviceId: string): string {
    const d = deviceMap.get(deviceId);
    return d ? `${d.brand} ${d.model}` : deviceId;
  }

  function place(deviceId: string, start: number) {
    if (!canPlace(deviceId, start)) {
      setStatus(`No room for ${nameOf(deviceId)} at U${start}.`);
      return;
    }
    uidCounter.current += 1;
    const uid = `n${uidCounter.current}`;
    setPlacements((prev) => [...prev, { uid, deviceId, position: start, circuit: null }]);
    setStatus(`${nameOf(deviceId)} placed at U${start}. Not yet assigned to a circuit.`);
  }

  function move(uid: string, start: number) {
    const current = placements.find((p) => p.uid === uid);
    if (!current) return;
    if (!canPlace(current.deviceId, start, uid)) {
      setStatus(`U${start} is taken — ${nameOf(current.deviceId)} stays at U${current.position}.`);
      return;
    }
    setPlacements((prev) => prev.map((p) => (p.uid === uid ? { ...p, position: start } : p)));
    setStatus(`${nameOf(current.deviceId)} moved to U${start}.`);
  }

  function remove(uid: string) {
    const current = placements.find((p) => p.uid === uid);
    setPlacements((prev) => prev.filter((p) => p.uid !== uid));
    if (current) setStatus(`${nameOf(current.deviceId)} removed from U${current.position}.`);
  }

  function assignCircuit(uid: string, circuit: string | null) {
    setPlacements((prev) => prev.map((p) => (p.uid === uid ? { ...p, circuit } : p)));
    const current = placements.find((p) => p.uid === uid);
    if (current) {
      setStatus(
        circuit
          ? `${nameOf(current.deviceId)} assigned to circuit ${circuit}.`
          : `${nameOf(current.deviceId)} unassigned from its circuit.`,
      );
    }
  }

  function reset() {
    setPlacements(rack.placements.map((p, i) => ({ ...p, uid: `p${i}` })));
    setStatus("Rack reset to the saved build.");
  }

  function handleDrop(event: React.DragEvent, target: number) {
    event.preventDefault();
    const raw = event.dataTransfer.getData("text/plain");
    const payload: Drag | null = raw.startsWith("new:")
      ? { kind: "new", deviceId: raw.slice(4) }
      : raw.startsWith("move:")
        ? (() => {
            const uid = raw.slice(5);
            const found = placements.find((p) => p.uid === uid);
            return found ? { kind: "move", uid, deviceId: found.deviceId } : null;
          })()
        : drag;
    setDrag(null);
    setHover(null);
    if (!payload) return;
    if (payload.kind === "new") place(payload.deviceId, target);
    else move(payload.uid, target);
  }

  function dropAllowed(target: number): boolean {
    if (!drag) return false;
    return drag.kind === "new"
      ? canPlace(drag.deviceId, target)
      : canPlace(drag.deviceId, target, drag.uid);
  }

  const groups = useMemo(() => {
    const map = new Map<string, DeviceSpec[]>();
    for (const d of devices) {
      const list = map.get(d.category) ?? [];
      list.push(d);
      map.set(d.category, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [devices]);

  // ---------------------------------------------------------------- elevation

  const rows: React.ReactNode[] = [];
  for (let u = total; u >= 1; u -= 1) {
    const held = occupancy.get(u);
    const rowIndex = total - u + 1;

    if (!held) {
      const allowed = dropAllowed(u);
      const isHover = hover === u && allowed;
      rows.push(
        <div
          key={`empty-${u}`}
          style={{ gridRow: `${rowIndex} / span 1` }}
          onDragOver={(e) => {
            if (!allowed) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = drag?.kind === "move" ? "move" : "copy";
            setHover(u);
          }}
          onDragLeave={() => setHover((h) => (h === u ? null : h))}
          onDrop={(e) => handleDrop(e, u)}
          className={`vented flex items-center justify-between border border-dashed px-2 ${
            isHover
              ? "border-accent bg-sunken outline outline-2 outline-accent"
              : drag && allowed
                ? "border-line-strong"
                : "border-line"
          }`}
        >
          <span className="legend">
            {drag && allowed ? `drop at U${u}` : `U${u} · empty`}
          </span>
          {flagged.errPos.has(u) ? (
            <span className="legend text-err">flagged</span>
          ) : null}
        </div>,
      );
      continue;
    }

    const device = deviceMap.get(held.deviceId);
    if (!device) continue;
    const span = occupiedUnits(device);
    const top = held.position + span - 1;
    if (u !== top) continue; // Covered unit — the block was drawn at its top row.

    const topRow = total - top + 1;
    const positions = occupiedPositions(device, held.position);
    const hasError =
      flagged.errDev.has(device.id) || positions.some((p) => flagged.errPos.has(p));
    const hasWarning =
      !hasError &&
      (flagged.warnDev.has(device.id) || positions.some((p) => flagged.warnPos.has(p)));
    const depth = requiredDepth(device);

    rows.push(
      <div
        key={held.uid}
        style={{ gridRow: `${topRow} / span ${span}` }}
        draggable
        tabIndex={0}
        role="group"
        aria-label={`${device.brand} ${device.model}, ${span}U at U${held.position}${
          held.circuit ? `, circuit ${held.circuit}` : ", no circuit"
        }`}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", `move:${held.uid}`);
          setDrag({ kind: "move", uid: held.uid, deviceId: device.id });
        }}
        onDragEnd={() => {
          setDrag(null);
          setHover(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            move(held.uid, held.position + 1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            move(held.uid, held.position - 1);
          } else if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            remove(held.uid);
          }
        }}
        className={`group relative flex cursor-grab items-center gap-2 border bg-raised px-2 ${
          hasError
            ? "border-err bg-err-wash"
            : hasWarning
              ? "border-warn bg-warn-wash"
              : "border-line-strong"
        }`}
      >
        {/* Rack ears: two captive screws per side. */}
        <span aria-hidden className="flex h-full flex-col justify-around py-1">
          <span className="block h-1 w-1 rounded-full bg-[var(--screw)]" />
          <span className="block h-1 w-1 rounded-full bg-[var(--screw)]" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="truncate font-display text-sm font-semibold uppercase tracking-[0.04em]">
              {device.model}
            </span>
            <span className="legend truncate">{device.brand}</span>
            {hasError ? (
              <span className="border border-err px-1 font-mono text-[0.5625rem] uppercase tracking-legend text-err">
                fail
              </span>
            ) : hasWarning ? (
              <span className="border border-warn px-1 font-mono text-[0.5625rem] uppercase tracking-legend text-warn">
                check
              </span>
            ) : null}
          </span>
          <span className="num hidden gap-2 font-mono text-[0.625rem] text-muted sm:flex">
            <span>U{held.position}</span>
            <span>{span}U</span>
            <span>{fmt(depth.requiredMm, "mm")} deep</span>
            <span>{fmt(device.weightLb, "lb")}</span>
            <span>{fmt(device.powerTypicalW ?? device.powerMaxW, "W")}</span>
          </span>
        </span>

        <label className="flex items-center gap-1">
          <span className="sr-only">Circuit for {device.model}</span>
          <select
            value={held.circuit ?? ""}
            onChange={(e) => assignCircuit(held.uid, e.target.value === "" ? null : e.target.value)}
            className="h-6 max-w-[4.75rem] border border-line bg-surface px-1 font-mono text-[0.6875rem] uppercase tracking-legend text-ink sm:max-w-[6.5rem]"
          >
            <option value="">unassigned</option>
            {rack.circuits.map((c) => (
              <option key={c.label} value={c.label}>
                {c.label} · {c.amps}A
              </option>
            ))}
          </select>
        </label>

        <span className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => move(held.uid, held.position + 1)}
            className="flex h-6 w-6 items-center justify-center border border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
            aria-label={`Move ${device.model} up one unit`}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <path d="M1 7 5 3l4 4" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => move(held.uid, held.position - 1)}
            className="flex h-6 w-6 items-center justify-center border border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
            aria-label={`Move ${device.model} down one unit`}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <path d="M1 3 5 7l4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => remove(held.uid)}
            className="flex h-6 w-6 items-center justify-center border border-line bg-surface text-muted hover:border-err hover:text-err"
            aria-label={`Remove ${device.model} from U${held.position}`}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
              <path d="M1 1l8 8M9 1l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        </span>

        <span aria-hidden className="flex h-full flex-col justify-around py-1">
          <span className="block h-1 w-1 rounded-full bg-[var(--screw)]" />
          <span className="block h-1 w-1 rounded-full bg-[var(--screw)]" />
        </span>
      </div>,
    );
  }

  // ------------------------------------------------------------------ render

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_minmax(0,19rem)]">
      {/* Palette */}
      <section className="panel self-start" aria-label="Device catalog">
        <header className="border-b border-line px-3 py-2">
          <h2 className="font-display text-base font-semibold uppercase tracking-[0.06em]">
            Catalog
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Drag a unit onto a free rack space, or use Place to drop it into the lowest one free.
          </p>
          {report.budget.unitsFree <= 0 ? (
            <p className="mt-1.5 border-l-2 border-warn bg-warn-wash px-2 py-1 text-xs text-warn">
              All {total}U are taken. Pull something out of the rack to make room.
            </p>
          ) : null}
        </header>
        <div className="max-h-[38rem] overflow-y-auto">
          {groups.map(([category, list]) => (
            <div key={category} className="border-b border-line last:border-b-0">
              <h3 className="legend sticky top-0 z-10 bg-sunken px-3 py-1.5">{category}</h3>
              <ul>
                {list.map((d) => {
                  const target = lowestFree(d.id);
                  const depth = requiredDepth(d);
                  return (
                    <li key={d.id} className="border-t border-line first:border-t-0">
                      <div
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "copy";
                          e.dataTransfer.setData("text/plain", `new:${d.id}`);
                          setDrag({ kind: "new", deviceId: d.id });
                        }}
                        onDragEnd={() => {
                          setDrag(null);
                          setHover(null);
                        }}
                        className="flex cursor-grab items-center gap-2 px-3 py-2 hover:bg-raised"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-sm font-semibold uppercase tracking-[0.04em]">
                            {d.model}
                          </p>
                          <p className="legend truncate">{d.brand}</p>
                          <p className="num mt-0.5 flex flex-wrap gap-x-2 font-mono text-[0.625rem] text-muted">
                            <span>{occupiedUnits(d)}U</span>
                            <span>{fmt(depth.requiredMm, "mm")}</span>
                            <span>{fmt(d.weightLb, "lb")}</span>
                            <span>
                              {d.passive ? "passive" : fmt(d.powerTypicalW ?? d.powerMaxW, "W")}
                            </span>
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={target == null}
                          onClick={() => {
                            if (target == null) {
                              setStatus(`No free space for ${d.model} in this case.`);
                              return;
                            }
                            place(d.id, target);
                          }}
                          className="shrink-0 border border-line-strong bg-surface px-2 py-1 font-mono text-[0.625rem] uppercase tracking-legend hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:border-line disabled:text-faint"
                          aria-label={
                            target == null
                              ? `No free space for ${d.model}`
                              : `Place ${d.model} at U${target}`
                          }
                        >
                          {target == null ? "full" : `place U${target}`}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Elevation */}
      <section className="min-w-0" aria-label="Rack elevation">
        <div className="panel">
          <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line px-3 py-2.5">
            <div>
              <h2 className="font-display text-lg font-semibold uppercase tracking-[0.05em] leading-none">
                {rack.name}
              </h2>
              <p className="num legend mt-1">
                {rack.case.name} · {total}U · {rack.case.usableDepthMm} mm usable ·{" "}
                {rack.case.hasRearRails ? "front + rear rails" : "front rails only"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`num border px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-legend ${
                  report.errors > 0
                    ? "border-err text-err"
                    : report.warnings > 0
                      ? "border-warn text-warn"
                      : "border-ok text-ok"
                }`}
              >
                {report.errors} fail / {report.warnings} check
              </span>
              <button
                type="button"
                onClick={reset}
                className="border border-line px-2 py-1 font-mono text-[0.625rem] uppercase tracking-legend text-muted hover:border-line-strong hover:text-ink"
              >
                reset
              </button>
            </div>
          </header>

          <div className="flex gap-1.5 p-3">
            {/* U numbering, bottom-origin. */}
            <div
              aria-hidden
              className="grid w-6 shrink-0"
              style={{ gridTemplateRows: `repeat(${total}, var(--u))` }}
            >
              {Array.from({ length: total }, (_, i) => total - i).map((u) => (
                <div key={u} className="num flex items-center justify-end pr-1 font-mono text-[0.625rem] text-faint">
                  {u}
                </div>
              ))}
            </div>

            <div className="flex min-w-0 flex-1 gap-1.5 border border-line-strong bg-sunken p-1.5">
              <div aria-hidden className="rail-strip w-2.5 shrink-0" />
              <div
                className="grid min-w-0 flex-1 gap-px"
                style={{ gridTemplateRows: `repeat(${total}, var(--u))` }}
              >
                {rows}
              </div>
              <div aria-hidden className="rail-strip w-2.5 shrink-0" />
            </div>
          </div>

          <p className="border-t border-line px-3 py-2 text-xs text-muted">
            U1 is the bottom rail. Focus a unit and use the arrow keys to move it a space at a
            time, or Delete to take it out.
          </p>
        </div>

        <div aria-live="polite" className="sr-only">
          {status}
        </div>

        <CheckPanel results={report.results} className="mt-4" />
      </section>

      {/* Budget */}
      <BudgetRail
        budget={report.budget}
        className="self-start lg:col-span-2 xl:col-span-1 xl:sticky xl:top-16"
      />
    </div>
  );
}
