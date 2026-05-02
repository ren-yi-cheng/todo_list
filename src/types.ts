export type IsoString = string;

export type Todo = {
  id: string;
  title: string;
  note: string;
  dueAt: IsoString | null;
  remindAt: IsoString | null;
  reminderFiredAt: IsoString | null;
  reminderDismissedAt: IsoString | null;
  completedAt: IsoString | null;
  createdAt: IsoString;
  updatedAt: IsoString;
};

export type Settings = {
  soundEnabled: boolean;
  notificationsEnabled: boolean;
};
