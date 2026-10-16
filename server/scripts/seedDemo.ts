import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose, { Types } from 'mongoose';
import { connectDatabase } from '../src/config/database.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { Defect } from '../src/models/Defect.js';
import { PayrollAdjustment } from '../src/models/PayrollAdjustment.js';
import { Project } from '../src/models/Project.js';
import { Task } from '../src/models/Task.js';
import { TimeEntry } from '../src/models/TimeEntry.js';
import { User } from '../src/models/User.js';

const DEMO_MARKER = '[DEMO]';
const ids = {
  manager: new Types.ObjectId('507f1f77bcf86cd799439001'),
  engineer: new Types.ObjectId('507f1f77bcf86cd799439002'),
  qa: new Types.ObjectId('507f1f77bcf86cd799439003'),
  projectAtlas: new Types.ObjectId('507f1f77bcf86cd799439101'),
  projectMobile: new Types.ObjectId('507f1f77bcf86cd799439102'),
  projectArchive: new Types.ObjectId('507f1f77bcf86cd799439103'),
  taskInvoice: new Types.ObjectId('507f1f77bcf86cd799439201'),
  taskMobile: new Types.ObjectId('507f1f77bcf86cd799439202'),
  taskArchive: new Types.ObjectId('507f1f77bcf86cd799439203'),
  taskSummary: new Types.ObjectId('507f1f77bcf86cd799439204'),
  defectTax: new Types.ObjectId('507f1f77bcf86cd799439301'),
  defectFilter: new Types.ObjectId('507f1f77bcf86cd799439302'),
  defectArchive: new Types.ObjectId('507f1f77bcf86cd799439303'),
  defectTimezone: new Types.ObjectId('507f1f77bcf86cd799439304'),
  entryApproved: new Types.ObjectId('507f1f77bcf86cd799439401'),
  entryPending: new Types.ObjectId('507f1f77bcf86cd799439402'),
  entryRejected: new Types.ObjectId('507f1f77bcf86cd799439403'),
  entryExempt: new Types.ObjectId('507f1f77bcf86cd799439404'),
  payroll: new Types.ObjectId('507f1f77bcf86cd799439501'),
};

