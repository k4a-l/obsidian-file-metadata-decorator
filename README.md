# Obsidian File Metadata Decorator

Dynamically decorate your Obsidian File Views based on metadata (Frontmatter, Tags, File Path, Title).
This plugin allows you to run a JavaScript/TypeScript function to evaluate the current file's metadata and inject **CSS Classes**, **CSS Variables**, and **Custom DOM Elements** into the view.

## Features

- **Dynamic CSS Classes**: Add classes to the `.view-content` element based on file status, tags, etc.
- **CSS Variables**: Inject data as CSS variables for use in `::after/::before` pseudo-elements.
- **Custom DOM Elements**: Generate badges, banners, or any DOM elements directly into the view container.
- **TypeScript Support**: Develop your rules in TypeScript with full type safety using the included Playground environment.

## Usage

### 1. Enable the Plugin
Enable "File Metadata Decorator" in Obsidian settings.

### 2. Prepare the Script
Create a JavaScript file (e.g., `scripts/file-metadata-decorator.js`) in your vault or plugin folder.
It should export a default function that takes `metadata` and returns an evaluation result.

**Note**: We highly recommend generating this file using the **Playground** (see below) to use TypeScript and bundling.

### 3. Configure the Rule
Go to the plugin settings:
- **Rule Type**: `function-file`
- **File Path**: Path to your script (e.g., `scripts/file-metadata-decorator.js`)

## Development (Playground)

This plugin comes with a `playground` directory to help you write rules in TypeScript.

1.  Navigate to the plugin directory in your terminal.
2.  Run `npm install`.
3.  Edit `playground/file-metadata-decorator.ts`.
4.  Run `npm run playground:watch` to automatically compile your TS code to `scripts/file-metadata-decorator.js` (or wherever your build script is configured to output).

### API Reference

Your function receives a `metadata` object and should return an `EvaluateRuleResult`.

#### Input: `EvaluateFunction`
```typescript
type EvaluateFunction = (metadata: {
    frontmatter: Record<string, any>;
    tags: string[] | null;
    path: string;
    title: string;
}) => EvaluateRuleResult;
```

#### Output: `EvaluateRuleResult`
```typescript
type EvaluateRuleResult = {
    // Add these classes to .view-content
    classNames: string[];
    
    // Set these CSS variables on .view-content (e.g., { "--status": "todo" })
    cssVariables?: Record<string, string>;
    
    // Create these DOM elements inside .obsidian-file-metadata-decorator container
    elements?: DynamicElement[];
};

type DynamicElement = {
    className?: string; // CSS class for the element
    text?: string;      // Text content
    style?: Partial<CSSStyleDeclaration> | Record<string, string>; // Inline styles
};
```

## Example

```typescript
import z from "zod";

const main = ({ frontmatter, tags }) => {
    const result = {
        classNames: [],
        elements: []
    };

    // Example: Check "status" in frontmatter
    if (frontmatter.status === "todo") {
        result.classNames.push("status-todo");
        
        // Add a badge
        result.elements.push({
            text: "TODO",
            style: {
                backgroundColor: "red",
                color: "white",
                fontWeight: "bold"
            }
        });
    }

    return result;
};

export default main;
```

## DOM Structure

The plugin injects a container element into the `.view-content`:

```html
<div class="view-content ...">
    <!-- Your content ... -->
    
    <div class="obsidian-file-metadata-decorator fmd-container-{ruleId}">
        <div class="status-badge" style="...">TODO</div>
        <!-- Other elements -->
    </div>
</div>
```

You can style `.obsidian-file-metadata-decorator` to position it (e.g., absolute positioning to the top-right).

```css
.obsidian-file-metadata-decorator {
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    gap: 5px;
}
```
