// Simple client-side scheduler for development
// In production, you would use a proper cron service or background job queue

let schedulerInterval: NodeJS.Timeout | null = null;

export const startScheduler = () => {
  if (schedulerInterval) {
    return; // Already running
  }

  console.log('Starting Facebook post scheduler...');
  
  // Check every minute for due posts
  schedulerInterval = setInterval(async () => {
    try {
      // Get Facebook pages from localStorage
      const savedPages = localStorage.getItem('facebook_pages');
      if (!savedPages) {
        console.log('No Facebook pages found in localStorage');
        return;
      }

      const facebookPages = JSON.parse(savedPages);
      console.log('Scheduler running with', facebookPages.length, 'Facebook pages');
      
      // Call the cron endpoint
      const response = await fetch('/api/cron/process-scheduled-posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-facebook-pages': JSON.stringify(facebookPages)
        },
        body: JSON.stringify({})
      });

      if (response.ok) {
        const result = await response.json();
        if (result.results && result.results.length > 0) {
          console.log('Processed scheduled posts:', result);
        }
      } else {
        console.error('Failed to process scheduled posts:', await response.text());
      }
    } catch (error) {
      console.error('Scheduler error:', error);
    }
  }, 60000); // Check every minute
};

export const stopScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('Facebook post scheduler stopped.');
  }
};

export const isSchedulerRunning = () => {
  return schedulerInterval !== null;
};