export type DateRange = { start: string; end: string };

function localDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Weekly operational period: most recent Tuesday through the following Monday. */
export function currentTuesdayMondayRange(now = new Date()): DateRange {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceTuesday = (today.getDay() - 2 + 7) % 7;
  const start = new Date(today);
  start.setDate(start.getDate() - daysSinceTuesday);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start: localDateInputValue(start), end: localDateInputValue(end) };
}
