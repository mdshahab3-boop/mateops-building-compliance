// Background worker entry point. Real queues (document processing, video
// generation, notifications, expiry recalculation) arrive in Stage 6. For now
// this is a placeholder that stays alive so the compose service is valid.
console.log("[worker] placeholder — job queues arrive in Stage 6");

setInterval(() => {
  /* keep the process alive */
}, 1 << 30);
