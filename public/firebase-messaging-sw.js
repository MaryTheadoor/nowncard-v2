// Firebase Cloud Messaging Service Worker
// Handles background push notifications

importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyC5LYbN48ILp4eXv_6O00dR3ode_9cWE1w',
  authDomain: 'vcard-studio-314.firebaseapp.com',
  projectId: 'vcard-studio-314',
  storageBucket: 'vcard-studio-314.firebasestorage.app',
  messagingSenderId: '58487120224',
  appId: '1:58487120224:web:f53e2cda0f276fd237fe05',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'NownCard', {
    body: body || '',
    icon: icon || '/nowncard-logo.png',
    data: payload.data || {},
  });
});
