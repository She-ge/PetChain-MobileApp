import { 
  formatDate, 
  parseDate, 
  isValidDate, 
  getDateDifference, 
  getRelativeTime 
} from '../dateUtils';

describe('dateUtils', () => {
  describe('formatDate', () => {
    it('should format date to ISO string by default', () => {
      const date = new Date('2023-01-01T12:00:00Z');
      expect(formatDate(date)).toBe(date.toISOString());
    });

    it('should format date with options', () => {
      const date = new Date('2023-01-01T12:00:00Z');
      const formatted = formatDate(date, { year: 'numeric' });
      expect(formatted).toContain('2023');
    });

    it('should throw error for invalid date', () => {
      expect(() => formatDate('invalid')).toThrow('Invalid date provided');
    });
  });

  describe('parseDate', () => {
    it('should parse valid date string', () => {
      const date = parseDate('2023-01-01');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(2023);
    });

    it('should return null for invalid date string', () => {
      expect(parseDate('invalid')).toBeNull();
    });
  });

  describe('isValidDate', () => {
    it('should return true for valid date', () => {
      expect(isValidDate(new Date())).toBe(true);
      expect(isValidDate('2023-01-01')).toBe(true);
    });

    it('should return false for invalid date', () => {
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate('invalid')).toBe(false);
    });
  });

  describe('getDateDifference', () => {
    it('should calculate difference in days', () => {
      const start = '2023-01-01';
      const end = '2023-01-03';
      expect(getDateDifference(start, end, 'days')).toBe(2);
    });

    it('should calculate difference in hours', () => {
      const start = '2023-01-01T10:00:00Z';
      const end = '2023-01-01T12:00:00Z';
      expect(getDateDifference(start, end, 'hours')).toBe(2);
    });
  });

  describe('getRelativeTime', () => {
    it('should return relative time for past', () => {
      const past = new Date();
      past.setDate(past.getDate() - 2);
      expect(getRelativeTime(past)).toBe('2 days ago');
    });

    it('should return relative time for future', () => {
      const future = new Date();
      future.setDate(future.getDate() + 1);
      expect(getRelativeTime(future)).toBe('in 1 day');
    });

    it('should return "just now" for very recent', () => {
      expect(getRelativeTime(new Date())).toBe('just now');
    });
  });
});
