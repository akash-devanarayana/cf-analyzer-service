const logger = require('../utils/logger');
const {JSDOM} = require('jsdom');

// Analyze DOM content to find alternative selectors
const analyzeDOM = async (pageContent, failedSelector) => {
    try {
        // Parse the HTML content
        const dom = new JSDOM(pageContent);
        const document = dom.window.document;

        // Array to store potential selectors with confidence scores
        const alternatives = [];

        // First, try to understand what kind of selector it is (class, ID, attribute, etc.)
        const selectorType = analyzeSelector(failedSelector);

        // Apply different strategies based on the selector type
        switch (selectorType) {
            case 'class':
                findClassAlternatives(document, failedSelector, alternatives);
                break;
            case 'id':
                findIdAlternatives(document, failedSelector, alternatives);
                break;
            case 'tag':
                findTagAlternatives(document, failedSelector, alternatives);
                break;
            case 'attribute':
                findAttributeAlternatives(document, failedSelector, alternatives);
                break;
            case 'complex':
                findComplexAlternatives(document, failedSelector, alternatives);
                break;
        }

        // Add more robust alternatives using multiple attributes
        findRobustAlternatives(document, failedSelector, alternatives);

        // Sort alternatives by confidence
        alternatives.sort((a, b) => b.confidence - a.confidence);

        // Return the alternatives
        return alternatives;
    } catch (error) {
        console.error('Error analyzing DOM:', error);
        return [];
    }
};

// Analyze what type of selector we're dealing with
const analyzeSelector = (selector) => {
    if (selector.startsWith('.')) {
        return 'class';
    } else if (selector.startsWith('#')) {
        return 'id';
    } else if (selector.includes('[') && selector.includes(']')) {
        return 'attribute';
    } else if (selector.includes(' ') || selector.includes('>')) {
        return 'complex';
    } else {
        return 'tag';
    }
};

// Find alternatives for class selectors
const findClassAlternatives = (document, failedSelector, alternatives) => {
    const originalClass = failedSelector.substring(1); // Remove the dot

    // Common class name transformations
    const potentialClasses = [
        // Framework-specific transformations
        originalClass.replace('button', 'btn'),
        originalClass.replace('item', 'card'),
        originalClass.replace('submit', 'primary'),
        // BEM-style variations
        `${originalClass}__item`,
        `${originalClass}--primary`,
        // Tailwind-style variations
        originalClass.replace('-', '-'),
        // Bootstrap-style variations
        originalClass.replace('-', '')
    ];

    // Look for elements with similar class names
    potentialClasses.forEach(className => {
        const elements = document.querySelectorAll(`.${className}`);
        if (elements.length > 0) {
            alternatives.push({
                selector: `.${className}`,
                confidence: calculateConfidence(className, originalClass),
                elements: elements.length
            });
        }
    });

    // Look for elements with text content related to the class name
    const textHint = originalClass.replace(/-/g, ' ').replace(/([A-Z])/g, ' $1').toLowerCase();
    document.querySelectorAll('*').forEach(element => {
        const elementText = element.textContent.toLowerCase();
        if (elementText.includes(textHint)) {
            const elementClasses = Array.from(element.classList);
            elementClasses.forEach(className => {
                alternatives.push({
                    selector: `.${className}`,
                    confidence: 0.6,
                    elements: document.querySelectorAll(`.${className}`).length
                });
            });
        }
    });
};

// Find alternatives for ID selectors
const findIdAlternatives = (document, failedSelector, alternatives) => {
    const originalId = failedSelector.substring(1); // Remove the hash

    // Try variations of the ID
    const potentialIds = [
        originalId.replace('-', '_'),
        originalId.replace('_', '-'),
        originalId.toLowerCase(),
        originalId.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
    ];

    potentialIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            alternatives.push({
                selector: `#${id}`,
                confidence: 0.9,
                elements: 1
            });
        }
    });

    // If no ID matches found, look for elements with similar attributes
    if (alternatives.length === 0) {
        document.querySelectorAll('[id]').forEach(element => {
            const id = element.getAttribute('id');
            if (id.includes(originalId) || originalId.includes(id)) {
                alternatives.push({
                    selector: `#${id}`,
                    confidence: 0.7,
                    elements: 1
                });
            }
        });
    }
};

// Find alternatives for tag selectors
const findTagAlternatives = (document, failedSelector, alternatives) => {
    // Check if there are unique attributes we can use
    document.querySelectorAll(failedSelector).forEach(element => {
        if (element.hasAttribute('data-testid')) {
            alternatives.push({
                selector: `[data-testid="${element.getAttribute('data-testid')}"]`,
                confidence: 0.95,
                elements: document.querySelectorAll(`[data-testid="${element.getAttribute('data-testid')}"]`).length
            });
        } else if (element.hasAttribute('name')) {
            alternatives.push({
                selector: `${failedSelector}[name="${element.getAttribute('name')}"]`,
                confidence: 0.85,
                elements: document.querySelectorAll(`${failedSelector}[name="${element.getAttribute('name')}"]`).length
            });
        }
    });

    // Look for elements with the same tag and similar content
    document.querySelectorAll(failedSelector).forEach(element => {
        const textContent = element.textContent.trim();
        if (textContent) {
            alternatives.push({
                selector: `${failedSelector}:contains("${textContent}")`,
                confidence: 0.7,
                elements: 1 // This is a custom selector, so we assume it's unique
            });
        }
    });
};

