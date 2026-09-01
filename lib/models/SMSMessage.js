import mongoose from 'mongoose';

const SMSMessageSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      index: true,
    },
    messageSid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    from: {
      type: String,
      required: true,
    },
    to: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    channel: {
      type: String,
      enum: ['sms', 'whatsapp'],
      default: 'sms',
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      default: 'outbound',
    },
    status: {
      type: String,
      enum: ['queued', 'sending', 'sent', 'delivered', 'undelivered', 'failed', 'received'],
      default: 'queued',
      index: true,
    },
    errorCode: {
      type: String,
      default: '',
    },
    errorMessage: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

SMSMessageSchema.index({ leadId: 1, createdAt: -1 });

export default mongoose.models.SMSMessage || mongoose.model('SMSMessage', SMSMessageSchema);
