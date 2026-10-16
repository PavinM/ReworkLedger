import { Schema, model, type Document, type Model } from 'mongoose';

export const userRoles = ['employee', 'manager', 'admin'] as const;
export type UserRole = typeof userRoles[number];

export interface UserDocument extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: userRoles, required: true, default: 'employee' },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export const User: Model<UserDocument> = model<UserDocument>('User', userSchema);