// Find alternatives for attribute selectors
const findAttributeAlternatives = (document, failedSelector, alternatives) => {
    // Parse the attribute selector
    const matches = failedSelector.match(/\[([^=]+)(?:=["']?([^"'\]]+)["']?)?\]/);
    if (!matches) return;

    const attrName = matches[1];
    const attrValue = matches[2] || '';

    // Look for other attributes on the same elements
    document.querySelectorAll(`[${attrName}]`).forEach(element => {
        if (attrValue && element.getAttribute(attrName) !== attrValue) return;

        // Try to find other unique attributes
        for (const attr of ['data-testid', 'data-cy', 'id', 'name', 'role']) {
            if (element.hasAttribute(attr)) {
                alternatives.push({
                    selector: `[${attr}="${element.getAttribute(attr)}"]`,
                    confidence: attr.startsWith('data-') ? 0.9 : 0.75,
                    elements: document.querySelectorAll(`[${attr}="${element.getAttribute(attr)}"]`).length
                });
            }
        }
    });
};

// Find alternatives for complex selectors
const findComplexAlternatives = (document, failedSelector, alternatives) => {
    // For complex selectors, try to simplify
    const parts = failedSelector.split(/\s+|\s*>\s*/);
    const lastPart = parts[parts.length - 1];

    // Try to use just the last part with some context
    if (analyzeSelector(lastPart) === 'class') {
        findClassAlternatives(document, lastPart, alternatives);
    } else if (analyzeSelector(lastPart) === 'id') {
        findIdAlternatives(document, lastPart, alternatives);
    }

    // Try with a more specific but still simpler selector
    if (parts.length > 2) {
        const simplifiedSelector = `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
        try {
            const elements = document.querySelectorAll(simplifiedSelector);
            if (elements.length > 0) {
                alternatives.push({
                    selector: simplifiedSelector,
                    confidence: 0.8,
                    elements: elements.length
                });
            }
        } catch (e) {
            // Invalid selector, ignore
        }
    }
};

// Find more robust alternatives using multiple attributes
const findRobustAlternatives = (document, failedSelector, alternatives) => {
    try {
        // Try to find the element with the original selector
        const originalElements = document.querySelectorAll(failedSelector);

        if (originalElements.length === 0) {
            // If we can't find the original element, we need to use heuristics
            // This would be a more comprehensive algorithm in a real implementation
            return;
        }

        // For each element matching the original selector
        Array.from(originalElements).forEach(element => {
            // Build a more robust selector using multiple attributes
            const tagName = element.tagName.toLowerCase();
            let robustSelector = tagName;

            // Add class if available
            if (element.className) {
                const classes = Array.from(element.classList);
                if (classes.length > 0) {
                    robustSelector += `.${classes[0]}`;
                }
            }

            // Add position if needed for uniqueness
            const parent = element.parentElement;
            if (parent) {
                const siblings = Array.from(parent.children).filter(child =>
                    child.tagName === element.tagName
                );
                if (siblings.length > 1) {
                    const index = siblings.indexOf(element) + 1;
                    robustSelector += `:nth-child(${index})`;
                }
            }

            // Check if this selector is unique enough
            const matchingElements = document.querySelectorAll(robustSelector);
            if (matchingElements.length === 1) {
                alternatives.push({
                    selector: robustSelector,
                    confidence: 0.85,
                    elements: 1
                });
            } else if (matchingElements.length > 1 && matchingElements.length <= 3) {
                // If not unique, add parent context
                if (parent) {
                    const parentTag = parent.tagName.toLowerCase();
                    let parentIdentifier = parentTag;

                    if (parent.id) {
                        parentIdentifier = `${parentTag}#${parent.id}`;
                    } else if (parent.className) {
                        const parentClasses = Array.from(parent.classList);
                        if (parentClasses.length > 0) {
                            parentIdentifier = `${parentTag}.${parentClasses[0]}`;
                        }
                    }

                    robustSelector = `${parentIdentifier} > ${robustSelector}`;
                    alternatives.push({
                        selector: robustSelector,
                        confidence: 0.8,
                        elements: document.querySelectorAll(robustSelector).length
                    });
                }
            }
        });
    } catch (error) {
        console.error('Error finding robust alternatives:', error);
    }
};

// Calculate confidence score based on string similarity
const calculateConfidence = (newValue, originalValue) => {
    if (newValue === originalValue) return 1.0;

    // Calculate Levenshtein distance
    const distance = levenshteinDistance(newValue, originalValue);
    const maxLength = Math.max(newValue.length, originalValue.length);
    const similarity = 1 - (distance / maxLength);

    // Scale to a reasonable confidence value
    return 0.6 + (similarity * 0.3);
};

// Levenshtein distance for string similarity
const levenshteinDistance = (a, b) => {
    const matrix = [];

    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[b.length][a.length];
};

module.exports = {
    analyzeDOM
};

