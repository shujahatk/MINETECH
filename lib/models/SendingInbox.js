import mongoose from 'mongoose';

const SendingInboxSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: 'Primary Outbound Mailbox',
    },
    fromEmail: {
      type: String,
      required: [true, 'From email is required'],
      trim: true,
      lowercase: true,
    },
    fromName: {
      type: String,
      default: '',
      trim: true,
    },
    replyTo: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    dailyLimit: {
      type: Number,
      default: 200,
    },
    emailsSentToday: {
      type: Number,
      default: 0,
    },
    lastResetDate: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
    },
    status: {
      type: String,
      enum: ['healthy', 'warming', 'throttled', 'paused'],
      default: 'healthy',
    },
    active: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.SendingInbox || mongoose.model('SendingInbox', SendingInboxSchema);
