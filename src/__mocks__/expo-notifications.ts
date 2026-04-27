export const setNotificationHandler = jest.fn();
export const getPermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));
export const requestPermissionsAsync = jest.fn(() => Promise.resolve({ status: 'granted' }));
export const scheduleNotificationAsync = jest.fn(() => Promise.resolve('notification-id'));
export const cancelScheduledNotificationAsync = jest.fn();
export const cancelAllScheduledNotificationsAsync = jest.fn();
export const getAllScheduledNotificationsAsync = jest.fn(() => Promise.resolve([]));
