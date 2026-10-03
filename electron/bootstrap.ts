/**
 * Process entrypoint for Electron.
 *
 * zca-js uses `ws`, which normally tries to load optional native addons. Those
 * addons are not needed for correctness and have caused Windows access
 * violations after Electron upgrades. Set the flags before loading main.ts so
 * every Zalo WebSocket uses ws' maintained JavaScript implementation.
 */
process.env.WS_NO_BUFFER_UTIL = '1';
process.env.WS_NO_UTF_8_VALIDATE = '1';

require('./main');
