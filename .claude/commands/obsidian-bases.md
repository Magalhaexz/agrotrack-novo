---
name: obsidian-bases
description: Create and edit Obsidian Bases (.base files) with views, filters, formulas, and summaries. Use when working with .base files, creating database-like views of notes, or when the user mentions Bases, table views, card views, filters, or formulas in Obsidian.
---

# Obsidian Bases Skill

## Workflow

1. **Create the file**: Create a `.base` file in the vault with valid YAML content
2. **Define scope**: Add `filters` to select which notes appear (by tag, folder, property, or date)
3. **Add formulas** (optional): Define computed properties in the `formulas` section
4. **Configure views**: Add one or more views (`table`, `cards`, `list`, or `map`) with `order` specifying which properties to display
5. **Validate**: Verify the file is valid YAML. Check that all referenced properties and formulas exist.
6. **Test in Obsidian**: Open the `.base` file in Obsidian to confirm the view renders correctly.

## Schema

```yaml
filters:
  and:
    - 'status == "active"'
    - not:
        - 'file.hasTag("archived")'

formulas:
  formula_name: 'expression'

properties:
  property_name:
    displayName: "Display Name"
  formula.formula_name:
    displayName: "Formula Display Name"

summaries:
  custom_summary_name: 'values.mean().round(3)'

views:
  - type: table | cards | list | map
    name: "View Name"
    limit: 10
    groupBy:
      property: property_name
      direction: ASC | DESC
    filters:
      and:
        - 'status == "active"'
    order:
      - file.name
      - property_name
      - formula.formula_name
    summaries:
      property_name: Average
```

## Filter Syntax

```yaml
# Single filter
filters: 'status == "done"'

# AND
filters:
  and:
    - 'status == "done"'
    - 'priority > 3'

# OR
filters:
  or:
    - 'file.hasTag("book")'
    - 'file.hasTag("article")'

# NOT
filters:
  not:
    - 'file.hasTag("archived")'

# Nested
filters:
  or:
    - file.hasTag("tag")
    - and:
        - file.hasTag("book")
        - file.hasLink("Textbook")
```

### Filter Operators

`==`, `!=`, `>`, `<`, `>=`, `<=`, `&&`, `||`, `!`

## Properties

### File Properties Reference

| Property | Type | Description |
|----------|------|-------------|
| `file.name` | String | File name |
| `file.basename` | String | File name without extension |
| `file.path` | String | Full path to file |
| `file.folder` | String | Parent folder path |
| `file.ext` | String | File extension |
| `file.size` | Number | File size in bytes |
| `file.ctime` | Date | Created time |
| `file.mtime` | Date | Modified time |
| `file.tags` | List | All tags in file |
| `file.links` | List | Internal links in file |
| `file.backlinks` | List | Files linking to this file |

## Formula Syntax

```yaml
formulas:
  total: "price * quantity"
  status_icon: 'if(done, "✅", "⏳")'
  formatted_price: 'if(price, price.toFixed(2) + " dollars")'
  created: 'file.ctime.format("YYYY-MM-DD")'
  days_old: '(now() - file.ctime).days'
  days_until_due: 'if(due_date, (date(due_date) - today()).days, "")'
```

## Key Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `date()` | `date(string): date` | Parse string to date |
| `now()` | `now(): date` | Current date and time |
| `today()` | `today(): date` | Current date (time = 00:00:00) |
| `if()` | `if(condition, trueResult, falseResult?)` | Conditional |
| `duration()` | `duration(string): duration` | Parse duration string |
| `file()` | `file(path): file` | Get file object |
| `link()` | `link(path, display?): Link` | Create a link |

### Duration Type (IMPORTANT)

When subtracting two dates, result is a **Duration** type (not a number). Always access `.days`, `.hours`, etc. first:

```yaml
# CORRECT
"(now() - file.ctime).days"
"(date(due_date) - today()).days.round(0)"

# WRONG — Duration doesn't support division or .round() directly
# "((date(due) - today()) / 86400000).round(0)"
```

### Date Arithmetic

```yaml
# Duration units: y, M, d, w, h, m, s
"now() + \"1 day\""
"today() + \"7d\""
"(now() - file.ctime).days"
```

## All Functions Reference

### Global Functions

| Function | Description |
|----------|-------------|
| `date(string)` | Parse string to date |
| `duration(string)` | Parse duration string |
| `now()` | Current date and time |
| `today()` | Current date |
| `if(cond, t, f?)` | Conditional |
| `min(n1, n2, ...)` | Smallest number |
| `max(n1, n2, ...)` | Largest number |
| `number(any)` | Convert to number |
| `link(path, display?)` | Create a link |
| `list(element)` | Wrap in list |
| `file(path)` | Get file object |
| `image(path)` | Create image |
| `icon(name)` | Lucide icon |
| `html(string)` | Render as HTML |

### Date Functions & Fields

Fields: `date.year`, `date.month`, `date.day`, `date.hour`, `date.minute`, `date.second`

