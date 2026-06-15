---
name: json-canvas
description: Create and edit JSON Canvas files (.canvas) with nodes, edges, groups, and connections. Use when working with .canvas files, creating visual canvases, mind maps, flowcharts, or when the user mentions Canvas files in Obsidian.
---

# JSON Canvas Skill

## File Structure

A canvas file (`.canvas`) contains two top-level arrays following the [JSON Canvas Spec 1.0](https://jsoncanvas.org/spec/1.0/):

```json
{
  "nodes": [],
  "edges": []
}
```

## Common Workflows

### Create a New Canvas

1. Create a `.canvas` file with `{"nodes": [], "edges": []}`
2. Generate unique 16-character hex IDs for each node (e.g., `"6f0ad84f44ce9c17"`)
3. Add nodes with required fields: `id`, `type`, `x`, `y`, `width`, `height`
4. Add edges referencing valid node IDs via `fromNode` and `toNode`
5. Validate: parse JSON, verify all `fromNode`/`toNode` exist in nodes array

## Nodes

Array order = z-index (first = bottom layer, last = top layer).

### Generic Node Attributes

| Attribute | Required | Type | Description |
|-----------|----------|------|-------------|
| `id` | Yes | string | Unique 16-char hex |
| `type` | Yes | string | `text`, `file`, `link`, or `group` |
| `x` | Yes | integer | X position in pixels |
| `y` | Yes | integer | Y position in pixels |
| `width` | Yes | integer | Width in pixels |
| `height` | Yes | integer | Height in pixels |
| `color` | No | canvasColor | Preset `"1"`-`"6"` or hex `"#FF0000"` |

### Text Nodes

```json
{
  "id": "6f0ad84f44ce9c17",
  "type": "text",
  "x": 0, "y": 0, "width": 400, "height": 200,
  "text": "# Hello World\n\nThis is **Markdown** content."
}
```

**Newline pitfall**: Use `\n` in JSON strings, NOT `\\n`.

### File Nodes

```json
{
  "id": "a1b2c3d4e5f67890",
  "type": "file",
  "x": 500, "y": 0, "width": 400, "height": 300,
  "file": "10-Projetos/Agrotrack-Novo.md",
  "subpath": "#Key Insights"
}
```

### Link Nodes

```json
{
  "id": "c3d4e5f678901234",
  "type": "link",
  "x": 1000, "y": 0, "width": 400, "height": 200,
  "url": "https://example.com"
}
```

### Group Nodes

```json
{
  "id": "d4e5f6789012345a",
  "type": "group",
  "x": -50, "y": -50, "width": 1000, "height": 600,
  "label": "Project Overview",
  "color": "4"
}
```

## Edges

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `id` | Yes | — | Unique identifier |
| `fromNode` | Yes | — | Source node ID |
| `fromSide` | No | — | `top`, `right`, `bottom`, `left` |
| `fromEnd` | No | `none` | `none` or `arrow` |
| `toNode` | Yes | — | Target node ID |
| `toSide` | No | — | `top`, `right`, `bottom`, `left` |
| `toEnd` | No | `arrow` | `none` or `arrow` |
| `color` | No | — | Line color |
| `label` | No | — | Text label |

```json
{
  "id": "0123456789abcdef",
  "fromNode": "6f0ad84f44ce9c17",
  "fromSide": "right",
  "toNode": "a1b2c3d4e5f67890",
  "toSide": "left",
  "toEnd": "arrow",
  "label": "leads to"
}
```

## Colors

| Preset | Color |
|--------|-------|
| `"1"` | Red |
| `"2"` | Orange |
| `"3"` | Yellow |
| `"4"` | Green |
| `"5"` | Cyan |
| `"6"` | Purple |

## Layout Guidelines

- `x` increases right, `y` increases down; position is the top-left corner
- Space nodes 50-100px apart; leave 20-50px padding inside groups
- Align to grid (multiples of 10 or 20) for cleaner layouts

| Node Type | Suggested Width | Suggested Height |
|-----------|-----------------|------------------|
| Small text | 200-300 | 80-150 |
| Medium text | 300-450 | 150-300 |
| File preview | 300-500 | 200-400 |

## Validation Checklist

1. All `id` values are unique across nodes and edges
2. Every `fromNode` and `toNode` references an existing node ID
3. Required fields present for each node type
4. `type` is one of: `text`, `file`, `link`, `group`
5. `fromSide`/`toSide` values are: `top`, `right`, `bottom`, `left`
6. `fromEnd`/`toEnd` values are: `none`, `arrow`
7. JSON is valid and parseable (no unescaped newlines in text content)

## Complete Examples

### Mind Map

```json
{
  "nodes": [
    {
      "id": "8a9b0c1d2e3f4a5b",
      "type": "text",
      "x": 0, "y": 0, "width": 300, "height": 150,
      "text": "# Main Idea\n\nCentral concept."
    },
    {
      "id": "1a2b3c4d5e6f7a8b",
      "type": "text",
      "x": 400, "y": -100, "width": 250, "height": 100,
      "text": "## Point A"
    },
    {
      "id": "2b3c4d5e6f7a8b9c",
      "type": "text",
      "x": 400, "y": 100, "width": 250, "height": 100,
      "text": "## Point B"
    }
  ],
  "edges": [
    {
      "id": "3c4d5e6f7a8b9c0d",
      "fromNode": "8a9b0c1d2e3f4a5b", "fromSide": "right",
      "toNode": "1a2b3c4d5e6f7a8b", "toSide": "left"
    },
    {
      "id": "4d5e6f7a8b9c0d1e",
      "fromNode": "8a9b0c1d2e3f4a5b", "fromSide": "right",
      "toNode": "2b3c4d5e6f7a8b9c", "toSide": "left"
    }
  ]
}
```

### Project Board (Kanban)

```json
{
  "nodes": [
    { "id": "5e6f7a8b9c0d1e2f", "type": "group", "x": 0, "y": 0, "width": 300, "height": 500, "label": "To Do", "color": "1" },
    { "id": "6f7a8b9c0d1e2f3a", "type": "group", "x": 350, "y": 0, "width": 300, "height": 500, "label": "In Progress", "color": "3" },
    { "id": "7a8b9c0d1e2f3a4b", "type": "group", "x": 700, "y": 0, "width": 300, "height": 500, "label": "Done", "color": "4" },
    { "id": "8b9c0d1e2f3a4b5c", "type": "text", "x": 20, "y": 50, "width": 260, "height": 80, "text": "## Task 1\n\nImplement feature" },
    { "id": "9c0d1e2f3a4b5c6d", "type": "text", "x": 370, "y": 50, "width": 260, "height": 80, "text": "## Task 2\n\nReview PR", "color": "2" },
    { "id": "0d1e2f3a4b5c6d7e", "type": "text", "x": 720, "y": 50, "width": 260, "height": 80, "text": "## Task 3\n\n~~Setup CI/CD~~" }
  ],
  "edges": []
}
```

### Flowchart

```json
{
  "nodes": [
    { "id": "a0b1c2d3e4f5a6b7", "type": "text", "x": 200, "y": 0, "width": 150, "height": 60, "text": "**Start**", "color": "4" },
    { "id": "b1c2d3e4f5a6b7c8", "type": "text", "x": 200, "y": 100, "width": 150, "height": 60, "text": "Step 1:\nGather data" },
    { "id": "c2d3e4f5a6b7c8d9", "type": "text", "x": 200, "y": 200, "width": 150, "height": 80, "text": "**Decision**\n\nIs data valid?", "color": "3" },
    { "id": "d3e4f5a6b7c8d9e0", "type": "text", "x": 400, "y": 200, "width": 150, "height": 60, "text": "Process data" },
    { "id": "e4f5a6b7c8d9e0f1", "type": "text", "x": 0, "y": 200, "width": 150, "height": 60, "text": "Request new data", "color": "1" },
    { "id": "f5a6b7c8d9e0f1a2", "type": "text", "x": 400, "y": 320, "width": 150, "height": 60, "text": "**End**", "color": "4" }
  ],
  "edges": [
    { "id": "a6b7c8d9e0f1a2b3", "fromNode": "a0b1c2d3e4f5a6b7", "fromSide": "bottom", "toNode": "b1c2d3e4f5a6b7c8", "toSide": "top" },
    { "id": "b7c8d9e0f1a2b3c4", "fromNode": "b1c2d3e4f5a6b7c8", "fromSide": "bottom", "toNode": "c2d3e4f5a6b7c8d9", "toSide": "top" },
    { "id": "c8d9e0f1a2b3c4d5", "fromNode": "c2d3e4f5a6b7c8d9", "fromSide": "right", "toNode": "d3e4f5a6b7c8d9e0", "toSide": "left", "label": "Yes", "color": "4" },
    { "id": "d9e0f1a2b3c4d5e6", "fromNode": "c2d3e4f5a6b7c8d9", "fromSide": "left", "toNode": "e4f5a6b7c8d9e0f1", "toSide": "right", "label": "No", "color": "1" },
    { "id": "e0f1a2b3c4d5e6f7", "fromNode": "e4f5a6b7c8d9e0f1", "fromSide": "top", "fromEnd": "none", "toNode": "b1c2d3e4f5a6b7c8", "toSide": "left", "toEnd": "arrow" },
    { "id": "f1a2b3c4d5e6f7a8", "fromNode": "d3e4f5a6b7c8d9e0", "fromSide": "bottom", "toNode": "f5a6b7c8d9e0f1a2", "toSide": "top" }
  ]
}
```
