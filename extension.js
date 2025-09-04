const vscode = require('vscode');
const path = require('path');

/**
 * Professional Comment Cleaner Extension
 * Advanced intelligent comment removal with comprehensive analysis
 */

class CommentAnalyzer {
    constructor() {
        this.config = vscode.workspace.getConfiguration('commentCleaner');
        this.statistics = {
            totalComments: 0,
            preservedComments: 0,
            removedComments: 0,
            categories: {}
        };
    }

    /**
     * Get language-specific comment patterns with enhanced support
     */
    getLanguageConfig(languageId) {
        const configs = {
            'javascript': {
                singleLine: /\/\/.*$/gm,
                multiLine: /\/\*[\s\S]*?\*\//g,
                docBlock: /\/\*\*[\s\S]*?\*\//g,
                keywords: ['function', 'const', 'let', 'var', 'class', 'if', 'else', 'for', 'while', 'return', 'import', 'export']
            },
            'typescript': {
                singleLine: /\/\/.*$/gm,
                multiLine: /\/\*[\s\S]*?\*\//g,
                docBlock: /\/\*\*[\s\S]*?\*\//g,
                keywords: ['function', 'const', 'let', 'var', 'class', 'interface', 'type', 'enum', 'if', 'else', 'for', 'while', 'return', 'import', 'export']
            },
            'python': {
                singleLine: /#.*$/gm,
                multiLine: /"""[\s\S]*?"""|'''[\s\S]*?'''/g,
                docBlock: /"""[\s\S]*?"""/g,
                keywords: ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'return', 'import', 'from', 'try', 'except']
            },
            'java': {
                singleLine: /\/\/.*$/gm,
                multiLine: /\/\*[\s\S]*?\*\//g,
                docBlock: /\/\*\*[\s\S]*?\*\//g,
                keywords: ['public', 'private', 'protected', 'class', 'interface', 'if', 'else', 'for', 'while', 'return', 'import']
            },
            'csharp': {
                singleLine: /\/\/.*$/gm,
                multiLine: /\/\*[\s\S]*?\*\//g,
                docBlock: /\/\*\*[\s\S]*?\*\//g,
                keywords: ['public', 'private', 'protected', 'class', 'interface', 'namespace', 'using', 'if', 'else', 'for', 'while', 'return']
            },
            'html': {
                singleLine: null,
                multiLine: /<!--[\s\S]*?-->/g,
                docBlock: null,
                keywords: ['div', 'span', 'html', 'head', 'body', 'script', 'style']
            },
            'css': {
                singleLine: null,
                multiLine: /\/\*[\s\S]*?\*\//g,
                docBlock: null,
                keywords: ['class', 'id', 'color', 'background', 'margin', 'padding']
            }
        };

        // Add aliases
        configs['javascriptreact'] = configs['javascript'];
        configs['typescriptreact'] = configs['typescript'];
        configs['c'] = configs['java'];
        configs['cpp'] = configs['java'];
        configs['xml'] = configs['html'];

