class SimulatedTime {
  constructor(startTime, speedFactor = 1) {
    this.startTime = new Date(startTime);
    this.speedFactor = speedFactor;
    this.realStartTime = OriginalDate.now(); // Use OriginalDate.now() here as well
    this.timeoutMap = new Map();
    this.intervalMap = new Map();
    this.cronJobs = [];
  }

  now() {
    // Use OriginalDate.now() to avoid recursion
    const realElapsedTime = OriginalDate.now() - this.realStartTime;
    const simulatedElapsedTime = realElapsedTime * this.speedFactor;
    return new Date(this.startTime.getTime() + simulatedElapsedTime);
  }

  static overrideDate(simulatedClockInstance) {
    const simulatedClock = simulatedClockInstance; // The instance of SimulatedTime

    // Save the original Date constructor
    globalThis.Date = class extends OriginalDate {
      constructor(...args) {
        if (args.length === 0) {
          // If no arguments are provided, return the simulated current time
          return new OriginalDate(simulatedClock.now());
        }
        // Otherwise, behave as the original Date constructor
        return new OriginalDate(...args);
      }

      // Ensure static methods like Date.now() are overridden properly
      static now() {
        return simulatedClock.now().getTime();
      }
    };

    // Retain the original Date methods
    globalThis.Date.UTC = OriginalDate.UTC;
    globalThis.Date.parse = OriginalDate.parse;
  }

  // Set timeout but adjust for the speed factor
  setTimeout(callback, delay) {
    const adjustedDelay = delay / this.speedFactor;
    const timeoutId = setTimeout(callback, adjustedDelay);
    this.timeoutMap.set(timeoutId, adjustedDelay);
    return timeoutId;
  }

  clearTimeout(timeoutId) {
    clearTimeout(timeoutId);
    this.timeoutMap.delete(timeoutId);
  }

  // Set interval but adjust for the speed factor
  setInterval(callback, interval) {
    const adjustedInterval = interval / this.speedFactor;
    const intervalId = setInterval(callback, adjustedInterval);
    this.intervalMap.set(intervalId, adjustedInterval);
    return intervalId;
  }

  clearInterval(intervalId) {
    clearInterval(intervalId);
    this.intervalMap.delete(intervalId);
  }

  // Method to add cron jobs (simplified)
  addCronJob(cronExpression, callback) {
    const job = { cronExpression, callback, lastRun: null };
    this.cronJobs.push(job);
  }

  // Run cron jobs based on the current simulated time
  runCronJobs() {
    const now = this.now();
    this.cronJobs.forEach(job => {
      const [second, minute, hour] = job.cronExpression.split(' ');

      const shouldRun =
        (second === '*' || now.getSeconds() % parseInt(second) === 0) &&
        (minute === '*' || now.getMinutes() % parseInt(minute) === 0) &&
        (hour === '*' || now.getHours() % parseInt(hour) === 0);

      if (shouldRun && (!job.lastRun || now > job.lastRun)) {
        job.lastRun = now;
        job.callback();
      }
    });
  }

  // Restore the original Date and timer functions
  static restoreOriginal() {
    globalThis.Date = OriginalDate;
    globalThis.setTimeout = OriginalSetTimeout;
    globalThis.clearTimeout = OriginalClearTimeout;
    globalThis.setInterval = OriginalSetInterval;
    globalThis.clearInterval = OriginalClearInterval;
  }

  // Simulate the passage of time
  simulateTimePassing(ms) {
    this.realStartTime -= ms / this.speedFactor;
  }
}

// Save original Date and timer functions before overriding
const OriginalDate = globalThis.Date;
const OriginalSetTimeout = globalThis.setTimeout;
const OriginalClearTimeout = globalThis.clearTimeout;
const OriginalSetInterval = globalThis.setInterval;
const OriginalClearInterval = globalThis.clearInterval;

// Create an instance of SimulatedTime
const simulatedClock = new SimulatedTime('2024-05-20T00:00:00+09:00', 1);

// Override Date globally
SimulatedTime.overrideDate(simulatedClock);
//SimulatedTime.restoreOriginal();
// Export the simulated clock instance for use in other modules
module.exports = { simulatedClock };
