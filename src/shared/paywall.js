/**
 * Zovo Paywall UI Component
 * Agent 2: Premium feature gate modal
 */

import { logPaywallHit, openUpgradePage, trackEvent } from './payments.js';

const PAYWALL_CSS = `
  .zovo-paywall-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
  }
  
  .zovo-paywall-content {
    background: #1e293b;
    border-radius: 16px;
    padding: 32px;
    max-width: 400px;
    width: 90%;
    position: relative;
    border: 1px solid rgba(99, 102, 241, 0.3);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }
  
  .zovo-paywall-header {
    text-align: center;
    margin-bottom: 20px;
  }
  
  .zovo-pro-badge {
    display: inline-block;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 12px;
  }
  
  .zovo-paywall-header h2 {
    color: #f8fafc;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 0;
  }
  
  .zovo-paywall-content > p {
    color: #94a3b8;
    text-align: center;
    margin: 0 0 20px;
    font-size: 14px;
  }
  
  .zovo-benefits {
    list-style: none;
    padding: 0;
    margin: 0 0 24px;
  }
  
  .zovo-benefits li {
    position: relative;
    color: #e2e8f0;
    padding: 9px 0 9px 26px;
    font-size: 14px;
    line-height: 1.35;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .zovo-benefits li::before {
    content: "\\2713";
    position: absolute;
    left: 2px;
    color: #a5b4fc;
    font-weight: 700;
  }

  .zovo-benefits li:last-child {
    border-bottom: none;
  }
  
  .zovo-btn-primary {
    width: 100%;
    padding: 15px 24px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.01em;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(99, 102, 241, 0.35);
    transition: transform 0.15s, box-shadow 0.15s;
  }

  .zovo-btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 28px rgba(99, 102, 241, 0.5);
  }

  .zovo-btn-primary:active {
    transform: translateY(0);
  }

  .zovo-btn-primary:focus-visible {
    outline: 2px solid #c7d2fe;
    outline-offset: 3px;
  }
  
  .zovo-email-input {
    width: 100%;
    padding: 12px 16px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    color: #f8fafc;
    font-size: 14px;
    margin-bottom: 12px;
    box-sizing: border-box;
  }
  
  .zovo-email-input::placeholder {
    color: #64748b;
  }

  .zovo-email-input:focus {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
  }
  
  .zovo-subtext {
    text-align: center;
    margin-top: 16px;
    font-size: 12px;
    color: #64748b;
  }
  
  .zovo-subtext a {
    color: #6366f1;
    text-decoration: none;
  }
  
  .zovo-close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 50%;
    color: #94a3b8;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .zovo-close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: #f8fafc;
  }

  .zovo-close-btn:focus-visible {
    outline: 2px solid #c7d2fe;
    outline-offset: 2px;
  }

  .zovo-subtext a:focus-visible {
    outline: 2px solid #c7d2fe;
    outline-offset: 2px;
    border-radius: 3px;
  }
  
  .zovo-pricing {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15));
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
    text-align: center;
    border: 1px solid rgba(99, 102, 241, 0.3);
  }
  
  .zovo-pricing .price-main {
    font-size: 28px;
    font-weight: 700;
    color: #f8fafc;
    display: block;
  }
  
  .zovo-pricing .price-alt {
    font-size: 13px;
    color: #94a3b8;
    display: block;
    margin-top: 4px;
  }
  
  .zovo-pricing .price-save {
    font-size: 11px;
    color: #22c55e;
    font-weight: 600;
    margin-left: 6px;
  }
`;

// Inject styles once
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  const style = document.createElement('style');
  style.textContent = PAYWALL_CSS;
  document.head.appendChild(style);
  stylesInjected = true;
}

/**
 * Show the paywall modal
 * @param {string} featureName - Human-readable feature name
 * @param {string|null} userEmail - User's email if known
 */
