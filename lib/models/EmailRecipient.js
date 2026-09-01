import mongoose from 'mongoose';

const EmailRecipientSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailCampaign',
      required: true,
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'queued', 'sending', 'sent', 'failed', 'suppressed', 'bounced', 'skipped'],
      default: 'pending',
      index: true,
    },
    error: {
      type: String,
      default: '',
    },
    providerMessageId: {
      type: String,
      default: '',
      index: true,
    },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    openedAt: { type: Date },
    clickedAt: { type: Date },
    repliedAt: { type: Date },
    retryCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Guarantee idempotency: a lead can only be queued once per campaign
EmailRecipientSchema.index({ campaignId: 1, leadId: 1 }, { unique: true });
EmailRecipientSchema.index({ campaignId: 1, status: 1 });

export default mongoose.models.EmailRecipient || mongoose.model('EmailRecipient', EmailRecipientSchema);
