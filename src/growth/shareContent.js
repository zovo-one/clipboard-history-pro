/**
 * Share Content Generator
 * Agent 3: Platform-specific share content
 * Prompt 14: Growth & Viral Engine
 */

class ShareContentGenerator {
    constructor(extensionName = 'Clipboard History Pro') {
        this.extensionName = extensionName;
        this.baseUrl = 'https://zovo.one/clipboard-history-pro';
    }

    /**
     * Generate Twitter/X share content
     */
    twitter(referralLink, context = {}) {
        const templates = [
            `Been using ${this.extensionName} and I stopped losing copied text. Search your history, pin what matters, paste in a click. ${referralLink}`,

            `${this.extensionName} just saved me from losing copied text again. If you copy a lot during the day, it's worth a look. ${referralLink}`,

            `${context.clipCount || 50}+ clips saved with ${this.extensionName}, and my clipboard is finally organized. ${referralLink}`,
        ];

        return templates[Math.floor(Math.random() * templates.length)];
    }

    /**
     * Generate LinkedIn share content
     */
    linkedin(referralLink, context = {}) {
        return `A quick productivity note.

I've been using ${this.extensionName} for ${context.duration || 'a few weeks'} now, and it's changed how I work.

Here's what it does.
• Keeps everything you copy, so nothing gets lost
• Searches your entire clipboard history
• Pins the snippets you reuse
• Pastes back in one click

Handy for developers, writers, and anyone who copies a lot of text.

Link in comments.

#ProductivityTools #DeveloperTools #ChromeExtensions`;
    }

    /**
     * Generate email share content
     */
    email(referralLink, context = {}) {
        return {
            subject: 'Thought you might like this clipboard tool',
            body: `Hey${context.recipientName ? ' ' + context.recipientName : ''},

I've been using ${this.extensionName} and wanted to pass it along.

It's a clipboard manager. It saves everything you copy, lets you search back through your history, and keeps the snippets you reuse one click away.

Really handy if you copy and paste a lot during the day.

You can try it here: ${referralLink}

${context.senderName ? context.senderName : ''}`,
        };
    }

    /**
     * Generate Reddit share content
     */
    reddit(referralLink, context = {}) {
        return {
            title: `${this.extensionName}, never lose copied text again [Free Tool]`,
            body: `Hey everyone,

I've been using ${this.extensionName} to manage my clipboard and figured it was worth sharing.

What it does. It saves your clipboard history automatically, lets you search everything you've copied, pins the text you reuse, and pastes back to the clipboard in one click.

How I use it. ${context.useCase || 'I copy a lot of code snippets and URLs during development'}.

The free tier holds 100 clips. Pro adds unlimited history plus the advanced features.

You can try it here: ${referralLink}

Happy to answer questions.`,
        };
    }

    /**
     * Generate Product Hunt share content
     */
    productHunt(referralLink) {
        return {
            tagline: 'Never lose copied text again, with searchable clipboard history',
            description: `${this.extensionName} keeps every piece of text you copy, so you can search your whole clipboard history in an instant.

- Instant search through everything you've copied
- Pin the snippets you reuse
- Paste back in one click
- Automatic sorting by content type
- Everything stored locally, so your data stays private

Handy for developers, writers, researchers, and anyone who copies text all day.`,
            firstComment: `Hi Product Hunt,

I built ${this.extensionName} because I kept losing important copied text the moment I copied something new.

It keeps your whole clipboard history searchable, so you can pull up that URL or code snippet from hours ago.

Here's what's inside.
• Automatic clip saving
• Full-text search
• Content type detection (URLs, code, and more)
• Pin favorites for quick access
• Local storage only, so nothing leaves your machine

I'd love your feedback.`,
        };
    }

    /**
     * Generate Hacker News share content
     */
    hackerNews(referralLink) {
        return {
            title: `Show HN: ${this.extensionName}, searchable clipboard history for Chrome`,
            text: `Built this because I kept losing important copied text.

What it does.
- Saves everything you copy automatically
- Full-text search through your history
- Detects content types (URLs, code, plain text)
- Pins the snippets you reuse
- Keeps all data local

On the technical side.
- Chrome extension on Manifest V3
- Uses chrome.storage.local for persistence
- No external API calls for the core features

Feedback welcome.

${referralLink}`,
        };
    }

    /**
     * Generate achievement share content
     */
    achievement(platform, achievement, referralLink) {
        const messages = {
            milestone_10: `Just hit 10 clips with ${this.extensionName}, and my clipboard is finally organized.`,
            milestone_100: `100 clips saved with ${this.extensionName}. Officially a power user now.`,
            milestone_500: `500 clips saved in ${this.extensionName}. This one's become essential to how I work.`,
            time_saved: `${this.extensionName} has saved me hours of hunting for clipboard content I thought I'd lost. Worth a look.`,
            week_streak: `Used ${this.extensionName} every day this week. It's quietly become part of my workflow.`,
        };

        const message = messages[achievement] || messages.milestone_10;
        return `${message} ${referralLink}`;
    }

    /**
     * Generate powered-by badge HTML
     */
    poweredByBadge(referralLink, style = 'default') {
        const styles = {
            default: `<a href="${referralLink}" target="_blank" style="display:inline-flex;align-items:center;padding:4px 8px;background:#6366f1;border-radius:4px;text-decoration:none;font-size:11px;color:#fff;font-weight:500;">Made with ${this.extensionName}</a>`,

            minimal: `<a href="${referralLink}" style="font-size:10px;color:#6366f1;text-decoration:none;">${this.extensionName}</a>`,

            dark: `<a href="${referralLink}" target="_blank" style="display:inline-flex;align-items:center;padding:6px 12px;background:#1e293b;border-radius:6px;text-decoration:none;font-size:11px;color:#f8fafc;">${this.extensionName}</a>`,
        };

        return styles[style] || styles.default;
    }

    /**
     * Get share URL for platform
     */
    getShareUrl(platform, referralLink, content) {
        const urls = {
            twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(content)}`,
            linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`,
            reddit: `https://reddit.com/submit?url=${encodeURIComponent(referralLink)}&title=${encodeURIComponent(content.title || '')}`,
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`,
            hackernews: `https://news.ycombinator.com/submitlink?u=${encodeURIComponent(referralLink)}&t=${encodeURIComponent(content.title || '')}`,
        };

        return urls[platform];
    }
}

// Create singleton
const shareContent = new ShareContentGenerator();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ShareContentGenerator, shareContent };
}
