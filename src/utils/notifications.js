import * as MailComposer from 'expo-mail-composer';
import { Alert, Platform } from 'react-native';

export async function sendEmailReport({ to, subject, body, attachments = [] }) {
  if (!to) throw new Error('Recipient email is required');
  const available = await MailComposer.isAvailableAsync();
  if (!available) throw new Error('Mail composer not available');
  return MailComposer.composeAsync({ recipients: [to], subject, body, attachments });
}

export function getBudgetAlertMessages(budgetsForProject) {
  const messages = [];
  Object.entries(budgetsForProject || {}).forEach(([category, { allocated = 0, spent = 0 }]) => {
    if (allocated > 0) {
      const ratio = spent / allocated;
      if (ratio >= 0.8 && ratio < 1) messages.push(`${category}: ${Math.round(ratio * 100)}% of budget used`);
      if (ratio >= 1) messages.push(`${category}: over budget by ${Math.round((spent - allocated))} USD`);
    }
  });
  return messages;
}

export function showBudgetAlerts(messages) {
  if (!messages?.length) return;
  const title = 'Budget Alerts';
  const text = messages.join('\n');
  Alert.alert(title, text);
}
