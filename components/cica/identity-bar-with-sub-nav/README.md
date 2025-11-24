# Identity Bar with Sub-Navigation Component

A specialized variant of the Identity Bar component that combines the MOJ Identity Bar with sub-navigation, designed specifically for the CICA review case documents application.

## Overview

This component integrates the MOJ Identity Bar with sub-navigation, allowing you to display identifying information (like a Case Reference Number) alongside navigation links in a unified header component.

## Files

- `macro.njk` - The Nunjucks macro that can be imported and called
- `template.njk` - The HTML template for the component
- `_identity-bar.scss` - Sass styles specific to this variant

## Usage

### Import the macro

```nunjucks
{% from "components/cica/identity-bar-with-sub-nav/macro.njk" import cicaIdentityBarWithSubNav %}
```

### Basic usage with sub-navigation

```nunjucks
{{ cicaIdentityBarWithSubNav({
    title: {
        html: '<strong>CRN: 25-111111</strong>'
    },
    subNav: {
        label: "Sub navigation",
        items: [
            {
                text: "Search",
                href: "/search",
                active: true
            },
            {
                text: "Documents",
                href: "/document"
            }
        ]
    }
}) }}
```

### With plain text title

```nunjucks
{{ cicaIdentityBarWithSubNav({
    title: {
        text: "CRN: 25-111111"
    },
    subNav: {
        label: "Sub navigation",
        items: [
            {
                text: "Search",
                href: "/search"
            }
        ]
    }
}) }}
```

### With action menus

```nunjucks
{{ cicaIdentityBarWithSubNav({
    title: {
        html: '<strong>CRN: 25-111111</strong>'
    },
    subNav: {
        label: "Sub navigation",
        items: [
            {
                text: "Search",
                href: "/search"
            }
        ]
    },
    menus: [
        {
            buttonText: "Actions",
            items: [
                {
                    text: "Download",
                    href: "/download"
                }
            ]
        }
    ]
}) }}
```

## Parameters

| Name | Type | Required | Description |
| ---- | ---- | -------- | ----------- |
| title | object | No | Title configuration object |
| title.text | string | No | Plain text title |
| title.html | string | No | HTML title (takes precedence over text) |
| subNav | object | No | Sub-navigation configuration object (see MOJ Sub Navigation component) |
| subNav.label | string | No | Accessible label for the navigation |
| subNav.items | array | No | Array of navigation items with text, href, and active properties |
| menus | array | No | Array of menu objects (see MOJ Button Menu component) |
| classes | string | No | Additional CSS classes to add to the component |
| attributes | object | No | HTML attributes (for example, data attributes) |

## Example in Application

This component is used in `page/page.njk` as part of the base page template:

```nunjucks
{{ cicaIdentityBarWithSubNav({
    title: {
        html: ['<strong>CRN: ', (caseReferenceNumber | default('none selected')), '</strong>'] | join('')
    },
    subNav: {
        label: "Sub navigation",
        items: [
            {
                text: "Search",
                href: "/search",
                active: "search" in pageType
            },
            {
                text: "Documents",
                href: "/document",
                active: "document" in pageType
            }
        ]
    }
}) }}
```

## Styling

The component extends the base Identity Bar styles with specific modifications:

- Removes bottom padding to accommodate nested navigation
- Floats sub-navigation to the right
- Removes bottom margin from nested sub-navigation

### Key CSS Classes

- `.moj-identity-bar` - Base identity bar class
- `.moj-identity-bar--nested-moj-sub-navigation` - Modifier class for this variant
- `.moj-identity-bar__container` - Inner container
- `.moj-identity-bar__details` - Title section
- `.moj-identity-bar__title` - The title text/HTML
- `.moj-identity-bar__actions` - Action menu container
- `.moj-sub-navigation` - Nested navigation component (floated right)

## How It Works

This component integrates the MOJ Identity Bar with sub-navigation in a single unified component:

1. The macro is called with parameters including title, subNav, and optional menus
2. The `subNav` parameter accepts the same configuration as the MOJ Sub Navigation component
3. The sub-navigation is automatically positioned to the right within the identity bar
4. The component applies the `moj-identity-bar--nested-moj-sub-navigation` modifier class for proper styling

## Accessibility

The component follows GOV.UK Design System accessibility guidelines:
- Semantic HTML structure
- Proper heading hierarchy
- Keyboard navigation support through sub-navigation
- Screen reader compatible
- Sufficient colour contrast

## Related Components

- `identity-bar` - Base identity bar component without navigation
- MOJ Sub Navigation - Used within this component for navigation items
- MOJ Button Menu - Used for action menus
- GOV.UK Frontend - Base design system

## Differences from Standard Identity Bar

This variant differs from the standard `identity-bar` component in several ways:

1. **Integrated sub-navigation** via the `subNav` parameter
2. **Modified styling** to accommodate sub-navigation within the bar
3. **Additional CSS class** `moj-identity-bar--nested-moj-sub-navigation`
4. **Right-aligned navigation** via CSS floats
5. **Adjusted spacing** to remove gaps between identity bar and navigation elements

## Browser Support

Follows the same browser support as GOV.UK Frontend:
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Internet Explorer 11 (with appropriate polyfills)
- Mobile browsers (iOS Safari, Chrome for Android)
