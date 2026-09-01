import mongoose from 'mongoose';

const EmailMessageSchema = new mongoose.Schema(
  {
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailThread',
      required: true,
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ['outbound', 'inbound'],
      required: true,
      index: true,
    },
    from: {
      email: { type: String, required: true, lowercase: true, trim: true },
      name: { type: String, default: '' },
    },
    to: [
      {
        email: { type: String, required: true, lowercase: true, trim: true },
        name: { type: String, default: '' },
      },
    ],
    cc: [
      {
        email: { type: String, lowercase: true, trim: true },
        name: { type: String, default: '' },
      },
    ],
    bcc: [
      {
        email: { type: String, lowercase: true, trim: true },
        name: { type: String, default: '' },
      },
    ],
    replyTo: {
      type: String,
      default: '',
    },
    subject: {
      type: String,
      default: '',
      trim: true,
    },
    bodyText: {
      type: String,
      default: '',
    },
    bodyHtml: {
      type: String,
      default: '',
    },
    messageId: {
      type: String,
      default: '',
      index: true,
    },
    inReplyTo: {
      type: String,
      default: '',
      index: true,
    },
    references: [{ type: String }],
    providerMessageId: {
      type: String,
      default: '',
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'received'],
      default: 'sent',
      index: true,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailCampaign',
      default: null,
    },
    sentAt: { type: Date },
    receivedAt: { type: Date },
    openedAt: { type: Date },
    clickedAt: { type: Date },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

EmailMessageSchema.index({ threadId: 1, createdAt: 1 });
EmailMessageSchema.index({ leadId: 1, createdAt: -1 });

export default mongoose.models.EmailMessage || mongoose.model('EmailMessage', EmailMessageSchema);
