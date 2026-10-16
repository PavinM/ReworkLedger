import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { AnalysisScan, type FindingStatus } from '../models/AnalysisScan.js';
import { Defect } from '../models/Defect.js';
import { Task } from '../models/Task.js';
import { HttpError } from '../middleware/errors.js';
import { canReportDefect } from '../services/defectRules.js';
import { analyzeSource, analyzeSourceWithLocalAi, isLocalAiAnalysisEnabled, readZipSource } from '../services/codeAnalysis.js';

export const uploadProject = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, file.originalname.toLowerCase().endsWith('.zip')),
});

function assertTaskAccess(req: Parameters<RequestHandler>[0], task: { assigneeId: mongoose.Types.ObjectId }): void {
  if (req.user?.role === 'employee' && task.assigneeId.toString() !== req.user.id) {
    throw new HttpError(403, 'You can only analyze tasks assigned to you');
  }
}

export const listScans: RequestHandler = async (req, res) => {
  const taskId = typeof req.params.taskId === 'string' ? req.params.taskId : '';
  const task = await Task.findById(taskId).select('assigneeId').lean();
  if (!task) throw new HttpError(404, 'Task not found');
  assertTaskAccess(req, task);
  const scans = await AnalysisScan.find({ taskId: task._id }).sort({ createdAt: -1 }).lean();
  res.json({ data: scans });
};

export const startScan: RequestHandler = async (req, res) => {
  const taskId = typeof req.params.taskId === 'string' ? req.params.taskId : '';
  const task = await Task.findById(taskId);
  if (!task) throw new HttpError(404, 'Task not found');
  assertTaskAccess(req, task);
  if (!req.file) throw new HttpError(400, 'A ZIP project file is required');
  const scan = await AnalysisScan.create({
    taskId: task._id,
    projectId: task.projectId,
    uploadedBy: req.user!.id,
    sourceName: req.file.originalname,
    versionRef: req.body.versionRef,
    expectedBehavior: req.body.expectedBehavior,
    description: req.body.description,
    status: 'queued',
    aiStatus: isLocalAiAnalysisEnabled() ? 'queued' : 'skipped',
  });
  void runScan(scan.id, req.file.buffer);
  res.status(202).json({ data: scan });
};

async function runScan(scanId: string, buffer: Buffer): Promise<void> {
  try {
    await AnalysisScan.findByIdAndUpdate(scanId, { status: 'running' });
    const files = await readZipSource(buffer);
    const staticFindings = analyzeSource(files).map((finding) => ({ ...finding, source: 'static' as const }));
    if (!isLocalAiAnalysisEnabled()) {
      await AnalysisScan.findByIdAndUpdate(scanId, {
        status: 'completed',
        aiStatus: 'skipped',
        filesAnalyzed: files.length,
        totalFindings: staticFindings.length,
        findings: staticFindings,
      });
      return;
    }

    await AnalysisScan.findByIdAndUpdate(scanId, {
      status: 'running',
      aiStatus: 'running',
      filesAnalyzed: files.length,
      totalFindings: staticFindings.length,
      findings: staticFindings,
    });
    try {
      const aiResult = await analyzeSourceWithLocalAi(files);
      const findings = [...staticFindings, ...aiResult.findings];
      await AnalysisScan.findByIdAndUpdate(scanId, {
        status: 'completed',
        aiStatus: 'completed',
        aiFilesAnalyzed: aiResult.filesReviewed,
        aiFilesSkipped: aiResult.filesSkipped,
        aiRejectedFindings: aiResult.rejectedFindings,
        totalFindings: findings.length,
        findings,
      });
    } catch (error) {
      await AnalysisScan.findByIdAndUpdate(scanId, {
        status: 'completed',
        aiStatus: 'failed',
        aiError: error instanceof Error ? error.message : 'Local AI analysis failed',
        aiFilesAnalyzed: 0,
        aiFilesSkipped: files.length,
        totalFindings: staticFindings.length,
        findings: staticFindings,
      });
    }
  } catch (error) {
    await AnalysisScan.findByIdAndUpdate(scanId, {
      status: 'failed',
      aiStatus: 'skipped',
      errorMessage: error instanceof Error ? error.message : 'Analysis failed',
    });
  }
}

export const reviewFinding: RequestHandler = async (req, res) => {
  const scanId = typeof req.params.scanId === 'string' ? req.params.scanId : '';
  const findingId = typeof req.params.findingId === 'string' ? req.params.findingId : '';
  const scan = await AnalysisScan.findById(scanId);
  if (!scan) throw new HttpError(404, 'Analysis scan not found');
  const finding = scan.findings.id(findingId);
  if (!finding) throw new HttpError(404, 'Finding not found');
  const status = req.body.status as FindingStatus;
  if (finding.status !== 'needs_review') throw new HttpError(400, 'This finding has already been reviewed');
  finding.status = status;
  finding.reviewedBy = new mongoose.Types.ObjectId(req.user!.id);
  finding.reviewReason = req.body.reviewReason;
  await scan.save();
  res.json({ data: scan });
};

export const createDefectFromFinding: RequestHandler = async (req, res) => {
  const scanId = typeof req.params.scanId === 'string' ? req.params.scanId : '';
  const findingId = typeof req.params.findingId === 'string' ? req.params.findingId : '';
  const scan = await AnalysisScan.findById(scanId);
  if (!scan) throw new HttpError(404, 'Analysis scan not found');
  const finding = scan.findings.id(findingId);
  if (!finding) throw new HttpError(404, 'Finding not found');
  if (finding.status !== 'confirmed_bug') throw new HttpError(400, 'Confirm the finding before creating a defect');
  if (finding.defectId) throw new HttpError(409, 'A defect already exists for this finding');
  const task = await Task.findById(scan.taskId);
  if (!task) throw new HttpError(404, 'Original task not found');
  if (!canReportDefect(task.status)) throw new HttpError(400, 'The task must be completed before a confirmed finding can become a defect');
  const defect = await Defect.create({
    taskId: task._id,
    projectId: task.projectId,
    analysisScanId: scan._id,
    analysisFindingId: finding._id,
    module: finding.filePath,
    title: finding.title,
    description: `${finding.description}\n\nEvidence (${finding.filePath}:${finding.line}): ${finding.evidence}\n\nSuggested investigation: ${finding.suggestion}`,
    debugInstructions: req.body.debugInstructions ?? finding.suggestion,
    severity: finding.severity,
    cause: req.body.cause,
    reportedBy: scan.uploadedBy,
  });
  finding.defectId = defect._id;
  await scan.save();
  res.status(201).json({ data: defect });
};
