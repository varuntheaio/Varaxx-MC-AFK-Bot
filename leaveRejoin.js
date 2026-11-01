const config = require('./settings.json');

function randomMs(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function setupLeaveRejoin(bot, createBot) {
    // Timers
    let leaveTimer = null;
    let jumpTimer = null;
    let jumpOffTimer = null;

    // State
    let stopped = false;
    let lastLogAt = 0;

    function logThrottled(msg, minGapMs = 2000) {
        const now = Date.now();
        if (now - lastLogAt >= minGapMs) {
            lastLogAt = now;
            console.log(msg);
        }
    }

    function cleanup() {
        stopped = true;
        if (leaveTimer) clearTimeout(leaveTimer);
        if (jumpTimer) clearTimeout(jumpTimer);
        if (jumpOffTimer) clearTimeout(jumpOffTimer);
        leaveTimer = jumpTimer = jumpOffTimer = null;
    }

    function scheduleNextJump() {
        if (stopped || !bot || !bot.entity) return;

        try {
            bot.setControlState('jump', true);
            jumpOffTimer = setTimeout(() => {
                if (bot) bot.setControlState('jump', false);
            }, 300);
        } catch (e) {
            // ignore movement errors if bot is disconnecting
        }

        // Random jump 30s -> 3m
        const nextJump = randomMs(30000, 3 * 60 * 1000);
        jumpTimer = setTimeout(scheduleNextJump, nextJump);
    }

    function init() {
        cleanup();
        stopped = false;

        const periodic = config.utils && config.utils['periodic-rejoin'];
        if (periodic && periodic.enabled) {
            const minMin = periodic['min-interval'] || 20;
            const maxMin = periodic['max-interval'] || 60;
            const stayTime = randomMs(minMin * 60 * 1000, maxMin * 60 * 1000);

            logThrottled(`[AFK] Periodic rejoin scheduled in ${Math.round(stayTime / 60000)} minutes`);

            leaveTimer = setTimeout(() => {
                if (stopped) return;
                logThrottled('[AFK] Periodic rejoin: leaving server to refresh connection');
                cleanup();
                try {
                    bot.quit();
                } catch (e) {
                    // ignore
                }
            }, stayTime);
        } else {
            logThrottled('[AFK] Periodic rejoin disabled; maintaining persistent connection');
        }

        scheduleNextJump();
    }

    // Since setupLeaveRejoin is invoked inside the spawn handler, run init immediately
    init();

    // Clean up timers on any disconnect event
    bot.on('end', () => cleanup());
    bot.on('kicked', () => cleanup());
    bot.on('error', () => cleanup());
}

module.exports = setupLeaveRejoin;
