import { Schema, model, type Document, type Model, type Types } from 'mongoose';
import { defectCauses, type DefectCause } from '../types/domain.js';

export const scanStatuses = ['queued', 'running', 'completed', 'failed'] as const;
export type ScanStatus = (typeof scanStatuses)[number];
export const aiScanStatuses = ['queued', 'running', 'completed', 'failed', 'skipped'] as const;
export type AiScanStatus = (typeof aiScanStatuses)[number];
export const findingStatuses = ['needs_review', 'confirmed_bug', 'false_positive', 'needs_information', 'accepted_risk'] as const;
export type FindingStatus = (typeof findingStatuses)[number];

export interface AnalysisFinding {
  _id: Types.ObjectId;
  source: 'static' | 'local_ai';
  confidence?: number;
  suggestedCause?: DefectCause;
  ruleId: string;
  tool: string;
  title: string;
  description: string;
  filePath: string;
  line: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: FindingStatus;
  evidence: string;
  suggestion: string;
  reviewedBy?: Types.ObjectId;
  reviewReason?: string;
  defectId?: Types.ObjectId;
}

export interface AnalysisScanDocument extends Document {
  taskId: Types.ObjectId;
  projectId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  sourceName: string;
  versionRef?: string;
  expectedBehavior?: string;
  description?: string;
  status: ScanStatus;
  errorMessage?: string;
  aiStatus: AiScanStatus;
  aiError?: string;
  aiFilesAnalyzed: number;
  aiFilesSkipped: number;
  aiRejectedFindings: number;
  filesAnalyzed: number;
  totalFindings: number;
  findings: Types.DocumentArray<AnalysisFinding>;
  createdAt: Date;
  updatedAt: Date;
}

const findingSchema = new Schema<AnalysisFinding>({
  source: { type: String, enum: ['static', 'local_ai'], default: 'static', required: true },
  confidence: { type: Number, min: 1, max: 10 },
  suggestedCause: { type: String, enum: defectCauses },
  ruleId: { type: String, required: true },
  tool: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  filePath: { type: String, required: true },
  line: { type: Number, required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  status: { type: String, enum: findingStatuses, default: 'needs_review', required: true },
  evidence: { type: String, required: true, maxlength: 1000 },
  suggestion: { type: String, required: true, maxlength: 2000 },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewReason: { type: String, maxlength: 2000 },
  defectId: { type: Schema.Types.ObjectId, ref: 'Defect' },
}, { _id: true });

const scanSchema = new Schema<AnalysisScanDocument>({
  taskId: { type: Schema.Types.ObjectId, required: true, ref: 'Task', index: true },
  projectId: { type: Schema.Types.ObjectId, required: true, ref: 'Project', index: true },
  uploadedBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  sourceName: { type: String, required: true },
  versionRef: { type: String, trim: true, maxlength: 200 },
  expectedBehavior: { type: String, trim: true, maxlength: 4000 },
  description: { type: String, trim: true, maxlength: 2000 },
  status: { type: String, enum: scanStatuses, default: 'queued', required: true, index: true },
  errorMessage: { type: String, maxlength: 2000 },
  aiStatus: { type: String, enum: aiScanStatuses, default: 'skipped', required: true },
  aiError: { type: String, maxlength: 2000 },
  aiFilesAnalyzed: { type: Number, default: 0 },
  aiFilesSkipped: { type: Number, default: 0 },
  aiRejectedFindings: { type: Number, default: 0 },
  filesAnalyzed: { type: Number, default: 0 },
  totalFindings: { type: Number, default: 0 },
  findings: { type: [findingSchema], default: [] },
}, { timestamps: true });

scanSchema.index({ taskId: 1, createdAt: -1 });

export const AnalysisScan: Model<AnalysisScanDocument> = model<AnalysisScanDocument>('AnalysisScan', scanSchema);
