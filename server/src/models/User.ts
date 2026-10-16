import { Schema, model, type Document, type Model } from 'mongoose';

export const userRoles = ['employee', 'manager', 'admin'] as const;
export type UserRole = typeof userRoles[number];

export interface UserDocument extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  hourlyRate: number;
  baseSalary: number;
  payrollCurrency: string;
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
    hourlyRate: { type: Number, required: true, min: 0, max: 100000, default: 1000 },
    baseSalary: { type: Number, required: true, min: 0, max: 100000000, default: 50000 },
    payrollCurrency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3, default: 'INR' },
  },
  { timestamps: true },
);

export const User: Model<UserDocument> = model<UserDocument>('User', userSchema);
