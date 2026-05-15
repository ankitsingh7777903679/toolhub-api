// Datadog APM Configuration
// This file MUST be required at the very top of index.js, before any other imports
const tracer = require('dd-trace').init({
    service: 'toolhub-api',
    env: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    logInjection: true,
    runtimeMetrics: true,
    profiling: true,
    appsec: true,
    // Analytics for all routes
    analytics: true,
    // Tags for better filtering
    tags: {
        app: 'vbussguj',
        team: 'vbussguj'
    }
});

module.exports = tracer;
