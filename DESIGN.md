---
name: Query Clinic
description: A printed diagnostic sheet for comparing database benchmarks.
colors:
  deep-teal: "#0d2823"
  query-teal: "#12342f"
  evidence-green: "#247365"
  evidence-wash: "#eaf3ed"
  candidate-clay: "#a84227"
  clay-wash: "#f9eee8"
  ink: "#172925"
  muted-ink: "#52635b"
  paper: "#f7f8f3"
  panel: "#fff"
  rule: "#d8e0d6"
  tinted-panel: "#edf1e9"
  chrome-ink: "#e9f3eb"
typography:
  display:
    fontFamily: '"Barlow Semi Condensed", "Arial Narrow", sans-serif'
    fontSize: "3.25rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-.018em"
  headline:
    fontFamily: '"Barlow Semi Condensed", "Arial Narrow", sans-serif'
    fontSize: "1.35rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-.025em"
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: ".9rem"
    fontWeight: 700
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: ".875rem"
    lineHeight: 1.55
  reading:
    fontFamily: 'ui-monospace, "SFMono-Regular", Consolas, monospace'
    fontSize: ".85rem"
    fontWeight: 650
  code:
    fontFamily: 'ui-monospace, "SFMono-Regular", Consolas, monospace'
    fontSize: ".85rem"
    lineHeight: 1.65
  label-mono:
    fontFamily: 'ui-monospace, "SFMono-Regular", Consolas, monospace'
    fontSize: ".72rem"
rounded:
  marker: "2px"
  selection: "4px"
  utility: "5px"
  code: "6px"
  panel: "8px"
spacing:
  label: "8px"
  row: "16px"
  section: "32px"
components:
  download-link:
    textColor: "{colors.chrome-ink}"
    rounded: "{rounded.utility}"
    padding: "8px 11px"
  report-tab:
    textColor: "{colors.muted-ink}"
    padding: "16px 1px 14px"
  report-tab-selected:
    textColor: "{colors.ink}"
    padding: "16px 1px 14px"
  timing-track:
    rounded: "{rounded.marker}"
    height: "13px"
  regression-delta:
    backgroundColor: "{colors.clay-wash}"
    textColor: "{colors.candidate-clay}"
    rounded: "{rounded.selection}"
    padding: "7px 9px"
  plan-panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
  operator-row:
    textColor: "{colors.ink}"
    rounded: "{rounded.selection}"
    padding: "7px 8px"
  operator-row-selected:
    backgroundColor: "{colors.evidence-wash}"
    rounded: "{rounded.selection}"
    padding: "7px 8px"
  code-block:
    backgroundColor: "{colors.tinted-panel}"
    typography: "{typography.code}"
    rounded: "{rounded.code}"
    padding: "15px"
---

# Design System: Query Clinic

## Overview

**Creative North Star: "Printed Diagnostic Sheet"**

Query Clinic pairs deep teal chrome with an off-white reading surface. Fine rules and compact columns let a reader move between a result, its measurements, and the evidence behind it.

The sheet gives labels, units, and named plan operators a visible place beside their values. Side-by-side comparisons preserve those cues when they stack on smaller screens.

**Key Characteristics:**

- Dark teal framing and light paper evidence.
- Condensed headings, compact interface text, and monospace measurements.
- Ruled, aligned comparisons with immediate operator inspection.

## Colors

### Primary

- **Deep teal and query teal** frame the utility header and query band on two dark planes.
- **Evidence green and its wash** identify the baseline series and support selection. Use the wash with deep green text and a fine border for the selected operator on either plan.

### Secondary

- **Candidate clay and its wash** identify candidate measurements and a slower outcome. The candidate series retains its clay identity when the outcome uses the green treatment for no slowdown.

### Neutral

- **Paper, white panel, and tinted panel** distinguish the reading canvas, plan trees, and plan headings or code blocks.
- **Ink and muted ink** distinguish values and titles from supporting labels and methodology.
- **Rule and chrome ink** give structure to light surfaces and legibility to utility actions on deep teal.

**The Evidence Color Rule.** Pair every series color with a visible label. Reserve clay for candidate evidence and the slower verdict.

## Typography

- **Display and headings** use the bundled Barlow Semi Condensed at weight 700. The display drops to `2.45rem` on mobile. A compact `1rem` heading labels run details.
- **Interface and body** use the system sans stack. Section descriptions and methodology use the body role. Methodology lines cap at `70ch`.
- **Measurements and code** use the monospace stack. Emphasize the timing values with weight 650 and use the smaller mono role for axis ticks and plan header metadata.

**The Numeric Alignment Rule.** Align timing values at the right edge in monospace and keep each value with its unit.

## Layout

Center the shared frame at up to `1160px` with `36px` gutters where the viewport is narrower than the cap and gutters combined. Use `22px` gutters at `800px` and below, and `16px` at `630px` and below.

The evidence grid uses paired columns with `16px` between them. Above the mobile layout, the plan panels use a shared row grid to align the headers, trees, and inspector sections. At `630px` and below, stack the columns and preserve each side's heading. Stack run details beneath timing and retain the chart's label, track, and value columns.

## Elevation & Depth

Flat fills and one-pixel rules establish depth. The darker header, query band, white tree, and lightly tinted inspector carry hierarchy through color.

**The Ruled Surface Rule.** Use the rule color and a change of fill to define neighboring light surfaces.

## Shapes

Use compact radii. Small chart tracks and series swatches use the marker radius, selected operator rows use the selection radius, and framed plan panels use the panel radius. Plan panels clip their differently tinted header and inspector fills to the same outer edge.

## Components

### Utility download

A compact outlined link with a trailing download icon. Hover fills it with a lighter shade of teal. Keyboard focus uses a mint outline on the dark surface.

### Report tabs

Text tabs sit along a ruled edge. The active tab has an ink label and a two-pixel green underline. Arrow keys, Home, and End move focus and activate the corresponding tab.

### Timing comparison

Names stay visible at the left of the two slim tracks. Values sit to the right and share a single zero-based axis beneath the tracks. The change amount uses a clay wash when timing is slower and a green wash otherwise.

### Plan panel and operator selection

Each panel starts with a series swatch, title, and monospace change description. Branching rules and inset rows convey ancestry. Hover lightly tints a row, and selection adds a green wash and stroke on either side. Selecting a row updates its panel's inspector in place. The inspector displays named fields in two columns under a ruled edge.

### Code block

SQL and sample values sit in a lightly tinted container. Monospace preserves whitespace and wraps long strings at narrow widths.

## Do's and Don'ts

### Do:

- **Do** keep paired evidence on a shared scale and print the measured values alongside it.
- **Do** preserve visible labels as paired columns stack.
- **Do** retain a visible keyboard outline on text tabs and operator rows.

### Don't:

- **Don't** use clay for generic selection or navigation.
- **Don't** give paired timing bars independent scales.
