import mongoose from 'mongoose';

const EmailThreadSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    subject: {
      type: String,
      default: '(No Subject)',
      trim: true,
    },
    participants: [
      {
        email: { type: String, required: true, lowercase: true, trim: true },
        name: { type: String, default: '' },
      },
    ],
    snippet: {
      type: String,
      default: '',
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastMessageDirection: {
      type: String,
      enum: ['inbound', 'outbound'],
      default: 'outbound',
    },
    unread: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'trash'],
      default: 'active',
      index: true,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailCampaign',
      default: null,
      index: true,
    },
    messageCount: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

EmailThreadSchema.index({ leadId: 1, lastMessageAt: -1 });

export default mongoose.models.EmailThread || mongoose.model('EmailThread', EmailThreadSchema);
