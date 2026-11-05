/**
 * Referral Dashboard Component
 * Agent 4: UI component for referral stats and sharing
 * Prompt 14: Growth & Viral Engine
 */

class ReferralDashboard {
    constructor(referralSystem) {
        this.system = referralSystem;
    }

    /**
     * Generate dashboard HTML
     */
    async render() {
        const stats = await this.getStats();
        const referralCode = await this.system.generateReferralCode();
        const links = this.system.getReferralLinks(referralCode);
        const tier = this.system.getRewardTier(stats.qualifiedReferrals);

        return `
      <div class="referral-dashboard">
        ${this.renderHeader(tier)}
        ${this.renderShareSection(links.standard)}
        ${this.renderSocialButtons(links)}
        ${this.renderStats(stats)}
        ${this.renderRewardsInfo(tier)}
        ${this.renderLeaderboard(stats.leaderboard)}
      </div>
    `;
    }

    renderHeader(tier) {
        return `
      <div class="referral-header">
        <h2>Invite Friends, Get Pro Free</h2>
        <p>Earn ${tier.referrer} days of Pro for every friend who joins</p>
        <span class="tier-badge tier-${tier.tier}">${tier.badge} ${tier.tier.toUpperCase()}</span>
      </div>
    `;
    }

    renderShareSection(referralLink) {
        return `
      <div class="share-section">
        <label>Your Referral Link</label>
        <div class="referral-link-container">
          <input type="text" value="${referralLink}" readonly id="referral-link" />
          <button onclick="copyReferralLink()" class="copy-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
          </button>
        </div>
      </div>
    `;
    }

    renderSocialButtons(links) {
        return `
      <div class="social-share-buttons">
        <button onclick="shareOn('twitter', '${links.twitter}')" class="share-btn twitter">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          Twitter
        </button>
        <button onclick="shareOn('linkedin', '${links.linkedin}')" class="share-btn linkedin">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          LinkedIn
        </button>
        <button onclick="shareOn('email', '${links.email}')" class="share-btn email">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
          Email
        </button>
      </div>
    `;
    }

    renderStats(stats) {
        return `
      <div class="referral-stats">
        <div class="stat">
          <span class="number">${stats.totalReferred}</span>
          <span class="label">Friends Invited</span>
        </div>
        <div class="stat">
          <span class="number">${stats.qualifiedReferrals}</span>
          <span class="label">Active Users</span>
        </div>
        <div class="stat highlight">
          <span class="number">${stats.proDaysEarned}</span>
          <span class="label">Pro Days Earned</span>
        </div>
      </div>
    `;
    }

    renderRewardsInfo(tier) {
        const milestones = [
            { count: 10, reward: '1 month Pro', icon: '🎯' },
            { count: 25, reward: '3 months Pro', icon: '⭐' },
            { count: 50, reward: '6 months Pro', icon: '💎' },
            { count: 100, reward: 'Lifetime Pro', icon: '👑' },
        ];

        return `
      <div class="rewards-info">
        <h3>Milestone Bonuses</h3>
        <div class="milestones">
          ${milestones.map(m => `
            <div class="milestone">
              <span class="icon">${m.icon}</span>
              <span class="count">${m.count} referrals</span>
              <span class="reward">${m.reward}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    }

    renderLeaderboard(leaderboard = []) {
        if (!leaderboard.length) return '';

        return `
      <div class="leaderboard">
        <h3>Top Referrers This Month</h3>
        <ol>
          ${leaderboard.slice(0, 5).map((user, i) => `
            <li>
              <span class="rank">${i + 1}</span>
              <span class="name">${user.name}</span>
              <span class="count">${user.count} referrals</span>
            </li>
          `).join('')}
        </ol>
      </div>
    `;
    }

    async getStats() {
        const { referralStats } = await chrome.storage.local.get('referralStats');
        return referralStats || {
            totalReferred: 0,
            qualifiedReferrals: 0,
            proDaysEarned: 0,
            leaderboard: [],
        };
    }

    /**
     * Generate CSS for dashboard
     */
    getStyles() {
        return `
      .referral-dashboard {
        padding: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .referral-header {
        text-align: center;
        margin-bottom: 24px;
      }

      .referral-header h2 {
        font-size: 24px;
        margin: 0 0 8px;
        color: #1e293b;
      }

      .referral-header p {
        color: #64748b;
        margin: 0;
      }

      .tier-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        margin-top: 12px;
      }

      .tier-bronze { background: #f97316; color: white; }
      .tier-silver { background: #94a3b8; color: white; }
      .tier-gold { background: #eab308; color: #1e293b; }
      .tier-platinum { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }

      .share-section {
        margin-bottom: 20px;
      }

      .share-section label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        margin-bottom: 8px;
        color: #64748b;
      }

      .referral-link-container {
        display: flex;
        gap: 8px;
      }

      .referral-link-container input {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        font-size: 13px;
        color: #1e293b;
      }

      .copy-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 16px;
        background: #6366f1;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
      }

      .copy-btn:hover {
        background: #4f46e5;
      }

      .social-share-buttons {
        display: flex;
        gap: 12px;
        margin-bottom: 24px;
      }

      .share-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
        color: white;
        transition: transform 0.1s;
      }

      .share-btn:hover {
        transform: scale(1.02);
      }

      .share-btn.twitter { background: #1da1f2; }
      .share-btn.linkedin { background: #0077b5; }
      .share-btn.email { background: #6b7280; }

      .referral-stats {
        display: flex;
        gap: 16px;
        margin-bottom: 24px;
      }

      .stat {
        flex: 1;
        padding: 16px;
        background: #f8fafc;
        border-radius: 12px;
        text-align: center;
      }

      .stat.highlight {
        background: linear-gradient(135deg, #e0e7ff, #faf5ff);
      }

      .stat .number {
        display: block;
        font-size: 28px;
        font-weight: 700;
        color: #1e293b;
      }

      .stat .label {
        display: block;
        font-size: 12px;
        color: #64748b;
        margin-top: 4px;
      }

      .rewards-info h3,
      .leaderboard h3 {
        font-size: 14px;
        font-weight: 600;
        margin: 0 0 12px;
        color: #1e293b;
      }

      .milestones {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      .milestone {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: #f8fafc;
        border-radius: 8px;
      }

      .milestone .icon {
        font-size: 20px;
      }

      .milestone .count {
        font-weight: 600;
        color: #1e293b;
      }

      .milestone .reward {
        margin-left: auto;
        font-size: 12px;
        color: #64748b;
      }
    `;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ReferralDashboard };
}
