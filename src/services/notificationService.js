// notificationService.js
// This service simulates the off-platform Email and Push Notifications
// In production, this logic will be handled by a Firebase Cloud Function triggering on Firestore 'notifications' onCreate.

export const simulatePushNotification = (userId, message) => {
  console.log(`[PUSH NOTIFICATION] Sending to device tokens for user ${userId}: ${message}`);
  
  // Example Web Push logic (stub)
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification("DrWEEE Flow", {
      body: message,
      icon: '/vite.svg' 
    });
  }
};

export const simulateEmailNotification = (userEmail, subject, htmlBody) => {
  console.log(`[EMAIL DISPATCH] Sending to ${userEmail}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body: ${htmlBody}`);
};

export const requestNotificationPermission = async () => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Web Push permission granted.');
    }
  }
};
