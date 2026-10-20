/**
 * Ambient declarations for the web build.
 *
 * Metro ignores CSS imports on native, but the web bundler applies them.
 * TypeScript needs to be told the module exists.
 */
declare module '*.css';
