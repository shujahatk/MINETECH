import mongoose from 'mongoose';

const ActivityLogSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        'EMAIL_SENT',
        'EMAIL_RECEIVED',
        'EMAIL_OPENED',
        'EMAIL_CLICKED',
        'EMAIL_REPLIED',
        'EMAIL_BOUNCED',
        'CAMPAIGN_ENROLLED',
        'CAMPAIGN_SENT',
        'SEQUENCE_STARTED',
        'SEQUENCE_STEP_SENT',
        'SEQUENCE_STOPPED',
        'CALL_STARTED',
        'CALL_COMPLETED',
        'CALL_MISSED',
        'SMS_SENT',
        'SMS_RECEIVED',
        'WHATSAPP_SENT',
        'WHATSAPP_RECEIVED',
        'NOTE_ADDED',
        'LEAD_CREATED',
        'LEAD_UPDATED',
        'STATUS_CHANGED',
        'SUPPRESSION_UPDATED',
      ],
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['email', 'call', 'sms', 'whatsapp', 'system', 'note'],
      default: 'email',
    },
    direction: {
      type: String,
      enum: ['outbound', 'inbound', 'system'],
      default: 'outbound',
    },
    summary: {
      type: String,
      required: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

ActivityLogSchema.index({ leadId: 1, timestamp: -1 });

export default mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema);