| Function | Description |
|----------|-------------|
| `date.format(string)` | Format with Moment.js pattern |
| `date.relative()` | Human-readable relative time |
| `date.time()` | Get time as string |

### String Functions

Field: `string.length`

| Function | Description |
|----------|-------------|
| `string.contains(value)` | Check substring |
| `string.startsWith(query)` | Starts with query |
| `string.endsWith(query)` | Ends with query |
| `string.isEmpty()` | Empty or not present |
| `string.lower()` | To lowercase |
| `string.title()` | To Title Case |
| `string.trim()` | Remove whitespace |
| `string.replace(pattern, repl)` | Replace pattern |
| `string.split(sep, n?)` | Split to list |
| `string.slice(start, end?)` | Substring |

### Number Functions

| Function | Description |
|----------|-------------|
| `number.abs()` | Absolute value |
| `number.ceil()` | Round up |
| `number.floor()` | Round down |
| `number.round(digits?)` | Round to digits |
| `number.toFixed(precision)` | Fixed-point notation |

### List Functions

Field: `list.length`

| Function | Description |
|----------|-------------|
| `list.contains(value)` | Element exists |
| `list.filter(expression)` | Filter by condition (uses `value`, `index`) |
| `list.map(expression)` | Transform elements |
| `list.reduce(expression, initial)` | Reduce to single value |
| `list.flat()` | Flatten nested lists |
| `list.join(separator)` | Join to string |
| `list.sort()` | Sort ascending |
| `list.unique()` | Remove duplicates |
| `list.reverse()` | Reverse order |
| `list.slice(start, end?)` | Sublist |

### File Functions

| Function | Description |
|----------|-------------|
| `file.asLink(display?)` | Convert to link |
| `file.hasLink(otherFile)` | Has link to file |
| `file.hasTag(...tags)` | Has any of the tags |
| `file.hasProperty(name)` | Has property |
| `file.inFolder(folder)` | In folder or subfolder |

## Default Summary Formulas

| Name | Input Type | Description |
|------|------------|-------------|
| `Average` | Number | Mathematical mean |
| `Min` / `Max` | Number | Smallest / Largest |
| `Sum` | Number | Sum of all numbers |
| `Median` | Number | Mathematical median |
| `Stddev` | Number | Standard deviation |
| `Earliest` / `Latest` | Date | Date range |
| `Checked` / `Unchecked` | Boolean | Count of true/false |
| `Empty` / `Filled` | Any | Count empty/non-empty |
| `Unique` | Any | Count of unique values |

## Complete Examples

### Task Tracker Base

```yaml
filters:
  and:
    - file.hasTag("task")
    - 'file.ext == "md"'

formulas:
  days_until_due: 'if(due, (date(due) - today()).days, "")'
  priority_label: 'if(priority == 1, "🔴 High", if(priority == 2, "🟡 Medium", "🟢 Low"))'

properties:
  formula.days_until_due:
    displayName: "Days Until Due"
  formula.priority_label:
    displayName: Priority

views:
  - type: table
    name: "Active Tasks"
    filters:
      and:
        - 'status != "done"'
    order:
      - file.name
      - status
      - formula.priority_label
      - due
      - formula.days_until_due
    groupBy:
      property: status
      direction: ASC
```

### Reading List Base

```yaml
filters:
  or:
    - file.hasTag("book")
    - file.hasTag("article")

formulas:
  status_icon: 'if(status == "reading", "📖", if(status == "done", "✅", "📚"))'

views:
  - type: cards
    name: "Library"
    order:
      - cover
      - file.name
      - author
      - formula.status_icon
```

### Daily Notes Index

```yaml
filters:
  and:
    - file.inFolder("30-Diario")
    - '/^\d{4}-\d{2}-\d{2}$/.matches(file.basename)'

formulas:
  day_of_week: 'date(file.basename).format("dddd")'
  word_estimate: '(file.size / 5).round(0)'

views:
  - type: table
    name: "Recent Notes"
    limit: 30
    order:
      - file.name
      - formula.day_of_week
      - formula.word_estimate
      - file.mtime
```

## Embedding Bases

```markdown
![[MyBase.base]]
![[MyBase.base#View Name]]
```

## YAML Quoting Rules

- Use single quotes for formulas containing double quotes: `'if(done, "Yes", "No")'`
- Use double quotes for simple strings: `"My View Name"`
- Strings containing `:`, `{`, `}`, `[`, `]`, etc. must be quoted.

## Troubleshooting

**Duration without field access:**
```yaml
# WRONG
"(now() - file.ctime).round(0)"
# CORRECT
"(now() - file.ctime).days.round(0)"
```

**Missing null checks:**
```yaml
# WRONG
"(date(due_date) - today()).days"
# CORRECT
'if(due_date, (date(due_date) - today()).days, "")'
```

**Referencing undefined formula:** Every `formula.X` in `order` must have a matching entry in `formulas`.
