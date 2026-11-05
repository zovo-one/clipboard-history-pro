/**
 * Performance Monitor
 * Agent 3: Runtime performance tracking
 * Prompt 11: Production-grade monitoring
 */

class PerformanceMonitor {
    constructor() {
        this.metrics = [];
        this.thresholds = {
            popupOpen: 100,      // ms
            clipCopy: 50,        // ms
            search: 200,         // ms
            storageRead: 100,    // ms
            storageWrite: 150,   // ms
        };

        this.init();
    }

    init() {
        // Track memory usage periodically
        this.trackMemoryUsage();

        // Set up periodic memory check
        try {
            chrome.alarms.create('memory-check', { periodInMinutes: 5 });
            chrome.alarms.onAlarm.addListener((alarm) => {
                if (alarm.name === 'memory-check') {
                    this.trackMemoryUsage();
                }
            });
        } catch {
            setInterval(() => this.trackMemoryUsage(), 5 * 60 * 1000);
        }

        console.log('[PerformanceMonitor] Initialized');
    }

    /**
     * Start timing an operation
     * @returns {function} Stop function that returns duration
     */
    startTimer(operationName) {
        const start = performance.now();

        return () => {
            const duration = performance.now() - start;
            this.recordMetric(operationName, duration);
            return duration;
        };
    }

    /**
     * Time an async operation
     */
    async timeAsync(operationName, asyncFn) {
        const stop = this.startTimer(operationName);
        try {
            const result = await asyncFn();
            const duration = stop();
            return { result, duration };
        } catch (error) {
            stop();
            throw error;
        }
    }

    /**
     * Record a performance metric
     */
    recordMetric(name, value, unit = 'ms') {
        const metric = {
            name,
            value,
            unit,
            timestamp: Date.now(),
        };

        this.metrics.push(metric);

        // Keep only last 100 metrics in memory
        if (this.metrics.length > 100) {
            this.metrics = this.metrics.slice(-100);
        }

        // Check threshold
        if (this.thresholds[name] && value > this.thresholds[name]) {
            console.warn(`[Performance] ${name} exceeded threshold: ${value}ms > ${this.thresholds[name]}ms`);
        }

        // Persist periodically
        this.persistMetrics();

        return metric;
    }

    /**
     * Track memory usage
     */
    async trackMemoryUsage() {
        try {
            if (performance.memory) {
                const memory = performance.memory;
                this.recordMetric('heapUsed', Math.round(memory.usedJSHeapSize / 1024 / 1024), 'MB');
                this.recordMetric('heapTotal', Math.round(memory.totalJSHeapSize / 1024 / 1024), 'MB');
            }

            // Extension storage usage
            const bytesInUse = await chrome.storage.local.getBytesInUse();
            this.recordMetric('storageUsed', Math.round(bytesInUse / 1024), 'KB');
        } catch (e) {
            // Silent fail - memory API may not be available
        }
    }

    async persistMetrics() {
        try {
            const { performanceMetrics } = await chrome.storage.local.get('performanceMetrics');
            const existing = performanceMetrics || [];

            await chrome.storage.local.set({
                performanceMetrics: [...existing.slice(-200), ...this.metrics.slice(-20)],
                performanceLastUpdate: Date.now()
            });
        } catch {
            // Silent fail
        }
    }

    /**
     * Get performance report
     */
    async getReport() {
        const { performanceMetrics, performanceLastUpdate } = await chrome.storage.local.get([
            'performanceMetrics', 'performanceLastUpdate'
        ]);

        const metrics = performanceMetrics || [];

        // Calculate averages by metric name
        const averages = {};
        const metricsByName = {};

        metrics.forEach(m => {
            if (!metricsByName[m.name]) {
                metricsByName[m.name] = [];
            }
            metricsByName[m.name].push(m.value);
        });

        for (const [name, values] of Object.entries(metricsByName)) {
            const sum = values.reduce((a, b) => a + b, 0);
            averages[name] = {
                avg: Math.round(sum / values.length * 100) / 100,
                min: Math.min(...values),
                max: Math.max(...values),
                count: values.length,
            };
        }

        return {
            averages,
            totalMetrics: metrics.length,
            lastUpdate: performanceLastUpdate,
            thresholds: this.thresholds,
        };
    }

    /**
     * Get health status
     */
    async getHealthStatus() {
        const report = await this.getReport();
        const issues = [];

        for (const [name, data] of Object.entries(report.averages)) {
            const threshold = this.thresholds[name];
            if (threshold && data.avg > threshold) {
                issues.push({
                    metric: name,
                    avg: data.avg,
                    threshold,
                    severity: data.avg > threshold * 2 ? 'critical' : 'warning'
                });
            }
        }

        return {
            status: issues.length === 0 ? 'healthy' : 'degraded',
            issues,
            metrics: report.averages,
        };
    }

    /**
     * Clear performance data
     */
    async clearMetrics() {
        this.metrics = [];
        await chrome.storage.local.remove(['performanceMetrics', 'performanceLastUpdate']);
    }
}

// Create singleton
const performanceMonitor = new PerformanceMonitor();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PerformanceMonitor, performanceMonitor };
}