        return configs[languageId] || null;
    }

    /**
     * Enhanced comment extraction with better regex patterns
     */
    extractComments(document) {
        const languageConfig = this.getLanguageConfig(document.languageId);
        if (!languageConfig) return [];

        const text = document.getText();
        const comments = [];

        // Extract ALL single-line comments
        if (languageConfig.singleLine) {
            let match;
            const singleLineRegex = new RegExp(languageConfig.singleLine.source, 'gm');

            while ((match = singleLineRegex.exec(text)) !== null) {
                const startPos = document.positionAt(match.index);
                const endPos = document.positionAt(match.index + match[0].length);

                comments.push({
                    type: 'single',
                    text: match[0],
                    range: new vscode.Range(startPos, endPos),
                    lineNumber: startPos.line,
                    context: this.getContext(document, startPos.line),
                    isInlineComment: startPos.character > 0
                });
            }
        }

        // Extract ALL multi-line comments (INCLUDING doc blocks)
        if (languageConfig.multiLine) {
            let match;
            const multiLineRegex = new RegExp(languageConfig.multiLine.source, 'g');

            while ((match = multiLineRegex.exec(text)) !== null) {
                const startPos = document.positionAt(match.index);
                const endPos = document.positionAt(match.index + match[0].length);

                comments.push({
                    type: 'multi',
                    text: match[0],
                    range: new vscode.Range(startPos, endPos),
                    lineNumber: startPos.line,
                    context: this.getContext(document, startPos.line),
                    isInlineComment: false
                });
            }
        }

        this.statistics.totalComments = comments.length;
        console.log(`DEBUG: Found ${comments.length} total comments`); // Add this for debugging
        return comments;
    }

    /**
     * Helper to determine if comment is inline with code
     */
    isInlineComment(document, startPos) {
        const line = document.lineAt(startPos.line);
        const beforeComment = line.text.substring(0, startPos.character).trim();
        return beforeComment.length > 0;
    }


    /**
     * Get context around a comment (previous and next lines)
     */
    getContext(document, lineNumber) {
        const context = {
            previousLine: lineNumber > 0 ? document.lineAt(lineNumber - 1).text.trim() : '',
            currentLine: document.lineAt(lineNumber).text.trim(),
            nextLine: lineNumber < document.lineCount - 1 ? document.lineAt(lineNumber + 1).text.trim() : '',
            nextNonEmptyLine: this.getNextNonEmptyLine(document, lineNumber + 1),
            indentLevel: this.getIndentLevel(document.lineAt(lineNumber).text)
        };

        return context;
    }

    /**
     * Get the next non-empty line
     */
    getNextNonEmptyLine(document, startLine) {
        for (let i = startLine; i < document.lineCount; i++) {
            const line = document.lineAt(i).text.trim();
            if (line.length > 0) {
                return line;
            }
        }
        return '';
    }

    /**
     * Get indentation level
     */
    getIndentLevel(line) {
        const match = line.match(/^(\s*)/);
        return match ? match[1].length : 0;
    }

    /**
     * Significantly enhanced heuristics for comment analysis
     */
    analyzeComment(comment, document) {
        const analysis = {
            category: 'unknown',
            shouldRemove: false,
            confidence: 0,
            reasons: []
        };

        const cleanComment = this.cleanCommentText(comment.text);
        const languageConfig = this.getLanguageConfig(document.languageId);

        // Handle doc blocks specifically
        if (comment.type === 'docblock' || comment.isDocBlock) {
            analysis.category = 'documentation';
            analysis.shouldRemove = false; // Normally preserve
            analysis.confidence = 0.9;
            analysis.reasons.push('API documentation block');
            return analysis;
        }

        // Priority 1: Preserve critical comments (highest priority)
        if (this.isCriticalComment(cleanComment)) {
            analysis.category = 'critical';
            analysis.shouldRemove = false;
            analysis.confidence = 0.95;
            analysis.reasons.push('Contains critical directives or important metadata');
            return analysis;
        }

        // Priority 2: Preserve meaningful documentation
        if (this.isDocumentation(cleanComment, comment.context)) {
            analysis.category = 'documentation';
            analysis.shouldRemove = false;
            analysis.confidence = 0.85;
            analysis.reasons.push('Appears to be meaningful documentation');
            return analysis;
        }

        // Priority 3: Remove commented-out code (high confidence)
        if (this.isCommentedCode(cleanComment, languageConfig)) {
            analysis.category = 'commented_code';
            analysis.shouldRemove = true;
            analysis.confidence = 0.9;
            analysis.reasons.push('Appears to be commented-out code');
            return analysis;
        }

        // Priority 4: Remove redundant comments (enhanced detection)
        const redundancyScore = this.calculateRedundancyScore(cleanComment, comment.context);
        if (redundancyScore > 0.5) {
            analysis.category = 'redundant';
            analysis.shouldRemove = true;
            analysis.confidence = redundancyScore;
            analysis.reasons.push('Comment is redundant with the code it describes');
            return analysis;
        }

        // Priority 5: Remove noise comments (improved detection)
        if (this.isNoiseComment(cleanComment)) {
            analysis.category = 'noise';
            analysis.shouldRemove = true;
            analysis.confidence = 0.8;
            analysis.reasons.push('Comment appears to be noise or placeholder');
            return analysis;
        }

        // Priority 6: Remove outdated comments
        if (this.isOutdatedComment(cleanComment, comment.context)) {
            analysis.category = 'outdated';
            analysis.shouldRemove = true;
            analysis.confidence = 0.7;
            analysis.reasons.push('Comment appears to be outdated or incorrect');
            return analysis;
        }

        // Priority 7: Remove obvious/trivial comments
        if (this.isTrivialComment(cleanComment, comment.context)) {
            analysis.category = 'trivial';
            analysis.shouldRemove = true;
            analysis.confidence = 0.75;
            analysis.reasons.push('Comment states the obvious');
            return analysis;
        }

        // Priority 8: Remove empty or whitespace-only comments
        if (this.isEmptyComment(cleanComment)) {
            analysis.category = 'empty';
            analysis.shouldRemove = true;
            analysis.confidence = 0.95;
            analysis.reasons.push('Comment is empty or contains only whitespace');
            return analysis;
        }

        // Priority 9: Remove duplicate comments
        if (this.isDuplicateComment(cleanComment, comment, document)) {
            analysis.category = 'duplicate';
            analysis.shouldRemove = true;
            analysis.confidence = 0.8;
            analysis.reasons.push('Comment is duplicated elsewhere');
            return analysis;
        }

        // Priority 10: Remove debug/temp comments
        if (this.isDebugComment(cleanComment)) {
            analysis.category = 'debug';
            analysis.shouldRemove = true;
            analysis.confidence = 0.85;
            analysis.reasons.push('Comment appears to be debug or temporary');
            return analysis;
        }

        // Default: preserve unknown comments but with low confidence
        analysis.category = 'regular';
        analysis.shouldRemove = false;
        analysis.confidence = 0.3;
        analysis.reasons.push('Regular comment - preserving for safety');

        return analysis;
    }

    /**
     * Clean comment text for analysis
     */
    cleanCommentText(commentText) {
        return commentText
            .replace(/\/\*+|\*+\/|\/\/+|#+/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    /**
     * Check if comment contains critical information
     */
    isCriticalComment(cleanComment) {
        const criticalPatterns = [
            // Linting and static analysis
            'eslint-disable', 'eslint-enable', 'jshint', 'tslint', 'prettier-ignore',
            'stylelint-disable', 'stylelint-enable',

            // TypeScript directives
            '@ts-ignore', '@ts-expect-error', '@ts-check', '@ts-nocheck',

            // Build and bundler directives
            'webpack:', 'rollup:', 'vite:', 'esbuild:',

            // Framework-specific
            'vue-ignore', 'angular-ignore', 'react-ignore',

            // License and legal
            'copyright', 'license', 'mit license', 'apache license', 'gpl license',

            // Important developer notes
            'todo:', 'fixme:', 'hack:', 'note:', 'warning:', 'danger:', 'important:',
            'bug:', 'issue:', 'ticket:', 'jira:', 'github:',

            // API documentation
            '@param', '@returns', '@throws', '@deprecated', '@example', '@see',
            '@since', '@author', '@version',

            // Conditional compilation
            '#ifdef', '#ifndef', '#endif', '#pragma',

            // Performance notes
            'performance:', 'optimization:', 'benchmark:', 'profiling:',

            // Security notes
            'security:', 'vulnerability:', 'cve-', 'sanitize:', 'validate:'
        ];

        return criticalPatterns.some(pattern => cleanComment.includes(pattern));
    }

    /**
     * Check if comment is meaningful documentation
     */
    isDocumentation(cleanComment, context) {
        // Too short to be meaningful documentation
        if (cleanComment.length < 10) return false;

        // Check for documentation patterns
        const docPatterns = [
            'explains', 'describes', 'represents', 'implements', 'algorithm',
            'strategy', 'pattern', 'approach', 'method', 'technique',
            'purpose:', 'goal:', 'objective:', 'requirements:', 'assumptions:',
            'preconditions:', 'postconditions:', 'side effects:'
        ];

        // Check if it's at the beginning of a function/class
        const isAtFunctionStart = context.nextNonEmptyLine.includes('function') ||
            context.nextNonEmptyLine.includes('class') ||
            context.nextNonEmptyLine.includes('def ') ||
            context.nextNonEmptyLine.includes('public ') ||
            context.nextNonEmptyLine.includes('private ');

        // Complex logic explanation
        const hasComplexExplanation = cleanComment.length > 50 &&
            (cleanComment.includes('because') ||
                cleanComment.includes('however') ||
                cleanComment.includes('therefore') ||
                cleanComment.includes('algorithm') ||
                cleanComment.includes('implementation'));

        return docPatterns.some(pattern => cleanComment.includes(pattern)) ||
            (isAtFunctionStart && cleanComment.length > 20) ||
            hasComplexExplanation;
    }

    /**
     * Enhanced commented-out code detection
     */
    isCommentedCode(cleanComment, languageConfig) {
        if (!languageConfig || cleanComment.length < 3) return false;

        const codeIndicators = {
            symbols: ['{', '}', '(', ')', '[', ']', ';', '=', '==', '===', '!=', '!==', '&&', '||', '++', '--'],
            operators: ['+', '-', '*', '/', '%', '&', '|', '^', '~', '<<', '>>', '?', ':'],
            keywords: languageConfig.keywords || []
        };

        // Count code-like patterns
        let symbolCount = 0;
        let keywordCount = 0;
        let operatorCount = 0;

        codeIndicators.symbols.forEach(symbol => {
            if (cleanComment.includes(symbol)) symbolCount++;
        });

        codeIndicators.operators.forEach(operator => {
            if (cleanComment.includes(operator)) operatorCount++;
        });

        codeIndicators.keywords.forEach(keyword => {
            if (cleanComment.includes(keyword + ' ') || cleanComment.includes(' ' + keyword)) {
                keywordCount++;
            }
        });

        // Advanced heuristics for code detection
        const hasCodeStructure = symbolCount >= 3;
        const hasCodeKeywords = keywordCount >= 2;
        const hasVariableAssignment = /\w+\s*=\s*\w+/.test(cleanComment);
        const hasFunctionCall = /\w+\s*\([^)]*\)/.test(cleanComment);
        const hasCodeFlow = /(if|for|while|try)\s*\(/.test(cleanComment);

        return hasCodeStructure || hasCodeKeywords || hasVariableAssignment || hasFunctionCall || hasCodeFlow;
    }

    /**
     * Enhanced redundant comment detection with better scoring
     */
    calculateRedundancyScore(cleanComment, context) {
        if (cleanComment.length < 3 || !context.nextNonEmptyLine) return 0;

        const nextLine = context.nextNonEmptyLine.toLowerCase().replace(/[^a-zA-Z0-9]/g, ' ');
        const commentWords = cleanComment.split(/\s+/).filter(word => word.length > 2);
        const codeWords = nextLine.split(/\s+/).filter(word => word.length > 2);

        if (commentWords.length === 0 || codeWords.length === 0) return 0;

        // Calculate different types of redundancy
        let exactMatches = 0;
        let partialMatches = 0;
        let semanticMatches = 0;

        commentWords.forEach(commentWord => {
            // Exact match
            if (codeWords.includes(commentWord)) {
                exactMatches++;
                return;
            }

            // Partial match (substring)
            if (codeWords.some(codeWord => codeWord.includes(commentWord) || commentWord.includes(codeWord))) {
                partialMatches++;
                return;
            }

            // Semantic match (common programming terms)
            const semanticPairs = {
                'get': ['fetch', 'retrieve', 'obtain'],
                'set': ['assign', 'update', 'change'],
                'create': ['make', 'build', 'generate', 'new'],
                'delete': ['remove', 'destroy', 'clear'],
                'check': ['validate', 'verify', 'test'],
                'start': ['begin', 'init', 'initialize'],
                'end': ['finish', 'complete', 'stop']
            };

            Object.entries(semanticPairs).forEach(([key, synonyms]) => {
                if (commentWord === key && synonyms.some(syn => codeWords.includes(syn))) {
                    semanticMatches++;
                }
            });
        });

        // Calculate redundancy score
        const totalWords = commentWords.length;
        const redundancyScore = (exactMatches * 1.0 + partialMatches * 0.7 + semanticMatches * 0.5) / totalWords;

        return Math.min(redundancyScore, 0.95); // Cap at 95%
    }

    /**
     * Enhanced redundant comment detection (kept for backward compatibility)
     */
    isRedundantComment(cleanComment, context) {
        return this.calculateRedundancyScore(cleanComment, context) > 0.5;
    }

    /**
     * Detect trivial/obvious comments
     */
    isTrivialComment(cleanComment, context) {
        const trivialPatterns = [
            // Obvious statements
            /^(increment|decrement) \w+$/,
            /^(add|subtract|multiply|divide) \w+$/,
            /^(open|close) \w+$/,
            /^(show|hide) \w+$/,
            /^(enable|disable) \w+$/,
            /^(start|stop) \w+$/,

            // Variable assignments
            /^set \w+ to \w+$/,
            /^\w+ equals \w+$/,
            /^assign \w+ to \w+$/,

            // Simple operations
            /^(loop|iterate) through \w+$/,
            /^check if \w+ is \w+$/,
            /^return \w+$/,
            /^call \w+$/,

            // Redundant function descriptions
            /^constructor$/,
            /^getter$/,
            /^setter$/,
            /^main function$/,
            /^helper function$/,
            /^utility function$/
        ];

        // Check if next line makes the comment obvious
        if (context.nextNonEmptyLine) {
            const nextLine = context.nextNonEmptyLine.toLowerCase();

            // Comments that just repeat the function name
            if (cleanComment.replace(/[^a-zA-Z]/g, '').toLowerCase() ===
                nextLine.replace(/[^a-zA-Z]/g, '').toLowerCase()) {
                return true;
            }
        }

        return trivialPatterns.some(pattern => pattern.test(cleanComment));
    }

    /**
     * Detect empty or whitespace-only comments
     */
    isEmptyComment(cleanComment) {
        // After cleaning, if there's nothing left or just punctuation
        const meaningfulContent = cleanComment.replace(/[^\w]/g, '');
        return meaningfulContent.length === 0 || meaningfulContent.length < 2;
    }

    /**
     * Detect duplicate comments
     */
    isDuplicateComment(cleanComment, currentComment, document) {
        if (cleanComment.length < 5) return false;

        const text = document.getText();
        const commentText = currentComment.text.trim();

        // Count occurrences of the same comment
        const regex = new RegExp(this.escapeRegex(commentText), 'g');
        const matches = text.match(regex);

        return matches && matches.length > 1;
    }

    /**
     * Detect debug/temporary comments
     */
    isDebugComment(cleanComment) {
        const debugPatterns = [
            /^(console\.log|print|echo|debug|trace)/,
            /^(test|testing|temp|temporary|tmp)/,
            /^(remove|delete) (this|me|later)/,
            /^(work in progress|wip)/,
            /^(placeholder|stub)/,
            /^(broken|doesnt work|not working)/,
            /^(quick fix|quick hack|dirty fix)/,
            /^(remember to|dont forget)/,
            /^(asap|urgent|priority)/,
            /^(review|check) (this|later)/,
            /^(delete|remove) before/,
            /^(for now|temporarily)/
        ];

        return debugPatterns.some(pattern => pattern.test(cleanComment));
    }

    /**
     * Detect noise comments
     */
    isNoiseComment(cleanComment) {
        const noisePatterns = [
            /^(test|testing|debug|debugging)$/,
            /^(temp|temporary|tmp)$/,
            /^(old|deprecated|unused)$/,
            /^(comment|comments?)$/,
            /^(code|codes?)$/,
            /^(fix|fixed|fixes)$/,
            /^(change|changed|changes)$/,
            /^(update|updated|updates)$/,
            /^(\w+\s*){1,3}$/,  // Very short comments
            /^[.]{3,}|[-]{3,}|[=]{3,}|[*]{3,}/,  // Decorative comments
            /^\d+$|^v?\d+\.\d+/  // Version numbers only
        ];

        return noisePatterns.some(pattern => pattern.test(cleanComment)) || cleanComment.length <= 2;
    }

    /**
     * Detect potentially outdated comments
     */
    isOutdatedComment(cleanComment, context) {
        const outdatedIndicators = [
            'old version', 'previous version', 'legacy', 'deprecated',
            'no longer', 'not used', 'unused', 'obsolete',
            'will be removed', 'to be deleted', 'remove this',
            'temporary fix', 'quick fix', 'workaround'
        ];

        return outdatedIndicators.some(indicator => cleanComment.includes(indicator));
    }

    /**
     * Escape special regex characters
     */
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

class CommentCleaner {
    constructor() {
        this.analyzer = new CommentAnalyzer();
        this.decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
            border: '1px solid',
            borderColor: new vscode.ThemeColor('editor.findMatchBorder'),
            overviewRulerColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
            overviewRulerLane: vscode.OverviewRulerLane.Right
        });
    }

    async cleanComments(options = {}) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor found.');
            return;
        }

        const document = editor.document;
        const languageConfig = this.analyzer.getLanguageConfig(document.languageId);

        if (!languageConfig) {
            vscode.window.showInformationMessage(
                `Language '${document.languageId}' is not supported for comment analysis.`
            );
            return;
        }

        try {
            // Show progress indicator
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Analyzing comments...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 20, message: "Extracting comments..." });

                const comments = this.analyzer.extractComments(document);

                if (comments.length === 0) {
                    vscode.window.showInformationMessage('No comments found in the current document.');
                    return;
                }

                progress.report({ increment: 40, message: "Analyzing comment quality..." });

                const analyses = [];
                for (const comment of comments) {
                    const analysis = this.analyzer.analyzeComment(comment, document);
                    analyses.push({ comment, analysis });
                }

                progress.report({ increment: 80, message: "Preparing results..." });

                const removableComments = analyses.filter(
                    item => item.analysis.shouldRemove &&
                        item.analysis.confidence >= (options.confidenceThreshold || 0.6)
                );

                if (removableComments.length === 0) {
                    vscode.window.showInformationMessage('No unnecessary comments found.');
                    return;
                }

                progress.report({ increment: 100, message: "Complete!" });

                // Show detailed results
                await this.showDetailedResults(editor, removableComments, analyses);
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Error analyzing comments: ${error.message}`);
        }
    }

    async showRemovalPreview(editor, removableComments) {
        // Create a detailed preview document
        const previewContent = this.generateRemovalPreview(editor, removableComments);

        // Open preview in a new tab
        const previewDoc = await vscode.workspace.openTextDocument({
            content: previewContent,
            language: 'markdown'
        });

        const previewEditor = await vscode.window.showTextDocument(previewDoc, {
            viewColumn: vscode.ViewColumn.Beside,
            preview: true
        });

        // Highlight the comments in the original editor
        const decorations = removableComments.map(item => ({
            range: item.comment.range,
            hoverMessage: new vscode.MarkdownString(
                `**Will be removed:** ${item.analysis.category} (${Math.round(item.analysis.confidence * 100)}% confidence)`
            )
        }));
        editor.setDecorations(this.decorationType, decorations);

        // Show confirmation dialog with detailed information
        const confirmationMessage = this.generateConfirmationMessage(removableComments);

        const userChoice = await vscode.window.showWarningMessage(
            confirmationMessage,
            {
                modal: true,
                detail: 'Review the preview tab to see all comments that will be removed. This action cannot be undone (use Ctrl+Z to undo after removal).'
            },
            'Yes, Remove Comments',
            'No, Cancel'
        );

        // Clear decorations
        editor.setDecorations(this.decorationType, []);

        // Close preview document
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

        if (userChoice === 'Yes, Remove Comments') {
            await this.removeComments(editor, removableComments);
        }
    }

    generateRemovalPreview(editor, removableComments) {
        const document = editor.document;
        const fileName = document.fileName ? document.fileName.split('/').pop() : 'Untitled';

        let content = `# Comment Removal Preview\n\n`;
        content += `**File:** ${fileName}\n`;
        content += `**Language:** ${document.languageId}\n`;
        content += `**Total comments to remove:** ${removableComments.length}\n`;
        content += `**Generated:** ${new Date().toLocaleString()}\n\n`;

        // Group comments by category
        const categorizedComments = {};
        removableComments.forEach(item => {
            const category = item.analysis.category;
            if (!categorizedComments[category]) {
                categorizedComments[category] = [];
            }
            categorizedComments[category].push(item);
        });

        // Generate preview for each category
        Object.entries(categorizedComments).forEach(([category, comments]) => {
            content += `## ${category.charAt(0).toUpperCase() + category.slice(1)} Comments (${comments.length})\n\n`;

            comments.forEach((item, index) => {
                const lineNum = item.comment.lineNumber + 1;
                const commentText = item.comment.text.trim();
                const confidence = Math.round(item.analysis.confidence * 100);
                const reasons = item.analysis.reasons.join(', ');

                content += `### ${index + 1}. Line ${lineNum} (${confidence}% confidence)\n\n`;
                content += `**Reason:** ${reasons}\n\n`;
                content += `**Comment to be removed:**\n`;
                content += `\`\`\`\n${commentText}\n\`\`\`\n\n`;

                // Show context (surrounding code)
                const context = this.getCommentContext(document, item.comment);
                if (context) {
                    content += `**Context:**\n`;
                    content += `\`\`\`${document.languageId}\n${context}\n\`\`\`\n\n`;
                }

                content += `---\n\n`;
            });
        });

        // Add summary statistics
        content += `## Summary\n\n`;
        content += `| Category | Count | Avg Confidence |\n`;
        content += `|----------|-------|----------------|\n`;

        Object.entries(categorizedComments).forEach(([category, comments]) => {
            const avgConfidence = Math.round(
                comments.reduce((sum, item) => sum + item.analysis.confidence, 0) / comments.length * 100
            );
            content += `| ${category} | ${comments.length} | ${avgConfidence}% |\n`;
        });

        content += `\n**⚠️ Warning:** These comments will be permanently removed from your code. Make sure to review each one carefully.\n`;
        content += `\n**💡 Tip:** You can use Ctrl+Z (Cmd+Z on Mac) to undo the removal after it's completed.\n`;

        return content;
    }

    getCommentContext(document, comment) {
        const startLine = Math.max(0, comment.lineNumber - 2);
        const endLine = Math.min(document.lineCount - 1, comment.lineNumber + 2);

        let context = '';
        for (let i = startLine; i <= endLine; i++) {
            const line = document.lineAt(i);
            const prefix = i === comment.lineNumber ? '→ ' : '  ';
            const lineNumber = (i + 1).toString().padStart(3, ' ');
            context += `${prefix}${lineNumber}: ${line.text}\n`;
        }

        return context.trim();
    }

    generateConfirmationMessage(removableComments) {
        const categoryCount = {};
        removableComments.forEach(item => {
            const category = item.analysis.category;
            categoryCount[category] = (categoryCount[category] || 0) + 1;
        });

        let message = `About to remove ${removableComments.length} comments:\n\n`;

        Object.entries(categoryCount).forEach(([category, count]) => {
            const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
            message += `• ${categoryName}: ${count} comment${count > 1 ? 's' : ''}\n`;
        });

        message += `\nAre you sure you want to proceed?`;

        return message;
    }

    async showDetailedResults(editor, removableComments, allAnalyses) {
        // Highlight removable comments
        const decorations = removableComments.map(item => ({
            range: item.comment.range,
            hoverMessage: new vscode.MarkdownString(
                `**${item.analysis.category.toUpperCase()}** (${Math.round(item.analysis.confidence * 100)}% confidence)\n\n` +
                `${item.analysis.reasons.join(', ')}\n\n` +
                `**Comment:** ${item.comment.text.substring(0, 100)}${item.comment.text.length > 100 ? '...' : ''}`
            )
        }));

        editor.setDecorations(this.decorationType, decorations);

        // Create detailed report
        const report = this.generateReport(allAnalyses);

        // Show options dialog with "Remove All Comments" option
        const action = await vscode.window.showInformationMessage(
            `Found ${removableComments.length} unnecessary comments to remove out of ${allAnalyses.length} total comments.`,
            { modal: true },
            'Preview & Remove',
            'Review & Select',
            'Remove ALL Comments',
            'Show Report',
            'Cancel'
        );

        editor.setDecorations(this.decorationType, []);

        switch (action) {
            case 'Preview & Remove':
                await this.showRemovalPreview(editor, removableComments);
                break;
            case 'Review & Select':
                await this.selectiveRemoval(editor, removableComments);
                break;
            case 'Remove ALL Comments':
                await this.removeAllCommentsWithConfirmation(editor, allAnalyses);
                break;
            case 'Show Report':
                await this.showReport(report);
                break;
        }
    }

    async removeAllCommentsWithConfirmation(editor, allAnalyses) {
        // For nuclear option - remove EVERYTHING, no exceptions
        const commentsToRemove = allAnalyses; // Remove ALL comments
        const criticalComments = []; // No comments are preserved in nuclear mode

        if (commentsToRemove.length === 0) {
            vscode.window.showInformationMessage('No comments found in the current document.');
            return;
        }

        // Create detailed warning message for nuclear removal
        const warningContent = this.generateNuclearRemovalPreview(editor, commentsToRemove);

        // Open preview in a new tab
        const previewDoc = await vscode.workspace.openTextDocument({
            content: warningContent,
            language: 'markdown'
        });

        await vscode.window.showTextDocument(previewDoc, {
            viewColumn: vscode.ViewColumn.Beside,
            preview: true
        });

        // Highlight ALL comments that will be removed
        const decorations = commentsToRemove.map(item => ({
            range: item.comment.range,
            hoverMessage: new vscode.MarkdownString(
                `**NUCLEAR REMOVAL:** ${item.analysis.category}\n\n${item.comment.text.substring(0, 100)}...`
            )
        }));
        editor.setDecorations(this.decorationType, decorations);

        // Show final confirmation with strong warning
        const userChoice = await vscode.window.showWarningMessage(
            `🚨 NUCLEAR OPTION - REMOVE ALL COMMENTS\n\nThis will remove ALL ${commentsToRemove.length} comments from your code, including:\n• License headers\n• Documentation\n• TODOs and important notes\n• Linter directives\n• ALL comments without exception\n\nThis is IRREVERSIBLE. Are you absolutely sure?`,
            {
                modal: true,
                detail: `NUCLEAR MODE: This will remove EVERY SINGLE COMMENT in your file.\n\nThis includes:\n• Copyright and license headers\n• Important documentation\n• TODO and FIXME notes\n• ESLint and other linter directives\n• TypeScript directives\n• ALL comments of any kind\n\nThere are NO exceptions in nuclear mode.\n\nREVIEW THE PREVIEW TAB to see ALL comments that will be deleted.\n\nThis action CANNOT be automatically undone!`
            },
            'Yes, NUKE ALL Comments',
            'No, Cancel'
        );

        // Clear decorations
        editor.setDecorations(this.decorationType, []);

        // Close preview document
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

        if (userChoice === 'Yes, NUKE ALL Comments') {
            await this.removeComments(editor, commentsToRemove);

            vscode.window.showInformationMessage(
                `💥 NUCLEAR REMOVAL COMPLETE!\n\nRemoved ALL ${commentsToRemove.length} comments from your code.\n\nUse Ctrl+Z immediately if you need to undo!`,
                'I Understand'
            );
        }
    }

    generateNuclearRemovalPreview(editor, commentsToRemove) {
        const document = editor.document;
        const fileName = document.fileName ? document.fileName.split('/').pop() : 'Untitled';

        let content = `# 🚨 NUCLEAR COMMENT REMOVAL - PREVIEW\n\n`;
        content += `**File:** ${fileName}\n`;
        content += `**Language:** ${document.languageId}\n`;
        content += `**ALL comments to remove:** ${commentsToRemove.length}\n`;
        content += `**Comments to preserve:** 0 (NUCLEAR MODE)\n`;
        content += `**Generated:** ${new Date().toLocaleString()}\n\n`;

        content += `## 🚨 NUCLEAR MODE WARNING\n\n`;
        content += `This mode will remove **EVERY SINGLE COMMENT** from your code.\n`;
        content += `**NO EXCEPTIONS** - including critical comments like:\n`;
        content += `- License headers and copyright notices\n`;
        content += `- Important documentation\n`;
        content += `- TODO and FIXME notes\n`;
        content += `- ESLint, TypeScript, and other tool directives\n`;
        content += `- Function and class documentation\n`;
        content += `- ALL comments of any kind\n\n`;

        // Group ALL comments by category (showing everything will be removed)
        const categorizedComments = {};
        commentsToRemove.forEach(item => {
            const category = item.analysis.category;
            if (!categorizedComments[category]) {
                categorizedComments[category] = [];
            }
            categorizedComments[category].push(item);
        });

        content += `## 💥 ALL COMMENTS TO BE REMOVED (${commentsToRemove.length})\n\n`;

        Object.entries(categorizedComments).forEach(([category, comments]) => {
            content += `### ${category.charAt(0).toUpperCase() + category.slice(1)} (${comments.length}) - ALL WILL BE DELETED\n\n`;

            // Show first few examples from each category
            comments.slice(0, 3).forEach((item, index) => {
                const lineNum = item.comment.lineNumber + 1;
                const commentText = item.comment.text.trim().substring(0, 80);
                content += `- **Line ${lineNum}:** \`${commentText}${commentText.length >= 80 ? '...' : ''}\`\n`;
            });

            if (comments.length > 3) {
                content += `- ... and ${comments.length - 3} more ${category} comments\n`;
            }
            content += `\n`;
        });

        content += `## 📊 Nuclear Removal Summary\n\n`;
        content += `| Category | Count | Action |\n`;
        content += `|----------|-------|--------|\n`;

        Object.entries(categorizedComments).forEach(([category, comments]) => {
            content += `| ${category} | ${comments.length} | 💥 DELETE |\n`;
        });

        content += `\n## 🚨 FINAL NUCLEAR WARNING\n\n`;
        content += `### This will remove:\n`;
        content += `- **${commentsToRemove.length}** comments (ALL of them)\n`;
        content += `- **0** comments will be preserved\n`;
        content += `- **EVERY** comment type including critical ones\n`;
        content += `- License headers, documentation, TODOs, directives - EVERYTHING\n\n`;

        content += `### Before proceeding:\n`;
        content += `- ✅ Make sure you have a backup of your file\n`;
        content += `- ✅ Confirm this is really what you want\n`;
        content += `- ✅ Remember that Ctrl+Z is your only way to undo\n`;
        content += `- ✅ Consider if you really need to remove ALL comments\n\n`;

        content += `**🔥 This is the NUCLEAR OPTION - it removes EVERYTHING without discrimination!**\n\n`;
        content += `**💡 Alternative:** If you want selective removal, cancel and use "Preview & Remove" instead.\n`;

        return content;
    }

    async showRemovalSummary(removedComments, preservedComments) {
        const summaryContent = `# Comment Removal Summary\n\n**Removed:** ${removedComments.length} comments\n**Preserved:** ${preservedComments.length} comments\n\n## Details\n\nRemoval completed successfully. Use Ctrl+Z to undo if needed.`;

        const doc = await vscode.workspace.openTextDocument({
            content: summaryContent,
            language: 'markdown'
        });

        await vscode.window.showTextDocument(doc);
    }

    async selectiveRemoval(editor, removableComments) {
        const items = removableComments.map(item => ({
            label: `Line ${item.comment.lineNumber + 1}: ${item.analysis.category} (${Math.round(item.analysis.confidence * 100)}%)`,
            description: item.comment.text.substring(0, 80) + (item.comment.text.length > 80 ? '...' : ''),
            detail: `${item.analysis.reasons.join(', ')}`,
            picked: item.analysis.confidence > 0.7,
            item: item
        }));

        const selected = await vscode.window.showQuickPick(items, {
            canPickMany: true,
            placeHolder: 'Select comments to remove (pre-selected based on confidence)',
            matchOnDescription: true,
            matchOnDetail: true,
            title: 'Select Comments for Removal'
        });

        if (selected && selected.length > 0) {
            // Show preview for selected comments
            await this.showRemovalPreview(editor, selected.map(s => s.item));
        }
    }

    async removeComments(editor, commentsToRemove) {
        // Sort by position (descending) to avoid offset issues
        commentsToRemove.sort((a, b) => b.comment.range.start.compareTo(a.comment.range.start));

        const success = await editor.edit(editBuilder => {
            commentsToRemove.forEach(item => {
                // Handle full line comments (remove entire line if it's only whitespace + comment)
                const line = editor.document.lineAt(item.comment.range.start.line);
                const beforeComment = line.text.substring(0, item.comment.range.start.character);

                if (beforeComment.trim() === '') {
                    // Remove entire line
                    const lineRange = new vscode.Range(
                        item.comment.range.start.line, 0,
                        item.comment.range.start.line + 1, 0
                    );
                    editBuilder.delete(lineRange);
                } else {
                    // Remove just the comment part
                    editBuilder.delete(item.comment.range);
                }
            });
        });

        if (success) {
            vscode.window.showInformationMessage(
                `Successfully removed ${commentsToRemove.length} unnecessary comments.`
            );

            // Update statistics
            this.analyzer.statistics.removedComments = commentsToRemove.length;
            this.updateStatistics(commentsToRemove);
        } else {
            vscode.window.showErrorMessage('Failed to remove comments.');
        }
    }

    generateReport(analyses) {
        const categories = {};
        analyses.forEach(item => {
            const cat = item.analysis.category;
            if (!categories[cat]) {
                categories[cat] = { count: 0, shouldRemove: 0, avgConfidence: 0 };
            }
            categories[cat].count++;
            if (item.analysis.shouldRemove) categories[cat].shouldRemove++;
            categories[cat].avgConfidence += item.analysis.confidence;
        });

        // Calculate averages
        Object.keys(categories).forEach(cat => {
            categories[cat].avgConfidence /= categories[cat].count;
        });

        return {
            total: analyses.length,
            categories: categories,
            timestamp: new Date().toISOString()
        };
    }

    async showReport(report) {
        const reportContent = `# Comment Analysis Report

**Generated:** ${new Date(report.timestamp).toLocaleString()}
**Total Comments:** ${report.total}

## Category Breakdown

${Object.entries(report.categories).map(([category, stats]) =>
            `### ${category.charAt(0).toUpperCase() + category.slice(1)}
- **Total:** ${stats.count}
- **Recommended for removal:** ${stats.shouldRemove}
- **Average confidence:** ${Math.round(stats.avgConfidence * 100)}%
`).join('\n')}

## Recommendations

${this.generateRecommendations(report)}
`;

        const doc = await vscode.workspace.openTextDocument({
            content: reportContent,
            language: 'markdown'
        });

        await vscode.window.showTextDocument(doc);
    }

    generateRecommendations(report) {
        const recommendations = [];

        if (report.categories.commented_code?.count > 0) {
            recommendations.push('- Consider using version control instead of commenting out code');
        }

        if (report.categories.redundant?.count > 0) {
            recommendations.push('- Write more descriptive function and variable names to reduce need for explanatory comments');
        }

        if (report.categories.noise?.count > 0) {
            recommendations.push('- Remove placeholder and temporary comments');
        }

        if (report.categories.outdated?.count > 0) {
            recommendations.push('- Update or remove outdated comments');
        }

        return recommendations.length > 0 ? recommendations.join('\n') : '- Your code has good comment hygiene!';
    }

    updateStatistics(removedComments) {
        removedComments.forEach(item => {
            const category = item.analysis.category;
            if (!this.analyzer.statistics.categories[category]) {
                this.analyzer.statistics.categories[category] = 0;
            }
            this.analyzer.statistics.categories[category]++;
        });
    }

    dispose() {
        this.decorationType.dispose();
    }
}

