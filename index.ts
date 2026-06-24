import 'expo-router/entry';

import { Platform } from 'react-native';

// Defines the widget-refresh background task at global scope so it survives
// headless launches (expo-task-manager requirement).
import './src/lib/background-refresh';

if (Platform.OS === 'android') {
  // Headless renderer for home-screen widgets (add / resize / periodic update).
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widgets/android/widget-task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
