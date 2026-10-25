# Editing the diagram atlas

Start at the [atlas](../DIAGRAMS.md). Each chapter embeds SVG images so readers do not need a Mermaid-capable Markdown viewer. The matching `.mmd` file is the editable source; do not hand-edit generated SVG geometry. Update the caption, status and source references when semantics change.

## Files

- `sources/`: one Mermaid source per stable C ID, including a title and implementation/planning status.
- `svg/`: self-contained generated previews. Open an SVG directly to zoom into dense drawings.
- `catalog.json`: IDs, titles, chapter ownership, status, descriptions and source/reference paths.
- `render-config.json`: shared neutral theme and readable typography; no remote fonts or resources.
- Chapter Markdown: context and links around the rendered diagrams.

The catalog is an inventory, not a claim about test coverage. Preserve a diagram's ID when updating it. Source/image filenames are stable links: C24 retains its original seven-lane filename while now showing eight lanes; C28/C29 retain historical Render filenames while describing the temporary Vercel demo. Titles, status and captions describe current meaning. If a new diagram answers a distinct question, assign a new ID and update the index; avoid duplicating the same flow just to increase the count.

## Render a changed source

P23-01 used `@mermaid-js/mermaid-cli@12.0.0` with Mermaid `12.2.0`, with the repository's existing Chromium executable. The renderer was installed in a temporary directory; it is not an application dependency or global installation.

With that CLI available, run from the repository root (replace the filename with the source you changed):

```sh
mmdc --input docs/diagrams/sources/c01-system-context.mmd \
  --output docs/diagrams/svg/c01-system-context.svg \
  --configFile docs/diagrams/render-config.json \
  --backgroundColor white --size 1600 --no-font-embed
```

A headless environment may need `--puppeteerConfigFile /absolute/path/to/browser-config.json` with a supported installed Chromium executable. Keep machine-specific paths out of the repository. The exact source and SVG paths for all 30 diagrams are in `catalog.json`.

After rendering, open the affected SVG, check the title/status, labels, arrow directions, branches, grouping and boundaries at normal size and zoom. Keep source text and previews synchronized. Check that captions explain the omitted details and that planned steps remain labeled. Run the repository formatting and documentation-link checks, and record render/semantic review outcomes in task evidence.

The current images are documentation artifacts. No deployment, database access or runtime change occurs when they render.