/**
 * Main extension activation
 */
function activate(context) {
    const commentCleaner = new CommentCleaner();

    // Register main command
    const cleanCommand = vscode.commands.registerCommand('extension.intelligentRemoveComments', async () => {
        await commentCleaner.cleanComments();
    });

    // Register configuration-specific commands
    const cleanAggressiveCommand = vscode.commands.registerCommand('extension.aggressiveCleanComments', async () => {
        await commentCleaner.cleanComments({ confidenceThreshold: 0.4 });
    });

    const cleanConservativeCommand = vscode.commands.registerCommand('extension.conservativeCleanComments', async () => {
        await commentCleaner.cleanComments({ confidenceThreshold: 0.8 });
    });

    // Register batch processing command
    const cleanWorkspaceCommand = vscode.commands.registerCommand('extension.cleanWorkspaceComments', async () => {
        // Implementation for cleaning entire workspace
        vscode.window.showInformationMessage('Workspace cleaning feature coming soon!');
    });

    // Register "Remove All Comments" command
    const removeAllCommand = vscode.commands.registerCommand('extension.removeAllComments', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor found.');
            return;
        }

        const analyzer = commentCleaner.analyzer;

        const languageConfig = analyzer.getLanguageConfig(editor.document.languageId);
        if (!languageConfig) {
            vscode.window.showInformationMessage(
                `Language '${editor.document.languageId}' is not supported for comment analysis.`
            );
            return;
        }

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Analyzing all comments...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 30, message: "Extracting comments..." });

                const comments = analyzer.extractComments(editor.document);
                if (comments.length === 0) {
                    vscode.window.showInformationMessage('No comments found in the current document.');
                    return;
                }

                progress.report({ increment: 70, message: "Analyzing comments..." });

                const analyses = [];
                for (const comment of comments) {
                    const analysis = analyzer.analyzeComment(comment, editor.document);
                    analyses.push({ comment, analysis });
                }

                progress.report({ increment: 100, message: "Complete!" });

                await commentCleaner.removeAllCommentsWithConfirmation(editor, analyses);
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Error analyzing comments: ${error.message}`);
        }
    });

    context.subscriptions.push(
        cleanCommand,
        cleanAggressiveCommand,
        cleanConservativeCommand,
        cleanWorkspaceCommand,
        removeAllCommand,
        commentCleaner
    );

    // Add status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'extension.intelligentRemoveComments';
    statusBarItem.text = '$(comment) Clean Comments';
    statusBarItem.tooltip = 'Analyze and remove unnecessary comments';
    statusBarItem.show();

    context.subscriptions.push(statusBarItem);
}

function deactivate() {
    // Cleanup handled by subscriptions
}

module.exports = {
    activate,
    deactivate
};