import { UserRole } from './types';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 4,
  admin: 3,
  manager: 2,
  user: 1,
};

export const CATEGORIES = [
  'Beer',
  'Wine',
  'Whiskey',
  'Vodka',
  'Rum',
  'Gin',
  'Tequila',
  'Brandy',
  'Champagne',
  'Liqueur',
  'Ready-to-Drink (RTD)',
  'Others',
];
