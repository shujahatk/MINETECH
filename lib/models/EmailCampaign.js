import mongoose from 'mongoose';

const EmailCampaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
    },
    bodyHtml: {
      type: String,
      required: [true, 'Email body is required'],
    },
    bodyText: {
      type: String,
      default: '',
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailTemplate',
      default: null,
    },
    inboxId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SendingInbox',
      default: null,
    },
    engine: {
      type: String,
      enum: ['listmonk', 'direct'],
      default: 'listmonk',
    },
    listmonkCampaignId: {
      type: Number,
      index: true,
      default: null,
    },
    listmonkListId: {
      type: Number,
      default: null,
    },
    listmonkStatus: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'queued', 'running', 'paused', 'completed', 'cancelled', 'failed'],
      default: 'draft',
      index: true,
    },
    filterCriteria: {
      tags: [{ type: String }],
      status: [{ type: String }],
      source: { type: String },
      onlyUncontacted: { type: Boolean, default: false },
    },
    stats: {
      totalRecipients: { type: Number, default: 0 },
      eligible: { type: Number, default: 0 },
      suppressed: { type: Number, default: 0 },
      missingEmail: { type: Number, default: 0 },
      alreadyContacted: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      opened: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
      replied: { type: Number, default: 0 },
      bounced: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    lastWorkerRunAt: { type: Date },
  },
  { timestamps: true }
);

EmailCampaignSchema.index({ status: 1, scheduledAt: 1 });

export default mongoose.models.EmailCampaign || mongoose.model('EmailCampaign', EmailCampaignSchema);