export function showPaywall(featureName, userEmail = null) {
  injectStyles();

  const modal = document.createElement('div');
  modal.className = 'zovo-paywall-modal';
  modal.innerHTML = `
    <div class="zovo-paywall-content">
      <div class="zovo-paywall-header">
        <span class="zovo-pro-badge">PRO</span>
        <h2>Open up ${featureName}</h2>
      </div>
      <p>${featureName} comes with Zovo Pro. Here's what you get.</p>
      <div class="zovo-pricing">
        <span class="price-main">$4.99 a month</span>
        <span class="price-alt">or $99 lifetime, one payment</span>
      </div>
      <ul class="zovo-benefits">
        <li>10,000+ clip history</li>
        <li>Unlimited stars and pins</li>
        <li>Export to CSV, JSON, TXT</li>
        <li>Floating widget and text expander</li>
        <li>Access to 50+ Zovo extensions</li>
      </ul>
      ${!userEmail ? `
        <input type="email" class="zovo-email-input" id="zovo-email-input" placeholder="Enter your email for updates" />
      ` : ''}
      <button class="zovo-btn-primary" id="zovo-upgrade-btn">
        Get Pro
      </button>
      <p class="zovo-subtext">
        Already have a license? <a href="#" id="zovo-license-link">Enter license key</a>
      </p>
      <button class="zovo-close-btn" id="zovo-close-btn" aria-label="Close" title="Close">×</button>
    </div>
  `;

  document.body.appendChild(modal);

  // Event handlers
  document.getElementById('zovo-close-btn').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  document.getElementById('zovo-upgrade-btn').onclick = async () => {
    const email = userEmail || document.getElementById('zovo-email-input')?.value;
    if (email && email.includes('@')) {
      await logPaywallHit(email, featureName);
    }

    // Track upgrade clicked for conversion funnel
    trackEvent('upgrade_clicked', {
      feature: featureName,
      hasEmail: !!email
    });

    openUpgradePage();
    modal.remove();
  };

  document.getElementById('zovo-license-link').onclick = (e) => {
    e.preventDefault();
    modal.remove();
    showLicenseInput();
  };

  return modal;
}

/**
 * Show license key input modal
 */
export function showLicenseInput() {
  injectStyles();

  const modal = document.createElement('div');
  modal.className = 'zovo-paywall-modal';
  modal.innerHTML = `
    <div class="zovo-paywall-content">
      <div class="zovo-paywall-header">
        <span class="zovo-pro-badge">PRO</span>
        <h2>Enter License Key</h2>
      </div>
      <p>Paste your Zovo Pro license key below.</p>
      <input type="text" class="zovo-email-input" id="zovo-license-input" 
             placeholder="ZOVO-XXXX-XXXX-XXXX-XXXX" 
             style="text-transform: uppercase; font-family: monospace;" />
      <div id="zovo-license-error" style="color: #ef4444; font-size: 12px; margin-bottom: 12px; display: none;"></div>
      <button class="zovo-btn-primary" id="zovo-activate-btn">
        Activate License
      </button>
      <p class="zovo-subtext">
        Don't have a license? <a href="https://zovo.one/pricing" target="_blank">Get Pro</a>
      </p>
      <button class="zovo-close-btn" id="zovo-close-btn" aria-label="Close" title="Close">×</button>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('zovo-close-btn').onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  document.getElementById('zovo-activate-btn').onclick = async () => {
    const input = document.getElementById('zovo-license-input');
    const errorDiv = document.getElementById('zovo-license-error');
    const licenseKey = input.value.toUpperCase().trim();

    // Validate format
    if (!/^ZOVO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(licenseKey)) {
      errorDiv.textContent = 'Invalid format. Use ZOVO-XXXX-XXXX-XXXX-XXXX';
      errorDiv.style.display = 'block';
      return;
    }

    // Import and verify
    const { verifyLicense } = await import('./payments.js');
    const result = await verifyLicense(licenseKey, true);

    if (result.valid) {
      await chrome.storage.sync.set({ licenseKey });
      modal.remove();
      // Reload to apply Pro status
      location.reload();
    } else {
      errorDiv.textContent = result.error || 'Invalid or expired license key';
      errorDiv.style.display = 'block';
    }
  };

  return modal;
}

export default { showPaywall, showLicenseInput };