function date(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

async function upsert<T extends { _id: Types.ObjectId }>(model: mongoose.Model<T>, id: Types.ObjectId, data: Omit<T, '_id' | 'createdAt' | 'updatedAt'>): Promise<T> {
  const result = await model.findOneAndUpdate(
    { _id: id },
    { $set: data },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  if (!result) throw new Error(`Unable to seed ${model.modelName} ${id.toString()}`);
  return result;
}

async function run(): Promise<void> {
  if (process.env.DEMO_MODE !== 'true') throw new Error('Demo seed refused: set DEMO_MODE=true explicitly');
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seed refused in production');

  await connectDatabase();

  const demoPasswordHash = await bcrypt.hash('DemoReworkLedger!2026', 12);
  await upsert(User, ids.manager, {
    name: 'Demo Manager',
    email: 'manager.demo@reworkledger.local',
    passwordHash: demoPasswordHash,
    role: 'manager',
    active: true,
  });
  await upsert(User, ids.engineer, {
    name: 'Demo Employee',
    email: 'employee.demo@reworkledger.local',
    passwordHash: demoPasswordHash,
    role: 'employee',
    active: true,
  });
  await upsert(User, ids.qa, {
    name: 'Demo Admin',
    email: 'admin.demo@reworkledger.local',
    passwordHash: demoPasswordHash,
    role: 'admin',
    active: true,
  });

  await upsert(Project, ids.projectAtlas, {
    name: `${DEMO_MARKER} Atlas Migration`,
    description: 'Illustrative migration project for the hackathon demo.',
    status: 'active',
    managerId: ids.manager,
  });
  await upsert(Project, ids.projectMobile, {
    name: `${DEMO_MARKER} Mobile Workspace`,
    description: 'Illustrative mobile quality project.',
    status: 'active',
    managerId: ids.manager,
  });
  await upsert(Project, ids.projectArchive, {
    name: `${DEMO_MARKER} Core Platform Archive`,
    description: 'Illustrative completed project.',
    status: 'completed',
    managerId: ids.manager,
  });

  await upsert(Task, ids.taskInvoice, {
    projectId: ids.projectAtlas,
    title: `${DEMO_MARKER} Invoice export`,
    description: 'Original delivery completed before a tax rounding defect was found.',
    assigneeId: ids.engineer,
    assigneeName: 'Demo Engineer',
    status: 'completed',
    originalCompletedAt: date('2026-05-09'),
    currentCompletedAt: date('2026-05-09'),
    createdBy: ids.manager,
  });
  await upsert(Task, ids.taskMobile, {
    projectId: ids.projectMobile,
    title: `${DEMO_MARKER} Mobile filters`,
    description: 'Reopened after an approved corrective defect.',
    assigneeId: ids.engineer,
    assigneeName: 'Demo Engineer',
    status: 'reopened',
    originalCompletedAt: date('2026-05-07'),
    currentCompletedAt: date('2026-05-07'),
    createdBy: ids.manager,
  });
  await upsert(Task, ids.taskArchive, {
    projectId: ids.projectArchive,
    title: `${DEMO_MARKER} Archive empty state`,
    description: 'Completed task with an exempted defect.',
    assigneeId: ids.qa,
    assigneeName: 'Demo QA',
    status: 'completed',
    originalCompletedAt: date('2026-05-05'),
    currentCompletedAt: date('2026-05-05'),
    createdBy: ids.manager,
  });
  await upsert(Task, ids.taskSummary, {
    projectId: ids.projectAtlas,
    title: `${DEMO_MARKER} Weekly summary`,
    description: 'In progress task demonstrating defect eligibility rules.',
    assigneeId: ids.qa,
    assigneeName: 'Demo QA',
    status: 'in_progress',
    createdBy: ids.manager,
  });

  await upsert(Defect, ids.defectTax, {
    taskId: ids.taskInvoice,
    projectId: ids.projectAtlas,
    title: `${DEMO_MARKER} Tax rounding defect`,
    description: 'Tax values round incorrectly in the exported invoice.',
    severity: 'critical',
    cause: 'code_defect',
    status: 'approved',
    reportedBy: ids.qa,
    reviewedBy: ids.manager,
    reviewReason: 'Reproducible in the release build.',
  });
  await upsert(Defect, ids.defectFilter, {
    taskId: ids.taskMobile,
    projectId: ids.projectMobile,
    title: `${DEMO_MARKER} Filter state defect`,
    description: 'Mobile filters reset after refresh.',
    severity: 'high',
    cause: 'code_defect',
    status: 'approved',
    reportedBy: ids.qa,
    reviewedBy: ids.manager,
    reviewReason: 'Approved for corrective work.',
  });
  await upsert(Defect, ids.defectArchive, {
    taskId: ids.taskArchive,
    projectId: ids.projectArchive,
    title: `${DEMO_MARKER} Archive empty state`,
    description: 'Archive view needs a clearer empty state.',
    severity: 'medium',
    cause: 'requirement_change',
    status: 'exempted',
    reportedBy: ids.qa,
    reviewedBy: ids.manager,
    reviewReason: 'Planned for the next product iteration.',
  });
  await upsert(Defect, ids.defectTimezone, {
    taskId: ids.taskSummary,
    projectId: ids.projectAtlas,
    title: `${DEMO_MARKER} Timezone summary`,
    description: 'This remains reported because the task is not complete.',
    severity: 'low',
    cause: 'external_dependency',
    status: 'reported',
    reportedBy: ids.qa,
  });

  await upsert(TimeEntry, ids.entryApproved, {
    taskId: ids.taskInvoice,
    defectId: ids.defectTax,
    employeeId: ids.engineer,
    date: date('2026-05-11'),
    hours: 8.5,
    description: `${DEMO_MARKER} Corrected invoice rounding and added regression coverage.`,
    category: 'corrective_work',
    approvalStatus: 'approved',
    reviewedBy: ids.manager,
    reviewedAt: date('2026-05-12'),
    reviewReason: 'Verified against the defect reproduction.',
    payrollAdjustmentId: ids.payroll,
  });
  await upsert(TimeEntry, ids.entryPending, {
    taskId: ids.taskMobile,
    defectId: ids.defectFilter,
    employeeId: ids.engineer,
    date: date('2026-05-13'),
    hours: 4,
    description: `${DEMO_MARKER} Pending mobile filter correction.`,
    category: 'corrective_work',
    approvalStatus: 'pending',
  });
  await upsert(TimeEntry, ids.entryRejected, {
    taskId: ids.taskInvoice,
    defectId: ids.defectTax,
    employeeId: ids.engineer,
    date: date('2026-05-10'),
    hours: 2,
    description: `${DEMO_MARKER} Rejected duplicate investigation entry.`,
    category: 'corrective_work',
    approvalStatus: 'rejected',
    reviewedBy: ids.manager,
    reviewedAt: date('2026-05-11'),
    reviewReason: 'Duplicate of the approved entry.',
  });
  await upsert(TimeEntry, ids.entryExempt, {
    taskId: ids.taskArchive,
    defectId: ids.defectArchive,
    employeeId: ids.qa,
    date: date('2026-05-06'),
    hours: 3,
    description: `${DEMO_MARKER} Work associated with an exempt defect.`,
    category: 'corrective_work',
    approvalStatus: 'approved',
    reviewedBy: ids.manager,
    reviewedAt: date('2026-05-07'),
    reviewReason: 'Entry retained for audit demonstration.',
  });

  await upsert(PayrollAdjustment, ids.payroll, {
    employeeId: ids.engineer,
    periodStart: date('2026-05-04'),
    periodEnd: date('2026-05-17'),
    currency: 'USD',
    approvedTimeEntryIds: [ids.entryApproved],
    eligibleCorrectiveHours: 8.5,
    configuredHourlyRate: 45,
    proposedAmount: 382.5,
    calculationBreakdown: [{
      timeEntryId: ids.entryApproved,
      taskId: ids.taskInvoice,
      defectId: ids.defectTax,
      date: date('2026-05-11'),
      hours: 8.5,
      hourlyRate: 45,
      amount: 382.5,
    }],
    status: 'pending_review',
  });

  const auditEvents = [
    ['TimeEntry', ids.entryApproved, 'time_entry_created'],
    ['TimeEntry', ids.entryApproved, 'time_entry_approved'],
    ['PayrollAdjustment', ids.payroll, 'payroll_calculation_created'],
  ] as const;
  for (const [entityType, entityId, action] of auditEvents) {
    await AuditLog.findOneAndUpdate(
      { entityId, action },
      { $set: { entityType, timestamp: date('2026-05-13'), after: { demo: true, marker: DEMO_MARKER } } },
      { upsert: true, new: true },
    );
  }

  console.log('Demo dataset ready: 3 projects, 4 tasks, 4 defects, 4 time entries, 1 payroll proposal.');
  await mongoose.disconnect();
}

run().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Demo seed failed');
  await mongoose.disconnect();
  process.exitCode = 1;
});
